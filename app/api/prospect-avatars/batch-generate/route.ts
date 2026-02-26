import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { prospectAvatars, userOrganizations } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { resolveProspectGender, inferGenderFromOffer } from '@/lib/ai/roleplay/prospect-avatar';
import { generateImageWithGemini, buildGeminiAvatarPrompt, isGeminiImageConfigured } from '@/lib/gemini-image';

export const maxDuration = 300;

/**
 * POST - Batch generate avatar images for multiple prospects in parallel.
 * Body: { prospectIds: string[] }
 * Returns: { results: Array<{ prospectId, avatarUrl?, error? }> }
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!isGeminiImageConfigured()) {
            return NextResponse.json(
                { error: 'Google AI Studio is not configured. Set GOOGLE_AI_STUDIO_KEY in your environment.' },
                { status: 503 }
            );
        }

        const body = await request.json();
        const { prospectIds } = body as { prospectIds: string[] };

        if (!Array.isArray(prospectIds) || prospectIds.length === 0) {
            return NextResponse.json(
                { error: 'prospectIds must be a non-empty array' },
                { status: 400 }
            );
        }

        // Limit batch size to prevent abuse
        if (prospectIds.length > 10) {
            return NextResponse.json(
                { error: 'Maximum 10 prospects per batch' },
                { status: 400 }
            );
        }

        // Fetch all prospects
        const prospects = await db
            .select()
            .from(prospectAvatars)
            .where(inArray(prospectAvatars.id, prospectIds));

        if (prospects.length === 0) {
            return NextResponse.json(
                { error: 'No prospects found for the given IDs' },
                { status: 404 }
            );
        }

        // Verify user has access to all prospects (same org)
        const userOrg = await db
            .select()
            .from(userOrganizations)
            .where(eq(userOrganizations.userId, session.user.id))
            .limit(1);

        const userOrgIds = new Set(userOrg.map(uo => uo.organizationId));
        const unauthorizedProspects = prospects.filter(p => !userOrgIds.has(p.organizationId));
        if (unauthorizedProspects.length > 0) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        // Generate all avatar images in parallel
        console.log(`[batch-generate] Generating ${prospects.length} avatar images in parallel...`);
        const startTime = Date.now();

        const results = await Promise.allSettled(
            prospects.map(async (prospect) => {
                // Use stored gender, or resolve from name
                const gender: 'male' | 'female' = (prospect.gender as 'male' | 'female') ||
                    resolveProspectGender(prospect.name);

                // Extract age from position description for more accurate images
                const ageMatch = prospect.positionDescription?.match(/(\d+)-year-old/);
                const age = ageMatch ? ageMatch[1] : undefined;

                // Extract role/occupation from position description
                const roleMatch = prospect.positionDescription?.match(/\d+-year-old\s+(.+?)\s+from/);
                const occupation = roleMatch ? roleMatch[1] : undefined;

                const prompt = buildGeminiAvatarPrompt(
                    prospect.name,
                    prospect.positionDescription,
                    gender,
                    undefined, // offerCategory — not needed, context handles wardrobe
                    age,
                    occupation
                );

                const { url } = await generateImageWithGemini({ prompt });

                if (url) {
                    await db
                        .update(prospectAvatars)
                        .set({ avatarUrl: url, updatedAt: new Date() })
                        .where(eq(prospectAvatars.id, prospect.id));
                }

                return { prospectId: prospect.id, avatarUrl: url };
            })
        );

        const elapsed = Date.now() - startTime;
        console.log(`[batch-generate] All ${prospects.length} images completed in ${elapsed}ms`);

        // Format results
        const formattedResults = results.map((result, i) => {
            if (result.status === 'fulfilled') {
                return result.value;
            } else {
                console.error(`[batch-generate] Failed for prospect ${prospects[i].name}:`, result.reason?.message);
                return {
                    prospectId: prospects[i].id,
                    error: result.reason?.message || 'Image generation failed',
                };
            }
        });

        return NextResponse.json({ results: formattedResults });
    } catch (error: any) {
        console.error('[batch-generate] Batch generation failed:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to generate avatars' },
            { status: 500 }
        );
    }
}
