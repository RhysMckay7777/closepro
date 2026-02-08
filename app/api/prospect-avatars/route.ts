import { NextRequest, NextResponse, after } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { prospectAvatars, offers } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { users, userOrganizations } from '@/db/schema';
import { calculateDifficultyIndex, mapDifficultySelectionToProfile } from '@/lib/ai/roleplay/prospect-avatar';
import { generateImageWithGemini, buildGeminiAvatarPrompt, isGeminiImageConfigured } from '@/lib/gemini-image';

export const maxDuration = 120;

/**
 * GET - List all prospect avatars for a specific offer
 * Requires offerId query parameter
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

    const { searchParams } = new URL(request.url);
    const offerId = searchParams.get('offerId');

    if (!offerId) {
      return NextResponse.json(
        { error: 'offerId query parameter is required' },
        { status: 400 }
      );
    }

    // Verify offer exists and user has access
    const offer = await db
      .select()
      .from(offers)
      .where(eq(offers.id, offerId))
      .limit(1);

    if (!offer[0]) {
      return NextResponse.json(
        { error: 'Offer not found' },
        { status: 404 }
      );
    }

    const userOrg = await db
      .select()
      .from(userOrganizations)
      .where(eq(userOrganizations.userId, session.user.id))
      .limit(1);

    const userOrgIds = userOrg.map(uo => uo.organizationId);
    if (!userOrgIds.includes(offer[0].organizationId)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get all avatars for this offer
    const avatarsList = await db
      .select()
      .from(prospectAvatars)
      .where(
        and(
          eq(prospectAvatars.offerId, offerId),
          eq(prospectAvatars.isActive, true)
        )
      )
      .orderBy(desc(prospectAvatars.createdAt));

    return NextResponse.json({
      avatars: avatarsList,
    });
  } catch (error: any) {
    console.error('Error fetching prospect avatars:', error);
    const msg = error?.message ?? '';
    const code = error?.code ?? error?.errno;
    if (msg.includes('session') || msg.includes('Failed to get session') || error?.name === 'APIError') {
      return NextResponse.json({ error: 'Session unavailable. Please sign in again.' }, { status: 401 });
    }
    if (code === 'EHOSTUNREACH' || code === 'ECONNREFUSED' || code === 'ETIMEDOUT') {
      return NextResponse.json(
        { error: 'Service temporarily unreachable. Check BETTER_AUTH_URL and database connectivity.' },
        { status: 503 }
      );
    }
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
      offerId,
      name,
      positionProblemAlignment,
      painAmbitionIntensity,
      perceivedNeedForHelp,
      authorityLevel,
      funnelContext,
      executionResistance,
      positionDescription,
      voiceStyle,
      problems,
      painDrivers,
      ambitionDrivers,
      resistanceStyle,
      behaviouralBaseline,
      sourceType = 'manual',
      sourceTranscriptId,
      isTemplate = false,
    } = body;

    if (!offerId) {
      return NextResponse.json(
        { error: 'offerId is required' },
        { status: 400 }
      );
    }

    // Fetch offer and verify user has access
    const offer = await db
      .select()
      .from(offers)
      .where(eq(offers.id, offerId))
      .limit(1);

    if (!offer[0]) {
      return NextResponse.json(
        { error: 'Offer not found' },
        { status: 404 }
      );
    }

    const userOrg = await db
      .select()
      .from(userOrganizations)
      .where(eq(userOrganizations.userId, session.user.id))
      .limit(10);

    const userOrgIds = userOrg.map(uo => uo.organizationId);
    if (!userOrgIds.includes(offer[0].organizationId)) {
      return NextResponse.json(
        { error: 'Access denied to this offer' },
        { status: 403 }
      );
    }

    const organizationId = offer[0].organizationId;

    // Validate required fields
    if (!name || positionProblemAlignment === undefined || painAmbitionIntensity === undefined ||
      perceivedNeedForHelp === undefined || !authorityLevel || funnelContext === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: name, positionProblemAlignment, painAmbitionIntensity, perceivedNeedForHelp, authorityLevel, funnelContext' },
        { status: 400 }
      );
    }

    // Default execution resistance to 5 if not provided (backward compatibility)
    const finalExecutionResistance = executionResistance !== undefined ? executionResistance : 5;

    // Calculate difficulty index and tier (50-point model)
    const { index: difficultyIndex, tier: difficultyTier } = calculateDifficultyIndex(
      positionProblemAlignment,
      painAmbitionIntensity,
      perceivedNeedForHelp,
      authorityLevel,
      funnelContext,
      finalExecutionResistance
    );

    // Create avatar
    const [newAvatar] = await db
      .insert(prospectAvatars)
      .values({
        organizationId,
        offerId,
        userId: session.user.id,
        name,
        sourceType,
        sourceTranscriptId: sourceTranscriptId || null,
        positionProblemAlignment,
        painAmbitionIntensity,
        perceivedNeedForHelp,
        authorityLevel,
        funnelContext,
        executionResistance: finalExecutionResistance,
        difficultyIndex,
        difficultyTier,
        positionDescription: positionDescription || null,
        voiceStyle: typeof voiceStyle === 'string' ? voiceStyle.trim().slice(0, 200) || null : null,
        problems: problems ? JSON.stringify(problems) : null,
        painDrivers: painDrivers ? JSON.stringify(painDrivers) : null,
        ambitionDrivers: ambitionDrivers ? JSON.stringify(ambitionDrivers) : null,
        resistanceStyle: resistanceStyle ? JSON.stringify(resistanceStyle) : null,
        behaviouralBaseline: behaviouralBaseline ? JSON.stringify(behaviouralBaseline) : null,
        isTemplate,
        isActive: true,
      })
      .returning();

    // Use after() to generate avatar image in background on Vercel serverless
    if (newAvatar && isGeminiImageConfigured()) {
      after(async () => {
        try {
          const prompt = buildGeminiAvatarPrompt(newAvatar.name, newAvatar.positionDescription ?? undefined);
          const { url } = await generateImageWithGemini({ prompt });
          if (url) {
            await db
              .update(prospectAvatars)
              .set({ avatarUrl: url, updatedAt: new Date() })
              .where(eq(prospectAvatars.id, newAvatar.id));
            console.log(`[prospect-avatars] Avatar saved for ${newAvatar.name} via Gemini`);
          }
        } catch (err) {
          console.error('[prospect-avatars] Gemini avatar generation failed:', (err as Error).message);
        }
      });
    }

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
