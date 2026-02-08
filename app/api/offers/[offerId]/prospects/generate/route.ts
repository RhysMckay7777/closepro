import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { offers, prospectAvatars, userOrganizations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateRandomProspectInBand, getDefaultBioForDifficulty, generateRandomProspectName } from '@/lib/ai/roleplay/prospect-avatar';
import { generateImage, buildProspectAvatarPrompt, isNanoBananaConfigured } from '@/lib/nanobanana';
import { generateImageWithGemini, buildGeminiAvatarPrompt, isGeminiImageConfigured } from '@/lib/gemini-image';

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
      // Only delete AI-generated prospects — preserve user-created and transcript-derived
      await db
        .delete(prospectAvatars)
        .where(
          and(
            eq(prospectAvatars.offerId, offerId),
            eq(prospectAvatars.sourceType, 'auto_generated')
          )
        );
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

    // Generate human photos: try NanoBanana first, then Gemini as fallback
    const useNanoBanana = isNanoBananaConfigured();
    const useGemini = isGeminiImageConfigured();

    if (useNanoBanana || useGemini) {
      const provider = useNanoBanana ? 'NanoBanana' : 'Gemini';
      console.log(`[prospects/generate] ${provider} configured, generating human photos for`, generatedProspects.length, 'prospects');

      for (const prospect of generatedProspects) {
        let imageUrl: string | null = null;
        let usedProvider = '';

        // Try NanoBanana first
        if (useNanoBanana) {
          try {
            const { url } = await generateImage({
              prompt: buildProspectAvatarPrompt(prospect.name, prospect.positionDescription),
              num: 1,
              image_size: '1:1',
            });
            imageUrl = url;
            usedProvider = 'NanoBanana';
          } catch (err: any) {
            console.error('[prospects/generate] NanoBanana failed:', err?.message);
          }
        }

        // Fallback to Gemini if NanoBanana failed or not configured
        if (!imageUrl && useGemini) {
          try {
            const { url } = await generateImageWithGemini({
              prompt: buildGeminiAvatarPrompt(prospect.name, prospect.positionDescription),
            });
            imageUrl = url;
            usedProvider = 'Gemini';
          } catch (err: any) {
            console.error('[prospects/generate] Gemini failed:', err?.message);
          }
        }

        // Save if we got an image
        if (imageUrl) {
          await db
            .update(prospectAvatars)
            .set({ avatarUrl: imageUrl, updatedAt: new Date() })
            .where(eq(prospectAvatars.id, prospect.id));
          (prospect as { avatarUrl?: string }).avatarUrl = imageUrl;
          console.log(`[prospects/generate] Human photo saved for ${prospect.name} via ${usedProvider}`);
        }
      }
    } else {
      console.log('[prospects/generate] No image API configured (set NANOBANANA_API_KEY or GOOGLE_AI_STUDIO_KEY)');
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
