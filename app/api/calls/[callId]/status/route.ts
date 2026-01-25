import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { salesCalls, users, roleplaySessions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { analyzeCall } from '@/lib/ai/analysis';
import { callAnalysis } from '@/db/schema';

/**
 * Check call status and analysis
 * With Deepgram, transcription is instant, so we only check analysis status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const { callId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get call
    const call = await db
      .select()
      .from(salesCalls)
      .where(
        and(
          eq(salesCalls.id, callId),
          eq(salesCalls.userId, session.user.id)
        )
      )
      .limit(1);

    if (!call[0]) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      );
    }

    // If already completed, return current status
    // Also check if this is a roleplay session (callId might be a sessionId)
    if (call[0].status === 'completed') {
      const analysis = await db
        .select()
        .from(callAnalysis)
        .where(eq(callAnalysis.callId, callId))
        .limit(1);

      return NextResponse.json({
        status: 'completed',
        call: call[0],
        analysis: analysis[0] || null,
      });
    }

    // If not found in salesCalls, check if it's a roleplay session
    const roleplay = await db
      .select()
      .from(roleplaySessions)
      .where(eq(roleplaySessions.id, callId))
      .limit(1);

    if (roleplay[0] && roleplay[0].analysisId) {
      const analysis = await db
        .select()
        .from(callAnalysis)
        .where(eq(callAnalysis.id, roleplay[0].analysisId))
        .limit(1);

      return NextResponse.json({
        status: 'completed',
        call: null,
        analysis: analysis[0] || null,
      });
    }

    // If analyzing, check if analysis is complete
    if (call[0].status === 'analyzing') {
      // Check if analysis exists
      const analysis = await db
        .select()
        .from(callAnalysis)
        .where(eq(callAnalysis.callId, callId))
        .limit(1);

      if (analysis[0]) {
        // Analysis complete
        return NextResponse.json({
          status: 'completed',
          call: {
            ...call[0],
            status: 'completed',
          },
          analysis: analysis[0],
        });
      } else {
        // Still analyzing
        return NextResponse.json({
          status: 'analyzing',
          call: call[0],
          message: 'Analysis in progress...',
        });
      }
    }

    // If failed
    if (call[0].status === 'failed') {
      return NextResponse.json({
        status: 'failed',
        call: call[0],
        error: 'Call processing failed',
      });
    }

    // Return current status
    return NextResponse.json({
      status: call[0].status,
      call: call[0],
    });
  } catch (error: any) {
    console.error('Error checking call status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check status' },
      { status: 500 }
    );
  }
}
