import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { offers, prospectAvatars, userOrganizations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateRandomProspectInBand, getDefaultBioForDifficulty, generateRandomProspectName } from '@/lib/ai/roleplay/prospect-avatar';
import { generateImage, buildProspectAvatarPrompt, isNanoBananaConfigured } from '@/lib/nanobanana';

/**
 * POST - Auto-generate 4 prospects (Easy/Realistic/Hard/Elite) for an offer.
 * Body: { regenerate?: boolean } — if true, delete existing prospects and generate new ones (with bios).
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
      await db
        .delete(prospectAvatars)
        .where(eq(prospectAvatars.offerId, offerId));
    }

    // Generate 4 prospects: Easy, Realistic, Hard, Elite (with bios)
    const difficulties: Array<'easy' | 'realistic' | 'hard' | 'elite'> = ['easy', 'realistic', 'hard', 'elite'];
    const generatedProspects = [];
    const usedNames = new Set<string>();

    for (const difficulty of difficulties) {
      const prospectProfile = generateRandomProspectInBand(difficulty);
      const name = generateRandomProspectName(usedNames);
      const positionDescription = getDefaultBioForDifficulty(prospectProfile.difficultyTier, name);

      const [newProspect] = await db
        .insert(prospectAvatars)
        .values({
          organizationId: offer[0].organizationId,
          offerId: offerId,
          userId: session.user.id,
          name,
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

    // Default: generate human photos via NanoBanana when configured
    if (isNanoBananaConfigured()) {
      console.log('[prospects/generate] NanoBanana configured, generating human photos for', generatedProspects.length, 'prospects');
      for (const prospect of generatedProspects) {
        try {
          const { url } = await generateImage({
            prompt: buildProspectAvatarPrompt(prospect.name),
            num: 1,
            image_size: '1:1',
          });
          await db
            .update(prospectAvatars)
            .set({ avatarUrl: url, updatedAt: new Date() })
            .where(eq(prospectAvatars.id, prospect.id));
          (prospect as { avatarUrl?: string }).avatarUrl = url;
          console.log('[prospects/generate] Human photo saved for', prospect.name);
        } catch (err: any) {
          const msg = err?.message ?? '';
          console.error('[prospects/generate] NanoBanana failed:', msg);
          if (msg.includes('Invalid API key') || msg.includes('401')) {
            console.error('[prospects/generate] Skipping remaining prospects — fix NANOBANANA_API_KEY at https://nanobananaapi.ai/');
            break;
          }
        }
      }
    } else {
      console.log('[prospects/generate] NANOBANANA_API_KEY not set, skipping human photos');
    }

    return NextResponse.json({
      prospects: generatedProspects,
      message: regenerate
        ? 'Prospects regenerated with bios.'
        : 'Successfully generated 4 prospects with bios.',
    });
  } catch (error: any) {
    console.error('Error generating prospects:', error);
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
