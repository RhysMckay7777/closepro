import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { offers, prospectAvatars, userOrganizations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateRandomProspectInBand, generateProspectContext, generateRandomProspectName, inferGenderFromOffer, resolveProspectGender } from '@/lib/ai/roleplay/prospect-avatar';

export const maxDuration = 300;

/**
 * POST - Auto-generate 4 prospects (Easy/Realistic/Hard/Expert) for an offer.
 * Body: { regenerate?: boolean } — if true, delete existing prospects and generate new ones (with bios).
 *
 * Returns the prospects immediately (bios only, no images).
 * The frontend is responsible for calling /api/prospect-avatars/batch-generate
 * to generate all avatar images before rendering cards.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  try {
    const { offerId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get offer
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

    // Verify user has access
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

    let body: { regenerate?: boolean } = {};
    try {
      body = await request.json();
    } catch {
      // no body
    }
    const url = new URL(request.url);
    const regenerate =
      body?.regenerate === true || url.searchParams.get('regenerate') === 'true';

    // Check if prospects already exist (unless regenerating)
    const existingProspects = await db
      .select()
      .from(prospectAvatars)
      .where(eq(prospectAvatars.offerId, offerId))
      .limit(1);

    if (existingProspects.length > 0 && !regenerate) {
      return NextResponse.json(
        { error: 'Prospects already exist for this offer. Use regenerate: true to replace them with new prospects (including bios).' },
        { status: 400 }
      );
    }

    if (regenerate) {
      // Delete ALL existing prospects for this offer (including manually created)
      await db
        .delete(prospectAvatars)
        .where(eq(prospectAvatars.offerId, offerId));
    }

    // Generate 4 prospects: Easy, Realistic, Hard, Expert (with bios)
    const difficulties: Array<'easy' | 'realistic' | 'hard' | 'expert'> = ['easy', 'realistic', 'hard', 'expert'];
    const generatedProspects = [];
    const usedNames = new Set<string>();
    const offerGender = inferGenderFromOffer(offer[0].whoItsFor);
    console.log('[PROSPECT GEN] Offer-level gender hint:', JSON.stringify(offer[0].whoItsFor), '→', offerGender);

    const VALID_TIERS = new Set(['easy', 'realistic', 'hard', 'expert', 'near_impossible']);

    for (const difficulty of difficulties) {
      const prospectProfile = generateRandomProspectInBand(difficulty);
      // Validate difficulty tier — map any invalid values to the expected tier
      const tierStr = prospectProfile.difficultyTier as string;
      if (!VALID_TIERS.has(tierStr)) {
        prospectProfile.difficultyTier = (tierStr === 'elite') ? 'expert' : difficulty;
      }
      const name = generateRandomProspectName(usedNames, offerGender);

      // Resolve per-prospect binary gender from name (not offer-level)
      const gender = resolveProspectGender(name, offerGender);

      const positionDescription = generateProspectContext({
        name,
        gender,
        positionProblemAlignment: prospectProfile.positionProblemAlignment,
        painAmbitionIntensity: prospectProfile.painAmbitionIntensity,
        perceivedNeedForHelp: prospectProfile.perceivedNeedForHelp,
        authorityLevel: prospectProfile.authorityLevel,
        funnelContext: prospectProfile.funnelContext,
        executionResistance: prospectProfile.executionResistance,
        difficultyTier: prospectProfile.difficultyTier,
        offer: {
          offerCategory: offer[0].offerCategory ?? undefined,
          whoItsFor: offer[0].whoItsFor ?? undefined,
          coreProblems: offer[0].coreProblems ?? undefined,
          offerName: offer[0].name ?? undefined,
        },
      });

      const [newProspect] = await db
        .insert(prospectAvatars)
        .values({
          organizationId: offer[0].organizationId,
          offerId: offerId,
          userId: session.user.id,
          name,
          gender,
          sourceType: 'auto_generated',
          positionProblemAlignment: prospectProfile.positionProblemAlignment,
          painAmbitionIntensity: prospectProfile.painAmbitionIntensity,
          perceivedNeedForHelp: prospectProfile.perceivedNeedForHelp,
          authorityLevel: prospectProfile.authorityLevel,
          funnelContext: prospectProfile.funnelContext,
          executionResistance: prospectProfile.executionResistance,
          difficultyIndex: prospectProfile.difficultyIndex,
          difficultyTier: prospectProfile.difficultyTier,
          positionDescription,
          isTemplate: false,
          isActive: true,
        })
        .returning();

      generatedProspects.push(newProspect);
    }

    // Return prospects immediately — frontend will call batch-generate for images
    return NextResponse.json({
      prospects: generatedProspects,
      message: regenerate
        ? 'Prospects regenerated with bios.'
        : 'Successfully generated 4 prospects with bios.',
    });
  } catch (error: any) {
    logger.error('PROSPECT_BUILDER', 'Failed to generate prospects', error);
    const msg = error?.message ?? '';
    const code = error?.code ?? error?.errno;
    // Session/auth failure (e.g. BETTER_AUTH_URL unreachable in dev) → 401 so client can redirect to login
    if (msg.includes('session') || msg.includes('Failed to get session') || error?.name === 'APIError') {
      return NextResponse.json({ error: 'Session unavailable. Please sign in again.' }, { status: 401 });
    }
    // Network unreachable (e.g. DB or auth host down)
    if (code === 'EHOSTUNREACH' || code === 'ECONNREFUSED' || code === 'ETIMEDOUT') {
      return NextResponse.json(
        { error: 'Service temporarily unreachable. Check BETTER_AUTH_URL and database connectivity.' },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: error.message || 'Failed to generate prospects' },
      { status: 500 }
    );
  }
}
