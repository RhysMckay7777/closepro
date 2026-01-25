import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { roleplaySessions, roleplayMessages, roleplayAnalysis } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { analyzeCall } from '@/lib/ai/analysis';
import { shouldBypassSubscription } from '@/lib/dev-mode';
import { generateMockAnalysis } from '@/lib/ai/mock-analysis';

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

    // Analyze the roleplay using the same analysis engine as real calls
    let analysisResult;
    try {
      analysisResult = await analyzeCall(transcript, transcriptJson);
    } catch (analysisError: any) {
      console.error('Analysis error:', analysisError);
      
      // In dev mode, use mock analysis as fallback
      if (shouldBypassSubscription()) {
        console.log('Using mock analysis (dev mode fallback)');
        analysisResult = generateMockAnalysis(transcript, transcriptJson);
      } else {
        // Return a more helpful error message
        return NextResponse.json(
          { 
            error: `Analysis failed: ${analysisError.message || 'Unknown error'}. Please check your AI API keys (GROQ_API_KEY or ANTHROPIC_API_KEY) are configured in your .env file.` 
          },
          { status: 500 }
        );
      }
    }

    // Save analysis to roleplay_analysis (not call_analysis — FK to roleplay_sessions)
    const [analysis] = await db
      .insert(roleplayAnalysis)
      .values({
        roleplaySessionId: sessionId,
        overallScore: analysisResult.overallScore,
        valueScore: analysisResult.value.score,
        trustScore: analysisResult.trust.score,
        fitScore: analysisResult.fit.score,
        logisticsScore: analysisResult.logistics.score,
        valueDetails: JSON.stringify(analysisResult.value),
        trustDetails: JSON.stringify(analysisResult.trust),
        fitDetails: JSON.stringify(analysisResult.fit),
        logisticsDetails: JSON.stringify(analysisResult.logistics),
        skillScores: JSON.stringify(analysisResult.skillScores),
        coachingRecommendations: JSON.stringify(analysisResult.coachingRecommendations),
        timestampedFeedback: JSON.stringify(analysisResult.timestampedFeedback),
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
      message: 'Roleplay scored successfully',
    });
  } catch (error: any) {
    console.error('Error scoring roleplay:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to score roleplay' },
      { status: 500 }
    );
  }
}
