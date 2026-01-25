import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { users, organizations, userOrganizations, teamInvites, notifications } from '@/db/schema';
import { eq, and, sql, ilike, ne, notInArray } from 'drizzle-orm';
import { canAddSeat } from '@/lib/subscription';

/**
 * Invite an existing user to join the organization
 */
export async function POST(request: NextRequest) {
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

    // Get organization from request or use primary
    const body = await request.json();
    const { userEmail, role = 'rep', organizationId: requestedOrgId } = body;

    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 400 }
      );
    }

    if (!['admin', 'manager', 'rep'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    // Use requested org or fallback to primary
    let organizationId = requestedOrgId || currentUser[0].organizationId;
    
    if (!organizationId) {
      // Get first organization from junction table
      const firstOrg = await db
        .select()
        .from(userOrganizations)
        .where(eq(userOrganizations.userId, currentUser[0].id))
        .limit(1);
      
      if (!firstOrg[0]) {
        return NextResponse.json(
          { error: 'No organization found. Please create an organization first before inviting members.' },
          { status: 404 }
        );
      }
      organizationId = firstOrg[0].organizationId;
    }

    // Check user's role in this organization
    // First check junction table (multi-org support)
    let userMembership = await db
      .select()
      .from(userOrganizations)
      .where(
        and(
          eq(userOrganizations.userId, currentUser[0].id),
          eq(userOrganizations.organizationId, organizationId)
        )
      )
      .limit(1);

    // Fallback: if no junction table entry, check users table (backward compatibility)
    if (!userMembership[0] && currentUser[0].organizationId === organizationId) {
      // User is in this org via the users table, check their role
      if (currentUser[0].role === 'rep') {
        return NextResponse.json(
          { error: 'Insufficient permissions. Only admins and managers can invite members.' },
          { status: 403 }
        );
      }
      // Admin or manager - allow
    } else if (!userMembership[0]) {
      // User is not in this organization at all
      return NextResponse.json(
        { error: 'User organization not found' },
        { status: 404 }
      );
    } else if (userMembership[0].role === 'rep') {
      // User is in org but only as rep
      return NextResponse.json(
        { error: 'Insufficient permissions. Only admins and managers can invite members.' },
        { status: 403 }
      );
    }

    // Check seat limit - but don't block invites, just warn
    // The invite can be accepted later when seats are available
    const canAdd = await canAddSeat(organizationId);

    // Find the user by email
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, userEmail))
      .limit(1);

    if (!existingUser[0]) {
      return NextResponse.json(
        { error: 'User not found. Only registered users can be invited. Please ask them to sign up first.' },
        { status: 404 }
      );
    }

    // Check if user is already in this organization
    // Check junction table first
    const existingMembership = await db
      .select()
      .from(userOrganizations)
      .where(
        and(
          eq(userOrganizations.userId, existingUser[0].id),
          eq(userOrganizations.organizationId, organizationId)
        )
      )
      .limit(1);

    // Also check users table for backward compatibility
    if (existingMembership.length === 0 && existingUser[0].organizationId === organizationId) {
      return NextResponse.json(
        { error: 'User is already a member of this organization' },
        { status: 400 }
      );
    }

    if (existingMembership.length > 0) {
      return NextResponse.json(
        { error: 'User is already a member of this organization' },
        { status: 400 }
      );
    }

    // Check if there's already a pending invite
    const existingInvite = await db
      .select()
      .from(teamInvites)
      .where(
        and(
          eq(teamInvites.inviteeId, existingUser[0].id),
          eq(teamInvites.organizationId, organizationId),
          eq(teamInvites.status, 'pending')
        )
      )
      .limit(1);

    if (existingInvite.length > 0) {
      return NextResponse.json(
        { error: 'An invite is already pending for this user' },
        { status: 400 }
      );
    }

    // Get organization name for notification
    const org = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    // Create pending invite
    const [invite] = await db
      .insert(teamInvites)
      .values({
        organizationId,
        inviterId: currentUser[0].id,
        inviteeId: existingUser[0].id,
        role: role as 'admin' | 'manager' | 'rep',
        status: 'pending',
      })
      .returning();

    // Create notification for the invitee
    await db.insert(notifications).values({
      userId: existingUser[0].id,
      type: 'team_invite',
      title: 'Team Invitation',
      message: `${currentUser[0].name} invited you to join ${org[0]?.name || 'their organization'}`,
      organizationId,
      inviterId: currentUser[0].id,
      metadata: JSON.stringify({
        inviteId: invite.id,
        role,
        organizationName: org[0]?.name,
      }),
      read: false,
    });

    return NextResponse.json({
      success: true,
      message: canAdd 
        ? `Successfully invited ${existingUser[0].name} to the team`
        : `Invite sent to ${existingUser[0].name}. They can accept once you upgrade your plan to add more seats.`,
      user: {
        id: existingUser[0].id,
        name: existingUser[0].name,
        email: existingUser[0].email,
        role,
      },
      inviteId: invite.id,
      seatLimitReached: !canAdd,
    });
  } catch (error) {
    console.error('Error inviting team member:', error);
    return NextResponse.json(
      { error: 'Failed to invite team member' },
      { status: 500 }
    );
  }
}

