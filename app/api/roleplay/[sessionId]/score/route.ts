import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { roleplaySessions, roleplayMessages, roleplayAnalysis } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { analyzeCall, calculateCloserEffectiveness } from '@/lib/ai/analysis';
import { sql } from 'drizzle-orm';
import { ROLEPLAY_FEEDBACK_PROMPT, ROLEPLAY_FEEDBACK_DIMENSIONS, ROLEPLAY_FEEDBACK_LABELS, ROLEPLAY_FEEDBACK_DESCRIPTIONS } from '@/lib/training/scoring-categories';
import Groq from 'groq-sdk';

export const maxDuration = 300;

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const groqClient = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

/**
 * Generate roleplay-specific post-call feedback (5 dimensions + coaching).
 * Runs as a secondary AI call after the main analysis.
 */
async function generateRoleplayFeedback(transcript: string): Promise<Record<string, unknown> | null> {
  if (!groqClient) return null;
  try {
    const prompt = `You are a high-performance sales coach. Analyze this roleplay transcript and provide structured post-call feedback.

${ROLEPLAY_FEEDBACK_PROMPT}

TRANSCRIPT:
${transcript.length > 4000 ? transcript.substring(0, 4000) + '\n... (truncated)' : transcript}

Return ONLY valid JSON with this structure:
{
  "dimensions": {
    "pre_set": { "score": number (1-10), "feedback": string },
    "authority": { "score": number (1-10), "feedback": string },
    "objection_handling": { "score": number (1-10), "feedback": string },
    "close_attempt": { "score": number (1-10), "feedback": string },
    "overall": { "score": number (1-10), "feedback": string }
  },
  "authorityLevelUsed": string (which archetype: Advisee/Peer/Advisor and why),
  "whatWorked": string[] (2-4 specific moments where salesperson did well),
  "whatDidntWork": string[] (2-4 missed opportunities or weak moments),
  "keyImprovement": string (the ONE thing that would have the biggest impact),
  "transcriptMoment": {
    "quote": string (the specific exchange from the transcript),
    "whatTheyShoulHaveSaid": string (the improved version)
  }
}`;

    const response = await groqClient.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are an elite sales performance coach. Return only valid JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    let jsonText = content.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
    return JSON.parse(jsonText);
  } catch (err) {
    logger.error('ROLEPLAY', 'Feedback generation failed', err);
    return null;
  }
}

