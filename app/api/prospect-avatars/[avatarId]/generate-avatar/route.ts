import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { prospectAvatars, userOrganizations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateImageWithGemini, buildGeminiAvatarPrompt, isGeminiImageConfigured } from '@/lib/gemini-image';

export const maxDuration = 120;

/**
 * POST - Generate a human-style portrait for this prospect via Google AI Studio (Gemini) and save as avatar_url.
 * Requires GOOGLE_AI_STUDIO_KEY or GOOGLE_GENERATIVE_AI_API_KEY in env.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ avatarId: string }> }
) {
  try {
    const { avatarId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!isGeminiImageConfigured()) {
      return NextResponse.json(
        { error: 'Google AI Studio is not configured. Set GOOGLE_AI_STUDIO_KEY in your environment.' },
        { status: 503 }
      );
    }

    const [prospect] = await db
      .select()
      .from(prospectAvatars)
      .where(eq(prospectAvatars.id, avatarId))
      .limit(1);

    if (!prospect) {
      return NextResponse.json(
        { error: 'Prospect not found' },
        { status: 404 }
      );
    }

    const userOrg = await db
      .select()
      .from(userOrganizations)
      .where(eq(userOrganizations.userId, session.user.id))
      .limit(1);

    const userOrgIds = userOrg.map(uo => uo.organizationId);
    if (!userOrgIds.includes(prospect.organizationId)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    const prompt = buildGeminiAvatarPrompt(prospect.name, prospect.positionDescription ?? undefined);
    const { url } = await generateImageWithGemini({ prompt });

    const [updated] = await db
      .update(prospectAvatars)
      .set({
        avatarUrl: url,
        updatedAt: new Date(),
      })
      .where(eq(prospectAvatars.id, avatarId))
      .returning();

    return NextResponse.json({
      avatarUrl: updated?.avatarUrl ?? url,
      message: 'Human portrait generated via Gemini',
    });
  } catch (error: any) {
    console.error('Error generating prospect avatar:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate portrait' },
      { status: 500 }
    );
  }
}
