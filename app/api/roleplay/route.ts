import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { roleplaySessions, offers, prospectAvatars } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { users, organizations, userOrganizations } from '@/db/schema';
import { generateRandomProspectInBand, calculateDifficultyIndex } from '@/lib/ai/roleplay/prospect-avatar';

/**
 * GET - List all roleplay sessions for user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's organization
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user[0]) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    let organizationId = user[0].organizationId;
    if (!organizationId) {
      const firstOrg = await db
        .select()
        .from(userOrganizations)
        .where(eq(userOrganizations.userId, user[0].id))
        .limit(1);
      
      if (!firstOrg[0]) {
        return NextResponse.json({ sessions: [] });
      }
      organizationId = firstOrg[0].organizationId;
    }

    // Get all roleplay sessions for user
    const sessions = await db
      .select({
        id: roleplaySessions.id,
        mode: roleplaySessions.mode,
        status: roleplaySessions.status,
        inputMode: roleplaySessions.inputMode,
        selectedDifficulty: roleplaySessions.selectedDifficulty,
        actualDifficultyTier: roleplaySessions.actualDifficultyTier,
        overallScore: roleplaySessions.overallScore,
        offerId: roleplaySessions.offerId,
        prospectAvatarId: roleplaySessions.prospectAvatarId,
        startedAt: roleplaySessions.startedAt,
        completedAt: roleplaySessions.completedAt,
        createdAt: roleplaySessions.createdAt,
      })
      .from(roleplaySessions)
      .where(
        and(
          eq(roleplaySessions.organizationId, organizationId),
          eq(roleplaySessions.userId, session.user.id)
        )
      )
      .orderBy(desc(roleplaySessions.createdAt))
      .limit(50);

    // Get offer names and types for sessions
    const offerIds = [...new Set(sessions.map(s => s.offerId).filter(Boolean))];
    const offersMap = new Map();
    if (offerIds.length > 0) {
      const offersList = await db
        .select({ id: offers.id, name: offers.name, offerCategory: offers.offerCategory })
        .from(offers)
        .where(eq(offers.id, offerIds[0] as string));
      
      for (const offer of offersList) {
        offersMap.set(offer.id, { name: offer.name, category: offer.offerCategory });
      }
    }

    const sessionsWithOffers = sessions.map(s => {
      const offer = offersMap.get(s.offerId);
      return {
        ...s,
        offerName: offer?.name || 'Unknown Offer',
        offerType: offer?.category || 'Unknown',
      };
    });

    return NextResponse.json({ sessions: sessionsWithOffers });
  } catch (error: any) {
    console.error('Error fetching roleplay sessions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new roleplay session
 */
export async function POST(request: NextRequest) {
  try {
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
    const {
      offerId,
      prospectAvatarId,
      selectedDifficulty,
      inputMode = 'text',
      mode = 'manual',
      sourceCallId,
    } = body;

    // Require offerId - no default offers
    if (!offerId) {
      return NextResponse.json(
        { error: 'offerId is required. All roleplays must be associated with an offer.' },
        { status: 400 }
      );
    }

    // Get user's organization
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user[0]) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    let organizationId = user[0].organizationId;
    if (!organizationId) {
      const firstOrg = await db
        .select()
        .from(userOrganizations)
        .where(eq(userOrganizations.userId, user[0].id))
        .limit(1);
      
      if (!firstOrg[0]) {
        return NextResponse.json(
          { error: 'No organization found' },
          { status: 404 }
        );
      }
      organizationId = firstOrg[0].organizationId;
    }

    // Verify offer exists and user has access
    const offerResult = await db
      .select()
      .from(offers)
      .where(eq(offers.id, offerId))
      .limit(1);
    
    if (!offerResult[0]) {
      return NextResponse.json(
        { error: 'Offer not found' },
        { status: 404 }
      );
    }

    const offer = offerResult[0];
    
    // Verify user has access to the offer
    const userOrg = await db
      .select()
      .from(userOrganizations)
      .where(eq(userOrganizations.userId, session.user.id))
      .limit(1);
    
    const userOrgIds = userOrg.map(uo => uo.organizationId);
    if (!userOrgIds.includes(offer.organizationId)) {
      return NextResponse.json(
        { error: 'Access denied to this offer' },
        { status: 403 }
      );
    }

    // Generate or get prospect avatar
    let finalProspectAvatarId = prospectAvatarId;
    let actualDifficultyTier = selectedDifficulty || 'realistic';

    if (!prospectAvatarId && selectedDifficulty) {
      // Generate random prospect within difficulty band
      const prospectProfile = generateRandomProspectInBand(selectedDifficulty);
      
      // Create prospect avatar scoped to the offer
      const [newAvatar] = await db
        .insert(prospectAvatars)
        .values({
          organizationId: offer.organizationId,
          offerId: offerId,
          userId: session.user.id,
          name: `Generated Prospect (${selectedDifficulty})`,
          sourceType: 'auto_generated',
          positionProblemAlignment: prospectProfile.positionProblemAlignment,
          painAmbitionIntensity: prospectProfile.painAmbitionIntensity,
          perceivedNeedForHelp: prospectProfile.perceivedNeedForHelp,
          authorityLevel: prospectProfile.authorityLevel,
          funnelContext: prospectProfile.funnelContext,
          executionResistance: prospectProfile.executionResistance,
          difficultyIndex: prospectProfile.difficultyIndex,
          difficultyTier: prospectProfile.difficultyTier,
          isTemplate: false,
          isActive: true,
        })
        .returning();
      
      finalProspectAvatarId = newAvatar.id;
      actualDifficultyTier = newAvatar.difficultyTier;
    } else if (prospectAvatarId) {
      // Get existing avatar and validate it belongs to the offer
      const avatar = await db
        .select()
        .from(prospectAvatars)
        .where(
          and(
            eq(prospectAvatars.id, prospectAvatarId),
            eq(prospectAvatars.offerId, offerId)
          )
        )
        .limit(1);
      
      if (!avatar[0]) {
        return NextResponse.json(
          { error: 'Prospect not found or does not belong to this offer' },
          { status: 404 }
        );
      }
      
      actualDifficultyTier = avatar[0].difficultyTier;
    }

    // Create roleplay session
    const [newSession] = await db
      .insert(roleplaySessions)
      .values({
        organizationId: offer.organizationId,
        userId: session.user.id,
        offerId: offerId,
        prospectAvatarId: finalProspectAvatarId || null,
        selectedDifficulty: selectedDifficulty || 'realistic',
        actualDifficultyTier,
        mode: mode || 'manual',
        sourceCallId: sourceCallId || null,
        inputMode: inputMode || 'text',
        status: 'in_progress',
      })
      .returning();

    return NextResponse.json({
      session: newSession,
      message: 'Roleplay session created',
    });
  } catch (error: any) {
    console.error('Error creating roleplay session:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create session' },
      { status: 500 }
    );
  }
}