/**
 * POST - Score a completed roleplay session
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get roleplay session
    const roleplay = await db
      .select()
      .from(roleplaySessions)
      .where(
        and(
          eq(roleplaySessions.id, sessionId),
          eq(roleplaySessions.userId, session.user.id)
        )
      )
      .limit(1);

    if (!roleplay[0]) {
      return NextResponse.json(
        { error: 'Roleplay session not found' },
        { status: 404 }
      );
    }

    // Get all messages
    const messages = await db
      .select()
      .from(roleplayMessages)
      .where(eq(roleplayMessages.sessionId, sessionId))
      .orderBy(roleplayMessages.createdAt);

    if (messages.length === 0) {
      return NextResponse.json(
        { error: 'No messages found in session' },
        { status: 400 }
      );
    }

    // Build transcript from messages
    const transcript = messages
      .map(msg => {
        const speaker = msg.role === 'rep' ? 'Rep' : 'Prospect';
        return `[${speaker}] ${msg.content}`;
      })
      .join('\n\n');

    // Build transcript JSON with utterances
    const utterances = messages.map((msg, idx) => ({
      speaker: msg.role === 'rep' ? 'A' : 'B',
      start: msg.timestamp || idx * 5000, // Use timestamp or estimate
      end: (msg.timestamp || idx * 5000) + 3000,
      text: msg.content,
    }));

    const transcriptJson = { utterances };

    // Analyze the roleplay using the same analysis engine (Groq or Anthropic; no mock fallback)
    let analysisResult;
    try {
      analysisResult = await analyzeCall(transcript, transcriptJson);
    } catch (analysisError: any) {
      logger.error('ROLEPLAY', 'Analysis engine failed', analysisError, { sessionId });
      const msg = analysisError?.message ?? '';
      const isCreditError = /credit|balance|too low|payment|upgrade/i.test(msg) || (analysisError?.status === 400);
      return NextResponse.json(
        {
          error: isCreditError
            ? 'AI scoring is unavailable: your API credit balance is too low. Add credits in Plans & Billing, or set GROQ_API_KEY for a free-tier alternative.'
            : `Analysis failed: ${msg || 'Unknown error'}. Ensure GROQ_API_KEY or ANTHROPIC_API_KEY is set in .env.`,
        },
        { status: isCreditError ? 402 : 500 }
      );
    }

    // Detect conversation stages for completion tracking
    const stagesCompleted = {
      opening: messages.length >= 2,
      discovery: (analysisResult.categoryScores as any)?.discovery > 3,
      offer: (analysisResult.categoryScores as any)?.value > 3,
      objections: (analysisResult.objections?.length || 0) > 0,
      close: (analysisResult.categoryScores as any)?.closing > 3,
    };
    const isIncomplete = !stagesCompleted.opening || !stagesCompleted.discovery || !stagesCompleted.offer;

    // Save analysis to roleplay_analysis (10-category framework, same as call analysis)
    logger.info('ROLEPLAY', 'Scoring analysis stored', {
      sessionId,
      overallScore: analysisResult.overallScore,
      categoryCount: Object.keys(analysisResult.categoryScores || {}).length,
      isIncomplete,
    });

    // Generate roleplay-specific post-call feedback (5 dimensions) in parallel
    let roleplayFeedback: Record<string, unknown> | null = null;
    try {
      roleplayFeedback = await generateRoleplayFeedback(transcript);
    } catch (feedbackErr) {
      logger.warn('ROLEPLAY', 'Feedback generation failed (non-fatal)', { sessionId });
    }

    // Build insert values with v1 + v2 columns
    const insertValues = {
      roleplaySessionId: sessionId,
      overallScore: analysisResult.overallScore,
      // DEPRECATED: 4-pillar scores set to null, use skillScores instead
      valueScore: null,
      trustScore: null,
      fitScore: null,
      logisticsScore: null,
      // 10-category skill scores (same framework as call analysis)
      skillScores: JSON.stringify(analysisResult.categoryScores),
      // Prospect difficulty (from analysis result)
      prospectDifficulty: analysisResult.prospectDifficulty?.totalDifficultyScore ?? null,
      prospectDifficultyTier: analysisResult.prospectDifficulty?.difficultyTier ?? null,
      // Coaching and feedback
      coachingRecommendations: JSON.stringify(analysisResult.coachingRecommendations),
      timestampedFeedback: JSON.stringify(analysisResult.timestampedFeedback),
      // Completion tracking
      isIncomplete,
      stagesCompleted: JSON.stringify(stagesCompleted),
      // Enhanced feedback (from analysis result if available)
      categoryFeedback: analysisResult.categoryFeedbackDetailed ? JSON.stringify(analysisResult.categoryFeedbackDetailed) : null,
      priorityFixes: analysisResult.priorityFixes ? JSON.stringify(analysisResult.priorityFixes) : null,
      objectionAnalysis: analysisResult.objectionAnalysis ? JSON.stringify(analysisResult.objectionAnalysis) : null,
      // v2.0 Phase-based analysis columns
      phaseScores: analysisResult.phaseScores ? JSON.stringify(analysisResult.phaseScores) : null,
      phaseAnalysis: analysisResult.phaseAnalysis ? JSON.stringify(analysisResult.phaseAnalysis) : null,
      outcomeDiagnosticP1: analysisResult.outcomeDiagnosticP1 ?? null,
      outcomeDiagnosticP2: analysisResult.outcomeDiagnosticP2 ?? null,
      closerEffectiveness: calculateCloserEffectiveness(
        analysisResult.prospectDifficulty?.totalDifficultyScore ?? 25,
        analysisResult.overallScore ?? 0
      ),
      prospectDifficultyJustifications: analysisResult.prospectDifficultyJustifications
        ? JSON.stringify(analysisResult.prospectDifficultyJustifications) : null,
      actionPoints: analysisResult.actionPoints
        ? JSON.stringify(analysisResult.actionPoints.slice(0, 3)) : null,
      // Roleplay-specific post-call feedback (5 dimensions)
      roleplayFeedback: roleplayFeedback ? JSON.stringify(roleplayFeedback) : null,
    };

    const [analysis] = await db
      .insert(roleplayAnalysis)
      .values(insertValues)
      .returning();

    // Update session with score and analysis
    await db
      .update(roleplaySessions)
      .set({
        overallScore: analysisResult.overallScore,
        analysisId: analysis.id,
        status: 'completed',
        completedAt: new Date(),
      })
      .where(eq(roleplaySessions.id, sessionId));

    return NextResponse.json({
      analysis,
      overallScore: analysisResult.overallScore,
      isIncomplete,
      stagesCompleted,
      message: isIncomplete
        ? 'Roleplay scored as partial - conversation ended before full sales process was completed'
        : 'Roleplay scored successfully',
    });
  } catch (error: any) {
    logger.error('ROLEPLAY', 'Failed to score roleplay', error, { sessionId });
    const msg = error?.message ?? '';

    if (msg.includes('timeout') || error?.code === 'ETIMEDOUT' || error?.code === 'UND_ERR_CONNECT_TIMEOUT') {
      return NextResponse.json(
        { error: 'Scoring timed out. The session may be too long. Please try again.' },
        { status: 504 }
      );
    }

    if (error?.status === 429) {
      return NextResponse.json(
        { error: 'Rate limited. Please wait 30 seconds and try again.' },
        { status: 429 }
      );
    }

    if (error?.status === 401) {
      return NextResponse.json(
        { error: 'API authentication failed. Check GROQ_API_KEY in environment variables.' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: msg || 'Failed to score roleplay' },
      { status: 500 }
    );
  }
}

