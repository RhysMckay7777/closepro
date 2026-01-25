import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { salesCalls, callAnalysis, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

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
      analysisData = {
        overallScore: analysis[0].overallScore,
        value: analysis[0].valueDetails ? JSON.parse(analysis[0].valueDetails) : null,
        trust: analysis[0].trustDetails ? JSON.parse(analysis[0].trustDetails) : null,
        fit: analysis[0].fitDetails ? JSON.parse(analysis[0].fitDetails) : null,
        logistics: analysis[0].logisticsDetails ? JSON.parse(analysis[0].logisticsDetails) : null,
        skillScores: analysis[0].skillScores ? JSON.parse(analysis[0].skillScores) : [],
        coachingRecommendations: analysis[0].coachingRecommendations 
          ? JSON.parse(analysis[0].coachingRecommendations) 
          : [],
        timestampedFeedback: analysis[0].timestampedFeedback 
          ? JSON.parse(analysis[0].timestampedFeedback) 
          : [],
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

    // Verify call belongs to user
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
