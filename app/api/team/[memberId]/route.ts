import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { users, userOrganizations } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * Remove a team member
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    // Get authenticated user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get current user
    const currentUser = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!currentUser[0]) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get organization (use primary or get from query)
    const { searchParams } = new URL(request.url);
    const requestedOrgId = searchParams.get('orgId');
    let organizationId = requestedOrgId || currentUser[0].organizationId;

    if (!organizationId) {
      const firstOrg = await db
        .select()
        .from(userOrganizations)
        .where(eq(userOrganizations.userId, currentUser[0].id))
        .limit(1);

      if (!firstOrg[0]) {
        return NextResponse.json(
          { error: 'User organization not found' },
          { status: 404 }
        );
      }
      organizationId = firstOrg[0].organizationId;
    }

    // Check if user is admin in this organization
    const userMembership = await db
      .select()
      .from(userOrganizations)
      .where(
        and(
          eq(userOrganizations.userId, currentUser[0].id),
          eq(userOrganizations.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!userMembership[0] || userMembership[0].role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can remove team members' },
        { status: 403 }
      );
    }

    // Get member's membership in this organization
    const membership = await db
      .select()
      .from(userOrganizations)
      .where(
        and(
          eq(userOrganizations.userId, params.memberId),
          eq(userOrganizations.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!membership[0]) {
      return NextResponse.json(
        { error: 'Team member not found in this organization' },
        { status: 404 }
      );
    }

    // Prevent removing admin
    if (membership[0].role === 'admin') {
      return NextResponse.json(
        { error: 'Cannot remove admin users' },
        { status: 403 }
      );
    }

    // Prevent removing yourself
    if (membership[0].userId === currentUser[0].id) {
      return NextResponse.json(
        { error: 'Cannot remove yourself' },
        { status: 403 }
      );
    }

    // Remove user from organization (delete from junction table)
    await db
      .delete(userOrganizations)
      .where(
        and(
          eq(userOrganizations.userId, params.memberId),
          eq(userOrganizations.organizationId, organizationId)
        )
      );

    // If this was their primary org, update to another org or clear it
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, params.memberId))
      .limit(1);

    if (user[0] && user[0].organizationId === organizationId) {
      // Find another org for them, or set to null
      const otherOrg = await db
        .select()
        .from(userOrganizations)
        .where(eq(userOrganizations.userId, params.memberId))
        .orderBy(desc(userOrganizations.isPrimary))
        .limit(1);

      await db
        .update(users)
        .set({
          organizationId: otherOrg[0]?.organizationId || null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, params.memberId));
    }

    return NextResponse.json({
      success: true,
      message: 'Team member removed successfully'
    });
  } catch (error) {
    logger.error('TEAM', 'Failed to remove team member', error);
    return NextResponse.json(
      { error: 'Failed to remove team member' },
      { status: 500 }
    );
  }
}

/**
 * Update team member role
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    // Get authenticated user
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get current user
    const currentUser = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!currentUser[0]) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { role, organizationId: requestedOrgId } = body;

    if (!role || !['admin', 'manager', 'rep'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    // Get organization
    let organizationId = requestedOrgId || currentUser[0].organizationId;

    if (!organizationId) {
      const firstOrg = await db
        .select()
        .from(userOrganizations)
        .where(eq(userOrganizations.userId, currentUser[0].id))
        .limit(1);

      if (!firstOrg[0]) {
        return NextResponse.json(
          { error: 'User organization not found' },
          { status: 404 }
        );
      }
      organizationId = firstOrg[0].organizationId;
    }

    // Check if user is admin in this organization
    const userMembership = await db
      .select()
      .from(userOrganizations)
      .where(
        and(
          eq(userOrganizations.userId, currentUser[0].id),
          eq(userOrganizations.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!userMembership[0] || userMembership[0].role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can change member roles' },
        { status: 403 }
      );
    }

    // Get member's membership in this organization
    const membership = await db
      .select()
      .from(userOrganizations)
      .where(
        and(
          eq(userOrganizations.userId, params.memberId),
          eq(userOrganizations.organizationId, organizationId)
        )
      )
      .limit(1);

    if (!membership[0]) {
      return NextResponse.json(
        { error: 'Team member not found in this organization' },
        { status: 404 }
      );
    }

    // Update role in this organization
    await db
      .update(userOrganizations)
      .set({
        role: role as 'admin' | 'manager' | 'rep',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userOrganizations.userId, params.memberId),
          eq(userOrganizations.organizationId, organizationId)
        )
      );

    return NextResponse.json({
      success: true,
      message: 'Member role updated successfully'
    });
  } catch (error) {
    logger.error('TEAM', 'Failed to update team member', error);
    return NextResponse.json(
      { error: 'Failed to update team member' },
      { status: 500 }
    );
  }
}
