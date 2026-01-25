import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { users, userOrganizations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { isUserInOrganization } from '@/lib/organizations';

/**
 * Switch user's primary organization
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
    const { organizationId } = body;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // Verify user is a member of this organization
    const isMember = await isUserInOrganization(session.user.id, organizationId);
    if (!isMember) {
      return NextResponse.json(
        { error: 'You are not a member of this organization' },
        { status: 403 }
      );
    }

    // Get user's role in this organization
    const membership = await db
      .select()
      .from(userOrganizations)
      .where(
        and(
          eq(userOrganizations.userId, session.user.id),
          eq(userOrganizations.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!membership[0]) {
      return NextResponse.json(
        { error: 'Membership not found' },
        { status: 404 }
      );
    }

    // Update user's primary organization
    await db
      .update(users)
      .set({
        organizationId,
        role: membership[0].role,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id));

    // Update isPrimary flags in user_organizations
    // Remove primary from all
    await db
      .update(userOrganizations)
      .set({ isPrimary: false })
      .where(eq(userOrganizations.userId, session.user.id));

    // Set new primary
    await db
      .update(userOrganizations)
      .set({ isPrimary: true })
      .where(
        and(
          eq(userOrganizations.userId, session.user.id),
          eq(userOrganizations.organizationId, organizationId)
        )
      );

    return NextResponse.json({
      success: true,
      message: 'Organization switched successfully',
    });
  } catch (error) {
    console.error('Error switching organization:', error);
    return NextResponse.json(
      { error: 'Failed to switch organization' },
      { status: 500 }
    );
  }
}
