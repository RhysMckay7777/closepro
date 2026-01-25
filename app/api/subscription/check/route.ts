import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { users, organizations, userOrganizations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getActiveSubscription } from '@/lib/subscription';
import { shouldBypassSubscription } from '@/lib/dev-mode';

/**
 * Check subscription status for UI display
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

    // Get user and organization
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

    // Get organization
    let organizationId = user[0].organizationId;
    if (!organizationId) {
      const firstOrg = await db
        .select()
        .from(userOrganizations)
        .where(eq(userOrganizations.userId, user[0].id))
        .limit(1);
      
      if (!firstOrg[0]) {
        return NextResponse.json(
          { error: 'No organization found' },
          { status: 404 }
        );
      }
      organizationId = firstOrg[0].organizationId;
    }

    // In dev mode, always return active
    const bypass = shouldBypassSubscription();
    if (bypass) {
      return NextResponse.json({
        hasActiveSubscription: true,
        isDevMode: true,
        subscription: {
          planTier: 'enterprise',
          status: 'active',
        },
      });
    }

    const subscription = await getActiveSubscription(organizationId);
    const hasActiveSubscription = subscription !== null && 
      (subscription.status === 'active' || subscription.status === 'trialing');

    return NextResponse.json({
      hasActiveSubscription,
      isDevMode: false,
      subscription: subscription ? {
        planTier: subscription.planTier,
        status: subscription.status,
      } : null,
    });
  } catch (error: any) {
    console.error('Error checking subscription:', error);
    return NextResponse.json(
      { error: 'Failed to check subscription' },
      { status: 500 }
    );
  }
}
