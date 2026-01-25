import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { prospectAvatars } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { users, userOrganizations } from '@/db/schema';
import { calculateDifficultyIndex, mapDifficultySelectionToProfile } from '@/lib/ai/roleplay/prospect-avatar';

/**
 * GET - List all prospect avatars for user's organization
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

    // Get user's organizations
    const userOrgs = await db
      .select()
      .from(userOrganizations)
      .where(eq(userOrganizations.userId, session.user.id));

    const orgIds = userOrgs.map(uo => uo.organizationId);

    if (orgIds.length === 0) {
      return NextResponse.json({ avatars: [] });
    }

    // Get all avatars for user's organizations
    const avatarsList = await db
      .select()
      .from(prospectAvatars)
      .where(
        and(
          orgIds.length > 0 ? eq(prospectAvatars.organizationId, orgIds[0]) : undefined,
          eq(prospectAvatars.isActive, true)
        )
      )
      .orderBy(desc(prospectAvatars.createdAt));

    // Filter by organization IDs if multiple
    const filteredAvatars = orgIds.length > 1
      ? avatarsList.filter(a => orgIds.includes(a.organizationId))
      : avatarsList;

    return NextResponse.json({
      avatars: filteredAvatars,
    });
  } catch (error: any) {
    console.error('Error fetching prospect avatars:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch avatars' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new prospect avatar
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
      name,
      positionProblemAlignment,
      painAmbitionIntensity,
      perceivedNeedForHelp,
      authorityLevel,
      funnelContext,
      positionDescription,
      problems,
      painDrivers,
      ambitionDrivers,
      resistanceStyle,
      behaviouralBaseline,
      sourceType = 'manual',
      sourceTranscriptId,
      isTemplate = false,
    } = body;

    // Get user's primary organization
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

    // Get primary organization
    const userOrg = await db
      .select()
      .from(userOrganizations)
      .where(
        and(
          eq(userOrganizations.userId, session.user.id),
          eq(userOrganizations.isPrimary, true)
        )
      )
      .limit(1);

    const organizationId = userOrg[0]?.organizationId || user[0].organizationId;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'No organization found. Please create an organization first.' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!name || positionProblemAlignment === undefined || painAmbitionIntensity === undefined ||
        perceivedNeedForHelp === undefined || !authorityLevel || funnelContext === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: name, positionProblemAlignment, painAmbitionIntensity, perceivedNeedForHelp, authorityLevel, funnelContext' },
        { status: 400 }
      );
    }

    // Calculate difficulty index and tier
    const { index: difficultyIndex, tier: difficultyTier } = calculateDifficultyIndex(
      positionProblemAlignment,
      painAmbitionIntensity,
      perceivedNeedForHelp,
      authorityLevel,
      funnelContext
    );

    // Create avatar
    const [newAvatar] = await db
      .insert(prospectAvatars)
      .values({
        organizationId,
        userId: session.user.id,
        name,
        sourceType,
        sourceTranscriptId: sourceTranscriptId || null,
        positionProblemAlignment,
        painAmbitionIntensity,
        perceivedNeedForHelp,
        authorityLevel,
        funnelContext,
        difficultyIndex,
        difficultyTier,
        positionDescription: positionDescription || null,
        problems: problems ? JSON.stringify(problems) : null,
        painDrivers: painDrivers ? JSON.stringify(painDrivers) : null,
        ambitionDrivers: ambitionDrivers ? JSON.stringify(ambitionDrivers) : null,
        resistanceStyle: resistanceStyle ? JSON.stringify(resistanceStyle) : null,
        behaviouralBaseline: behaviouralBaseline ? JSON.stringify(behaviouralBaseline) : null,
        isTemplate,
        isActive: true,
      })
      .returning();

    return NextResponse.json({
      avatar: newAvatar,
      message: 'Prospect avatar created successfully',
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating prospect avatar:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create avatar' },
      { status: 500 }
    );
  }
}
