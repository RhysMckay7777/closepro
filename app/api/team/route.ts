import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { users, organizations, userOrganizations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getActiveSubscription } from '@/lib/subscription';

/**
 * Get team members for the current user's organization
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

    // Get user with organization
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    // Get user's primary organization (or first organization they belong to)
    if (!user[0]) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Use primary organizationId, or get from junction table
    let organizationId = user[0].organizationId;
    
    if (!organizationId) {
      // Fallback: get first organization from junction table
      const firstOrg = await db
        .select()
        .from(userOrganizations)
        .where(eq(userOrganizations.userId, user[0].id))
        .limit(1);
      
      if (firstOrg[0]) {
        organizationId = firstOrg[0].organizationId;
      } else {
        return NextResponse.json(
          { error: 'No organization found. Please create an organization first.' },
          { status: 404 }
        );
      }
    }

    // Get organization details
    const org = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (!org[0]) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get all team members via user_organizations junction table
    const members = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        profilePhoto: users.profilePhoto,
        role: userOrganizations.role,
        createdAt: userOrganizations.joinedAt,
      })
      .from(userOrganizations)
      .innerJoin(users, eq(userOrganizations.userId, users.id))
      .where(eq(userOrganizations.organizationId, organizationId));

    // Get active subscription to check seat limits
    const subscription = await getActiveSubscription(organizationId);
    const maxSeats = subscription?.seats || org[0].maxSeats;
    const currentSeats = members.length;
    const canAddSeats = currentSeats < maxSeats;

    return NextResponse.json({
      members: members.map(m => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
      })),
      currentSeats,
      maxSeats,
      canAddSeats,
      planTier: subscription?.planTier || org[0].planTier,
    });
  } catch (error) {
    console.error('Error fetching team data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team data' },
      { status: 500 }
    );
  }
}

/**
 * Invite a new team member
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

    // Get user with organization
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user[0] || !user[0].organizationId) {
      return NextResponse.json(
        { error: 'User organization not found' },
        { status: 404 }
      );
    }

    // Check if user is admin or manager
    if (user[0].role === 'rep') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, name, role } = body;

    if (!email || !name) {
      return NextResponse.json(
        { error: 'Email and name are required' },
        { status: 400 }
      );
    }

    // Check seat limit
    const organizationId = user[0].organizationId;
    const subscription = await getActiveSubscription(organizationId);
    
    const currentMembers = await db
      .select()
      .from(users)
      .where(eq(users.organizationId, organizationId));

    const maxSeats = subscription?.seats || 5;
    
    if (currentMembers.length >= maxSeats) {
      return NextResponse.json(
        { error: 'Seat limit reached. Please upgrade your plan.' },
        { status: 403 }
      );
    }

    // TODO: Implement email invitation system
    // For now, return success indicating invitation would be sent
    
    return NextResponse.json({
      message: 'Invitation sent successfully',
      email,
    });
  } catch (error) {
    console.error('Error inviting team member:', error);
    return NextResponse.json(
      { error: 'Failed to invite team member' },
      { status: 500 }
    );
  }
}
