import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { teamInvites, users, organizations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Get pending invites for the current user
 */
export async function GET(request: NextRequest) {
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

    // Get pending invites for this user
    const invites = await db
      .select({
        id: teamInvites.id,
        organizationId: teamInvites.organizationId,
        organizationName: organizations.name,
        inviterId: teamInvites.inviterId,
        inviterName: users.name,
        inviterEmail: users.email,
        inviterProfilePhoto: users.profilePhoto,
        role: teamInvites.role,
        status: teamInvites.status,
        createdAt: teamInvites.createdAt,
      })
      .from(teamInvites)
      .innerJoin(organizations, eq(teamInvites.organizationId, organizations.id))
      .innerJoin(users, eq(teamInvites.inviterId, users.id))
      .where(
        and(
          eq(teamInvites.inviteeId, session.user.id),
          eq(teamInvites.status, 'pending')
        )
      )
      .orderBy(teamInvites.createdAt);

    return NextResponse.json({
      invites: invites.map(invite => ({
        ...invite,
        createdAt: invite.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching invites:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invites' },
      { status: 500 }
    );
  }
}
