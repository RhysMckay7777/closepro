import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { prospectAvatars } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { userOrganizations } from '@/db/schema';
import { calculateDifficultyIndex } from '@/lib/ai/roleplay/prospect-avatar';

export const maxDuration = 60;

/**
 * GET - Get prospect avatar details
 */
export async function GET(
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

    // Get avatar
    const avatar = await db
      .select()
      .from(prospectAvatars)
      .where(eq(prospectAvatars.id, avatarId))
      .limit(1);

    if (!avatar[0]) {
      return NextResponse.json(
        { error: 'Avatar not found' },
        { status: 404 }
      );
    }

    // Verify user has access (same organization)
    const userOrg = await db
      .select()
      .from(userOrganizations)
      .where(eq(userOrganizations.userId, session.user.id))
      .limit(1);

    const userOrgIds = userOrg.map(uo => uo.organizationId);
    if (!userOrgIds.includes(avatar[0].organizationId)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      avatar: avatar[0],
    });
  } catch (error: any) {
    console.error('Error fetching avatar:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch avatar' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update prospect avatar
 */
export async function PATCH(
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

    const body = await request.json();

    // Get avatar
    const avatar = await db
      .select()
      .from(prospectAvatars)
      .where(eq(prospectAvatars.id, avatarId))
      .limit(1);

    if (!avatar[0]) {
      return NextResponse.json(
        { error: 'Avatar not found' },
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
    if (!userOrgIds.includes(avatar[0].organizationId)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Build update object
    const updateData: any = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.positionProblemAlignment !== undefined) updateData.positionProblemAlignment = body.positionProblemAlignment;
    if (body.painAmbitionIntensity !== undefined) updateData.painAmbitionIntensity = body.painAmbitionIntensity;
    if (body.perceivedNeedForHelp !== undefined) updateData.perceivedNeedForHelp = body.perceivedNeedForHelp;
    if (body.authorityLevel !== undefined) updateData.authorityLevel = body.authorityLevel;
    if (body.funnelContext !== undefined) updateData.funnelContext = body.funnelContext;
    if (body.executionResistance !== undefined) updateData.executionResistance = body.executionResistance;
    if (body.avatarUrl !== undefined) updateData.avatarUrl = body.avatarUrl;
    if (body.positionDescription !== undefined) updateData.positionDescription = body.positionDescription;
    if (body.voiceStyle !== undefined) updateData.voiceStyle = typeof body.voiceStyle === 'string' ? body.voiceStyle.trim().slice(0, 200) || null : null;
    if (body.problems !== undefined) updateData.problems = JSON.stringify(body.problems);
    if (body.painDrivers !== undefined) updateData.painDrivers = JSON.stringify(body.painDrivers);
    if (body.ambitionDrivers !== undefined) updateData.ambitionDrivers = JSON.stringify(body.ambitionDrivers);
    if (body.resistanceStyle !== undefined) updateData.resistanceStyle = JSON.stringify(body.resistanceStyle);
    if (body.behaviouralBaseline !== undefined) updateData.behaviouralBaseline = JSON.stringify(body.behaviouralBaseline);
    if (body.isTemplate !== undefined) updateData.isTemplate = body.isTemplate;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    // Recalculate difficulty if relevant fields changed
    if (body.positionProblemAlignment !== undefined || body.painAmbitionIntensity !== undefined ||
      body.perceivedNeedForHelp !== undefined || body.authorityLevel !== undefined ||
      body.funnelContext !== undefined || body.executionResistance !== undefined) {
      const updatedAvatar = { ...avatar[0], ...updateData };
      const executionResistance = updatedAvatar.executionResistance !== undefined
        ? updatedAvatar.executionResistance
        : avatar[0].executionResistance || 5;

      const { index: difficultyIndex, tier: difficultyTier } = calculateDifficultyIndex(
        updatedAvatar.positionProblemAlignment,
        updatedAvatar.painAmbitionIntensity,
        updatedAvatar.perceivedNeedForHelp,
        updatedAvatar.authorityLevel,
        updatedAvatar.funnelContext,
        executionResistance
      );

      updateData.difficultyIndex = difficultyIndex;
      updateData.difficultyTier = difficultyTier;
    }

    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(prospectAvatars)
      .set(updateData)
      .where(eq(prospectAvatars.id, avatarId))
      .returning();

    return NextResponse.json({
      avatar: updated,
      message: 'Avatar updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating avatar:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update avatar' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete prospect avatar
 */
export async function DELETE(
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

    // Get avatar
    const avatar = await db
      .select()
      .from(prospectAvatars)
      .where(eq(prospectAvatars.id, avatarId))
      .limit(1);

    if (!avatar[0]) {
      return NextResponse.json(
        { error: 'Avatar not found' },
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
    if (!userOrgIds.includes(avatar[0].organizationId)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Soft delete by setting isActive to false
    await db
      .update(prospectAvatars)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(prospectAvatars.id, avatarId));

    return NextResponse.json({
      message: 'Avatar deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting avatar:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete avatar' },
      { status: 500 }
    );
  }
}