/**
 * Search for users by email (for invite autocomplete)
 */
export async function GET(request: NextRequest) {
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

    // Get organization (primary or from query param)
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const requestedOrgId = searchParams.get('orgId');

    if (query.length < 2) {
      return NextResponse.json({ users: [] });
    }

    // Determine which organization to search for
    let organizationId = requestedOrgId || currentUser[0].organizationId;
    
    if (!organizationId) {
      // Try to get from junction table
      const firstOrg = await db
        .select()
        .from(userOrganizations)
        .where(eq(userOrganizations.userId, currentUser[0].id))
        .limit(1);
      
      if (firstOrg[0]) {
        organizationId = firstOrg[0].organizationId;
      } else {
        return NextResponse.json(
          { error: 'User organization not found' },
          { status: 404 }
        );
      }
    }

    // Check if user is admin or manager in this organization
    // First check junction table (multi-org support)
    let userMembership = await db
      .select()
      .from(userOrganizations)
      .where(
        and(
          eq(userOrganizations.userId, currentUser[0].id),
          eq(userOrganizations.organizationId, organizationId)
        )
      )
      .limit(1);

    // Fallback: if no junction table entry, check users table (backward compatibility)
    // This handles users created before multi-org support
    if (!userMembership[0] && currentUser[0].organizationId === organizationId) {
      // User is in this org via the users table, check their role
      if (currentUser[0].role === 'rep') {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        );
      }
      // Admin or manager - allow
    } else if (!userMembership[0]) {
      // User is not in this organization at all
      return NextResponse.json(
        { error: 'User organization not found' },
        { status: 404 }
      );
    } else if (userMembership[0].role === 'rep') {
      // User is in org but only as rep
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get all users already in this organization
    const existingMembers = await db
      .select({ userId: userOrganizations.userId })
      .from(userOrganizations)
      .where(eq(userOrganizations.organizationId, organizationId));

    const existingMemberIds = existingMembers.map(m => m.userId);

    // First, check if user exists at all (for better error messages)
    const exactMatch = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        profilePhoto: users.profilePhoto,
      })
      .from(users)
      .where(sql`LOWER(${users.email}) = ${query.toLowerCase()}`)
      .limit(1);

    // If exact match exists and is already in this org, return helpful message
    if (exactMatch[0]) {
      if (existingMemberIds.includes(exactMatch[0].id)) {
        return NextResponse.json({ 
          users: [],
          message: 'This user is already a member of this organization'
        });
      }
      // If exact match exists, return it as the only result (can be invited to this org)
      return NextResponse.json({
        users: [{
          id: exactMatch[0].id,
          name: exactMatch[0].name,
          email: exactMatch[0].email,
          profilePhoto: exactMatch[0].profilePhoto,
        }]
      });
    }

    // Search for users by email (excluding those already in this organization)
    // Use ilike for case-insensitive search in PostgreSQL
    const whereConditions = [
      ilike(users.email, `%${query}%`),
      ne(users.id, currentUser[0].id),
    ];

    if (existingMemberIds.length > 0) {
      whereConditions.push(notInArray(users.id, existingMemberIds));
    }

    const searchResults = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        profilePhoto: users.profilePhoto,
      })
      .from(users)
      .where(and(...whereConditions))
      .limit(10);

    return NextResponse.json({
      users: searchResults.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        profilePhoto: user.profilePhoto,
      })),
    });
  } catch (error) {
    console.error('Error searching users:', error);
    return NextResponse.json(
      { error: 'Failed to search users' },
      { status: 500 }
    );
  }
}
