import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { roleplaySessions, roleplayMessages, roleplayAnalysis } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { analyzeCall } from '@/lib/ai/analysis';

export const maxDuration = 120;

/**
 * POST - Score a completed roleplay session
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    console.log('[SCORING] Starting for session:', sessionId);
    console.log('[SCORING] GROQ_API_KEY present:', !!process.env.GROQ_API_KEY);

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
      console.error('Analysis error:', analysisError);
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
    console.log('[Roleplay Score] Storing analysis:', {
      sessionId,
      overallScore: analysisResult.overallScore,
      categoryCount: Object.keys(analysisResult.categoryScores || {}).length,
      prospectDifficulty: analysisResult.prospectDifficulty?.totalDifficultyScore,
      isIncomplete,
      stagesCompleted,
    });

    const [analysis] = await db
      .insert(roleplayAnalysis)
      .values({
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
      })
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
    console.error('[SCORING] Error scoring roleplay:', error);
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

