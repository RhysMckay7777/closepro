import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { prospectAvatars, userOrganizations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateImage, buildProspectAvatarPrompt, isNanoBananaConfigured } from '@/lib/nanobanana';

export const maxDuration = 60;

/**
 * POST - Generate a human-style portrait for this prospect via NanoBanana and save as avatar_url.
 * Requires NANOBANANA_API_KEY in env.
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

    if (!isNanoBananaConfigured()) {
      return NextResponse.json(
        { error: 'NanoBanana is not configured. Set NANOBANANA_API_KEY in your environment.' },
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

    const prompt = buildProspectAvatarPrompt(prospect.name, prospect.positionDescription ?? undefined);
    const { url } = await generateImage({
      prompt,
      num: 1,
      image_size: '1:1',
    });

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
      message: 'Human portrait generated',
    });
  } catch (error: any) {
    console.error('Error generating prospect avatar:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate portrait' },
      { status: 500 }
    );
  }
}
