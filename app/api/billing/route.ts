import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { users, organizations, userOrganizations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getActiveSubscription, getCurrentUsage, getOrganizationSeatCount } from '@/lib/subscription';

/**
 * Get billing and subscription data for the current user's organization
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

    if (!user[0]) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get organization from primary or junction table
    let organizationId = user[0].organizationId;
    
    if (!organizationId) {
      // Try to get from junction table
      const firstOrg = await db
        .select()
        .from(userOrganizations)
        .where(eq(userOrganizations.userId, user[0].id))
        .limit(1);
      
      if (!firstOrg[0]) {
        return NextResponse.json(
          { error: 'No organization found. Please create an organization first.' },
          { status: 404 }
        );
      }
      organizationId = firstOrg[0].organizationId;
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

    // Get active subscription
    const subscription = await getActiveSubscription(organizationId);

    // Get current usage
    const usage = await getCurrentUsage(organizationId);

    // Get current seat count
    const currentSeats = await getOrganizationSeatCount(organizationId);

    return NextResponse.json({
      subscription: subscription ? {
        id: subscription.id,
        planTier: subscription.planTier,
        status: subscription.status,
        seats: subscription.seats,
        callsPerMonth: subscription.callsPerMonth,
        roleplaySessionsPerMonth: subscription.roleplaySessionsPerMonth,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      } : null,
      usage: {
        callsUsed: usage.callsUsed,
        roleplaySessionsUsed: usage.roleplaySessionsUsed,
        month: usage.month,
      },
      organization: {
        name: org[0].name,
        maxSeats: org[0].maxSeats,
        currentSeats: currentSeats,
      },
    });
  } catch (error) {
    console.error('Error fetching billing data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch billing data' },
      { status: 500 }
    );
  }
}
