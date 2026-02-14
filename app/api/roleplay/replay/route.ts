import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { salesCalls, callAnalysis, prospectAvatars, roleplaySessions, users, userOrganizations, offers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const maxDuration = 30;

/**
 * POST /api/roleplay/replay
 * Body: { callId: string }
 * Creates a new roleplay session using prospect data from an analyzed call.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { callId } = body;

    if (!callId) {
      return NextResponse.json({ error: 'callId is required' }, { status: 400 });
    }

    // Fetch the call
    const callRows = await db
      .select()
      .from(salesCalls)
      .where(and(eq(salesCalls.id, callId), eq(salesCalls.userId, session.user.id)))
      .limit(1);

    if (!callRows[0]) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    }

    const call = callRows[0];

    // Fetch the analysis
    const analysisRows = await db
      .select()
      .from(callAnalysis)
      .where(eq(callAnalysis.callId, callId))
      .limit(1);

    if (!analysisRows[0]) {
      return NextResponse.json({ error: 'Call analysis not found' }, { status: 404 });
    }

    const analysis = analysisRows[0];

    // Parse prospectDifficultyJustifications
    let justifications: any = null;
    try {
      justifications = typeof analysis.prospectDifficultyJustifications === 'string'
        ? JSON.parse(analysis.prospectDifficultyJustifications)
        : analysis.prospectDifficultyJustifications;
    } catch { /* ignore */ }

    if (!justifications) {
      return NextResponse.json({ error: 'Call has no prospect difficulty data for replay' }, { status: 400 });
    }

    const prospectName = call.prospectName || 'Unknown Prospect';
    const prospectContextSummary = justifications.prospectContextSummary || '';
    const dimensionScores = justifications.dimensionScores || {};
    const difficultyTier = analysis.prospectDifficultyTier || 'realistic';
    const difficultyTotal = analysis.prospectDifficulty || 25;

    // Get user's organization
    const user = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
    if (!user[0]) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let organizationId = user[0].organizationId;
    if (!organizationId) {
      const firstOrg = await db
        .select()
        .from(userOrganizations)
        .where(eq(userOrganizations.userId, user[0].id))
        .limit(1);
      if (!firstOrg[0]) {
        return NextResponse.json({ error: 'No organization found' }, { status: 404 });
      }
      organizationId = firstOrg[0].organizationId;
    }

    // Require offerId
    const offerId = call.offerId;
    if (!offerId) {
      return NextResponse.json({ error: 'Call has no associated offer. Cannot replay without an offer.' }, { status: 400 });
    }

    // Verify offer exists
    const offerResult = await db.select().from(offers).where(eq(offers.id, offerId)).limit(1);
    if (!offerResult[0]) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }

    // Check if a prospect avatar already exists with the same name for this user + offer
    let prospectAvatarId: string | null = null;

    const existingAvatars = await db
      .select()
      .from(prospectAvatars)
      .where(
        and(
          eq(prospectAvatars.name, prospectName),
          eq(prospectAvatars.offerId, offerId),
          eq(prospectAvatars.userId, session.user.id),
        )
      )
      .limit(1);

    if (existingAvatars[0]) {
      prospectAvatarId = existingAvatars[0].id;
    } else {
      // Create a new prospect avatar from the call analysis data
      const [newAvatar] = await db
        .insert(prospectAvatars)
        .values({
          organizationId: organizationId,
          offerId: offerId,
          userId: session.user.id,
          name: prospectName,
          sourceType: 'transcript_derived',
          sourceTranscriptId: callId,
          positionDescription: prospectContextSummary || undefined,
          // Map dimension scores to avatar fields
          // icpAlignment → positionProblemAlignment
          positionProblemAlignment: dimensionScores.icpAlignment ?? 5,
          // motivationIntensity → painAmbitionIntensity
          painAmbitionIntensity: dimensionScores.motivationIntensity ?? 5,
          // funnelContext → funnelContext
          funnelContext: dimensionScores.funnelContext ?? 5,
          // authorityAndCoachability → authorityLevel (map score to tier)
          authorityLevel: (dimensionScores.authorityAndCoachability ?? 5) >= 7 ? 'advisee'
            : (dimensionScores.authorityAndCoachability ?? 5) >= 4 ? 'peer'
            : 'advisor',
          // perceivedNeedForHelp — derived from motivationIntensity
          perceivedNeedForHelp: dimensionScores.motivationIntensity ?? 5,
          // abilityToProceed → executionResistance
          executionResistance: dimensionScores.abilityToProceed ?? 5,
          difficultyIndex: difficultyTotal,
          difficultyTier: difficultyTier,
          isTemplate: false,
          isActive: true,
        })
        .returning();

      prospectAvatarId = newAvatar.id;
    }

    // Create the roleplay session
    const [newSession] = await db
      .insert(roleplaySessions)
      .values({
        organizationId: organizationId,
        userId: session.user.id,
        offerId: offerId,
        prospectAvatarId: prospectAvatarId,
        selectedDifficulty: difficultyTier,
        actualDifficultyTier: difficultyTier,
        mode: 'manual',
        sourceCallId: callId,
        inputMode: 'voice',
        status: 'in_progress',
        metadata: JSON.stringify({ replayFromCallId: callId, difficultyTier }),
      })
      .returning();

    return NextResponse.json({ sessionId: newSession.id });
  } catch (error: any) {
    console.error('[Replay API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create replay session' },
      { status: 500 }
    );
  }
}
