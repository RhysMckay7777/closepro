import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { teamInvites, userOrganizations, users, organizations, notifications } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Accept a team invite
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ inviteId: string }> }
) {
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

    const { inviteId } = await params;

    // Get the invite
    const invite = await db
      .select()
      .from(teamInvites)
      .where(
        and(
          eq(teamInvites.id, inviteId),
          eq(teamInvites.inviteeId, session.user.id)
        )
      )
      .limit(1);

    if (!invite[0]) {
      return NextResponse.json(
        { error: 'Invite not found' },
        { status: 404 }
      );
    }

    if (invite[0].status !== 'pending') {
      return NextResponse.json(
        { error: `This invite has already been ${invite[0].status}` },
        { status: 400 }
      );
    }

    // Check seat limit - but allow if user is already a member (they're just accepting the invite)
    // Only block if they're not already a member AND seats are full
    const { canAddSeat } = await import('@/lib/subscription');
    const canAdd = await canAddSeat(invite[0].organizationId);
    
    // Check if user is already in this organization first
    const existingMembershipCheck = await db
      .select()
      .from(userOrganizations)
      .where(
        and(
          eq(userOrganizations.userId, session.user.id),
          eq(userOrganizations.organizationId, invite[0].organizationId)
        )
      )
      .limit(1);

    // If not already a member and seats are full, block
    if (existingMembershipCheck.length === 0 && !canAdd) {
      return NextResponse.json(
        { error: 'Seat limit reached. Please ask the organization admin to upgrade their plan.' },
        { status: 403 }
      );
    }

    // If user is already a member, just mark invite as accepted
    if (existingMembershipCheck.length > 0) {
      await db
        .update(teamInvites)
        .set({
          status: 'accepted',
          updatedAt: new Date(),
        })
        .where(eq(teamInvites.id, inviteId));

      return NextResponse.json({
        success: true,
        message: 'You are already a member of this organization',
      });
    }

    // Add user to organization
    await db.insert(userOrganizations).values({
      userId: session.user.id,
      organizationId: invite[0].organizationId,
      role: invite[0].role,
      isPrimary: false,
    });

    // Update user's primary org if they don't have one
    // This ensures the team page shows the correct organization after accepting
    const currentUser = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (currentUser[0] && !currentUser[0].organizationId) {
      // User has no primary org, set this as primary so they can see it
      await db
        .update(users)
        .set({
          organizationId: invite[0].organizationId,
          role: invite[0].role,
          updatedAt: new Date(),
        })
        .where(eq(users.id, session.user.id));
    }

    // Update invite status
    await db
      .update(teamInvites)
      .set({
        status: 'accepted',
        updatedAt: new Date(),
      })
      .where(eq(teamInvites.id, inviteId));

    // Get organization and inviter info for notifications
    const org = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, invite[0].organizationId))
      .limit(1);

    const inviter = await db
      .select()
      .from(users)
      .where(eq(users.id, invite[0].inviterId))
      .limit(1);

    // Create notification for inviter
    await db.insert(notifications).values({
      userId: invite[0].inviterId,
      type: 'team_invite_accepted',
      title: 'Invite Accepted',
      message: `${currentUser[0]?.name || 'A user'} accepted your invitation to join ${org[0]?.name || 'your organization'}`,
      organizationId: invite[0].organizationId,
      metadata: JSON.stringify({
        inviteId: inviteId,
        inviteeId: session.user.id,
      }),
      read: false,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully joined ${org[0]?.name || 'the organization'}`,
    });
  } catch (error) {
    console.error('Error accepting invite:', error);
    return NextResponse.json(
      { error: 'Failed to accept invite' },
      { status: 500 }
    );
  }
}

/**
 * Decline a team invite
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ inviteId: string }> }
) {
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

    const { inviteId } = await params;

    // Get the invite
    const invite = await db
      .select()
      .from(teamInvites)
      .where(
        and(
          eq(teamInvites.id, inviteId),
          eq(teamInvites.inviteeId, session.user.id)
        )
      )
      .limit(1);

    if (!invite[0]) {
      return NextResponse.json(
        { error: 'Invite not found' },
        { status: 404 }
      );
    }

    if (invite[0].status !== 'pending') {
      return NextResponse.json(
        { error: `This invite has already been ${invite[0].status}` },
        { status: 400 }
      );
    }

    // Update invite status
    await db
      .update(teamInvites)
      .set({
        status: 'declined',
        updatedAt: new Date(),
      })
      .where(eq(teamInvites.id, inviteId));

    // Get organization and inviter info for notifications
    const org = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, invite[0].organizationId))
      .limit(1);

    const currentUser = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    // Create notification for inviter
    await db.insert(notifications).values({
      userId: invite[0].inviterId,
      type: 'team_invite_declined',
      title: 'Invite Declined',
      message: `${currentUser[0]?.name || 'A user'} declined your invitation to join ${org[0]?.name || 'your organization'}`,
      organizationId: invite[0].organizationId,
      metadata: JSON.stringify({
        inviteId: inviteId,
        inviteeId: session.user.id,
      }),
      read: false,
    });

    return NextResponse.json({
      success: true,
      message: 'Invite declined',
    });
  } catch (error) {
    console.error('Error declining invite:', error);
    return NextResponse.json(
      { error: 'Failed to decline invite' },
      { status: 500 }
    );
  }
}
