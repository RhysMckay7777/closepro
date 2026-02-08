import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { salesCalls, callAnalysis, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/** Safely parse a value that may be a JSON string or already-parsed object */
function safeParse<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined) return fallback;
  if (typeof val !== 'string') return val as T;
  try { return JSON.parse(val) as T; } catch { return fallback; }
}

export const maxDuration = 60;

/**
 * Get call details and analysis
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

    // Get call with user info
    const call = await db
      .select({
        id: salesCalls.id,
        fileName: salesCalls.fileName,
        fileUrl: salesCalls.fileUrl,
        fileSize: salesCalls.fileSize,
        duration: salesCalls.duration,
        status: salesCalls.status,
        transcript: salesCalls.transcript,
        transcriptJson: salesCalls.transcriptJson,
        metadata: salesCalls.metadata,
        createdAt: salesCalls.createdAt,
        completedAt: salesCalls.completedAt,
        userId: salesCalls.userId,
        userName: users.name,
        userEmail: users.email,
      })
      .from(salesCalls)
      .innerJoin(users, eq(salesCalls.userId, users.id))
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

    // Get analysis if available
    const analysis = await db
      .select()
      .from(callAnalysis)
      .where(eq(callAnalysis.callId, callId))
      .limit(1);

    let analysisData = null;
    if (analysis[0]) {
      const skillScoresRaw = safeParse(analysis[0].skillScores, null);
      const categoryScores = skillScoresRaw && typeof skillScoresRaw === 'object' && !Array.isArray(skillScoresRaw)
        ? skillScoresRaw
        : {};
      const objectionDetailsRaw = analysis[0].objectionDetails;
      const objections = safeParse(objectionDetailsRaw, []);
      analysisData = {
        overallScore: analysis[0].overallScore,
        categoryScores,
        objections,
        prospectDifficulty: analysis[0].prospectDifficulty ?? undefined,
        prospectDifficultyTier: analysis[0].prospectDifficultyTier ?? undefined,
        skillScores: categoryScores,
        coachingRecommendations: safeParse(analysis[0].coachingRecommendations, []),
        timestampedFeedback: safeParse(analysis[0].timestampedFeedback, []),
      };
    }

    return NextResponse.json({
      call: {
        ...call[0],
        createdAt: call[0].createdAt.toISOString(),
        completedAt: call[0].completedAt ? call[0].completedAt.toISOString() : null,
      },
      analysis: analysisData,
    });
  } catch (error: any) {
    console.error('Error fetching call details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch call details' },
      { status: 500 }
    );
  }
}

/**
 * Delete a call
 */
export async function DELETE(
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

    // Verify call belongs to user (explicit columns for DBs without offer_id etc.)
    const call = await db
      .select({ id: salesCalls.id })
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

    // Delete analysis first (if exists)
    await db
      .delete(callAnalysis)
      .where(eq(callAnalysis.callId, callId));

    // Delete call
    await db
      .delete(salesCalls)
      .where(eq(salesCalls.id, callId));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting call:', error);
    return NextResponse.json(
      { error: 'Failed to delete call' },
      { status: 500 }
    );
  }
}
