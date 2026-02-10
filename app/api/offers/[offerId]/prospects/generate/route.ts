import { NextRequest, NextResponse, after } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { offers, prospectAvatars, userOrganizations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateRandomProspectInBand, getDefaultBioForDifficulty, generateRandomProspectName, inferGenderFromOffer } from '@/lib/ai/roleplay/prospect-avatar';
import { generateImageWithGemini, buildGeminiAvatarPrompt, isGeminiImageConfigured } from '@/lib/gemini-image';

export const maxDuration = 300;

/**
 * POST - Auto-generate 4 prospects (Easy/Realistic/Hard/Expert) for an offer.
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
      // Delete ALL existing prospects for this offer (including manually created)
      await db
        .delete(prospectAvatars)
        .where(eq(prospectAvatars.offerId, offerId));
    }

    // Generate 4 prospects: Easy, Realistic, Hard, Expert (with bios)
    const difficulties: Array<'easy' | 'realistic' | 'hard' | 'expert'> = ['easy', 'realistic', 'hard', 'expert'];
    const generatedProspects = [];
    const usedNames = new Set<string>();
    const prospectGender = inferGenderFromOffer(offer[0].whoItsFor);
    console.log('[PROSPECT GEN] Gender inferred from whoItsFor:', JSON.stringify(offer[0].whoItsFor), '→', prospectGender);

    const VALID_TIERS = new Set(['easy', 'realistic', 'hard', 'expert']);

    for (const difficulty of difficulties) {
      const prospectProfile = generateRandomProspectInBand(difficulty);
      // Validate difficulty tier — map any invalid values to the expected tier
      const tierStr = prospectProfile.difficultyTier as string;
      if (!VALID_TIERS.has(tierStr)) {
        prospectProfile.difficultyTier = (tierStr === 'near_impossible' || tierStr === 'elite') ? 'expert' : difficulty;
      }
      const name = generateRandomProspectName(usedNames, prospectGender);
      const positionDescription = getDefaultBioForDifficulty(prospectProfile.difficultyTier, name, {
        offerCategory: offer[0].offerCategory ?? undefined,
        whoItsFor: offer[0].whoItsFor ?? undefined,
        coreProblems: offer[0].coreProblems ?? undefined,
        offerName: offer[0].name ?? undefined,
      }, prospectGender);

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

    // Return prospects immediately so the page loads fast
    // Image generation happens in the background (fire-and-forget)
    const geminiConfigured = isGeminiImageConfigured();
    const responsePayload = {
      prospects: generatedProspects,
      message: regenerate
        ? 'Prospects regenerated with bios.'
        : 'Successfully generated 4 prospects with bios.',
      imageGenStatus: geminiConfigured ? 'generating' as const : 'not_configured' as const,
    };

    // Generate human photos in the background via Gemini (Google AI Studio)
    console.log(`[prospects/generate] Checking Gemini config for background image gen...`);
    const geminiReady = isGeminiImageConfigured();
    console.log(`[prospects/generate] Gemini configured: ${geminiReady}`);

    if (geminiReady) {
      console.log(`[prospects/generate] Scheduling after() for background image generation...`);
      after(async () => {
        console.log(`[prospects/generate after()] Background image generation STARTED`);
        try {
          const allProspects = await db
            .select()
            .from(prospectAvatars)
            .where(eq(prospectAvatars.offerId, offerId));

          const prospectsToPhoto = allProspects.filter(p => !p.avatarUrl);
          console.log(`[prospects/generate after()] Found ${prospectsToPhoto.length} prospects needing photos (out of ${allProspects.length} total)`);

          for (let i = 0; i < prospectsToPhoto.length; i++) {
            const prospect = prospectsToPhoto[i];
            // Add delay between API calls to avoid rate limiting (skip first)
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, 3000));
            }
            console.log(`[prospects/generate after()] Generating image for: ${prospect.name} (${i + 1}/${prospectsToPhoto.length})...`);
            try {
              const { url } = await generateImageWithGemini({
                prompt: buildGeminiAvatarPrompt(prospect.name, prospect.positionDescription, prospectGender),
              });
              if (url) {
                await db
                  .update(prospectAvatars)
                  .set({ avatarUrl: url, updatedAt: new Date() })
                  .where(eq(prospectAvatars.id, prospect.id));
                console.log(`[prospects/generate after()] ✅ Human photo saved for ${prospect.name}, URL starts with: ${url.slice(0, 50)}`);
              }
            } catch (err: any) {
              console.error(`[prospects/generate after()] ❌ Gemini failed for ${prospect.name}:`, err?.message);
            }
          }
          console.log(`[prospects/generate after()] Background image generation COMPLETED`);
        } catch (err) {
          console.error('[prospects/generate after()] Background image generation FAILED:', err);
        }
      });
    } else {
      console.log('[prospects/generate] ⚠️ No image API configured (set GOOGLE_AI_STUDIO_KEY in Vercel env vars)');
    }

    return NextResponse.json(responsePayload);
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
