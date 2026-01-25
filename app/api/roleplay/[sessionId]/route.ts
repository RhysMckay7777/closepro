import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { roleplaySessions, roleplayMessages, offers, prospectAvatars, roleplayAnalysis } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * GET - Get roleplay session details and messages
 */
export async function GET(
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

    // Get messages
    const messages = await db
      .select()
      .from(roleplayMessages)
      .where(eq(roleplayMessages.sessionId, sessionId))
      .orderBy(roleplayMessages.createdAt);

    // Get offer details
    const offer = await db
      .select()
      .from(offers)
      .where(eq(offers.id, roleplay[0].offerId))
      .limit(1);

    // Get prospect avatar if exists
    let prospectAvatar = null;
    if (roleplay[0].prospectAvatarId) {
      const avatar = await db
        .select()
        .from(prospectAvatars)
        .where(eq(prospectAvatars.id, roleplay[0].prospectAvatarId))
        .limit(1);
      prospectAvatar = avatar[0] || null;
    }

    // Get roleplay analysis if session has been scored
    let analysis = null;
    if (roleplay[0].analysisId) {
      const analysisRows = await db
        .select()
        .from(roleplayAnalysis)
        .where(eq(roleplayAnalysis.id, roleplay[0].analysisId))
        .limit(1);
      analysis = analysisRows[0] || null;
    }

    const sessionWithOffer = {
      ...roleplay[0],
      offerName: offer[0]?.name ?? null,
    };

    return NextResponse.json({
      session: sessionWithOffer,
      messages,
      offer: offer[0] || null,
      prospectAvatar,
      analysis,
    });
  } catch (error: any) {
    console.error('Error fetching roleplay session:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch session' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update roleplay session (end session, update status)
 */
export async function PATCH(
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

    const body = await request.json();
    const { status, overallScore, analysisId } = body;

    // Verify session belongs to user
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

    // Update session
    const updateData: any = {};
    if (status) updateData.status = status;
    if (overallScore !== undefined) updateData.overallScore = overallScore;
    if (analysisId) updateData.analysisId = analysisId;
    if (status === 'completed') updateData.completedAt = new Date();

    const [updated] = await db
      .update(roleplaySessions)
      .set(updateData)
      .where(eq(roleplaySessions.id, sessionId))
      .returning();

    return NextResponse.json({
      session: updated,
      message: 'Session updated',
    });
  } catch (error: any) {
    console.error('Error updating roleplay session:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update session' },
      { status: 500 }
    );
  }
}
