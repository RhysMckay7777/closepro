import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { roleplaySessions, offers, prospectAvatars } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { users, organizations, userOrganizations } from '@/db/schema';

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

    // Get offer names for sessions
    const offerIds = [...new Set(sessions.map(s => s.offerId).filter(Boolean))];
    const offersMap = new Map();
    if (offerIds.length > 0) {
      const offersList = await db
        .select({ id: offers.id, name: offers.name })
        .from(offers)
        .where(eq(offers.id, offerIds[0] as string));
      
      for (const offer of offersList) {
        offersMap.set(offer.id, offer.name);
      }
    }

    const sessionsWithOffers = sessions.map(s => ({
      ...s,
      offerName: offersMap.get(s.offerId) || 'Unknown Offer',
    }));

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

    // Verify offer exists or create default
    let finalOfferId = offerId;
    let offer = null;

    if (offerId === 'default' || !offerId) {
      // Create default offer
      const [defaultOffer] = await db
        .insert(offers)
        .values({
          organizationId,
          userId: session.user.id,
          name: 'Default Practice Offer',
          offerCategory: 'b2c_wealth',
          whoItsFor: 'Aspiring entrepreneurs who want to build a high-ticket closing business',
          coreOutcome: 'Become a skilled high-ticket closer earning $10k+/month',
          mechanismHighLevel: '1-on-1 mentorship, roleplay practice, and real call analysis',
          deliveryModel: 'dwy',
          priceRange: '5000-15000',
          primaryProblemsSolved: JSON.stringify([
            'Lack of closing skills',
            'Fear of high-ticket sales',
            'No structured training',
            'Can\'t handle objections',
          ]),
        })
        .returning();
      
      offer = defaultOffer;
      finalOfferId = defaultOffer.id;
    } else {
      // Get existing offer
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
      offer = offerResult[0];
    }

    // Get prospect avatar if provided
    let actualDifficultyTier = selectedDifficulty || 'realistic';
    if (prospectAvatarId) {
      const avatar = await db
        .select()
        .from(prospectAvatars)
        .where(eq(prospectAvatars.id, prospectAvatarId))
        .limit(1);
      
      if (avatar[0]) {
        actualDifficultyTier = avatar[0].difficultyTier;
      }
    }

    // Create roleplay session
    const [newSession] = await db
      .insert(roleplaySessions)
      .values({
        organizationId,
        userId: session.user.id,
        offerId: finalOfferId,
        prospectAvatarId: prospectAvatarId || null,
        selectedDifficulty: selectedDifficulty || 'intermediate',
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
