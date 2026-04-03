import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { users, organizations, pendingCheckouts, subscriptions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { PLANS, PlanTier } from '@/lib/plans';
import { mapWhopStatus } from '@/lib/whop';

/**
 * Claim a pending checkout for the current user's existing organization.
 * Used when an existing user (who already has an org) pays via guest checkout,
 * then signs in instead of signing up.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { checkoutToken } = await request.json();

    if (!checkoutToken) {
      return NextResponse.json({ error: 'Missing checkout token' }, { status: 400 });
    }

    // Get user's organization
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user?.organizationId) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 });
    }

    // Look up the pending checkout
    const [checkout] = await db
      .select()
      .from(pendingCheckouts)
      .where(eq(pendingCheckouts.checkoutToken, checkoutToken))
      .limit(1);

    if (!checkout) {
      return NextResponse.json({ error: 'Checkout not found' }, { status: 404 });
    }

    if (checkout.status === 'claimed') {
      // Already claimed — nothing to do
      return NextResponse.json({ success: true, alreadyClaimed: true });
    }

    const planTier = checkout.planTier as PlanTier;
    const planConfig = PLANS[planTier as keyof typeof PLANS];

    // If webhook already delivered subscription data, create the subscription record
    if (checkout.whopSubscriptionId) {
      const subData = checkout.subscriptionData
        ? JSON.parse(checkout.subscriptionData)
        : null;

      // Check if subscription already exists for this org
      const existing = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.whopSubscriptionId, checkout.whopSubscriptionId))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(subscriptions).values({
          organizationId: user.organizationId,
          whopSubscriptionId: checkout.whopSubscriptionId,
          whopCustomerId: checkout.whopCustomerId,
          whopPlanId: checkout.whopPlanId,
          status: subData?.status ? mapWhopStatus(subData.status) : 'active',
          planTier,
          seats: planConfig?.maxSeats || 1,
          callsPerMonth: planConfig?.callsPerMonth || 200,
          roleplaySessionsPerMonth: planConfig?.roleplaySessionsPerMonth || 50,
          currentPeriodStart: subData?.current_period_start
            ? new Date(subData.current_period_start * 1000)
            : new Date(),
          currentPeriodEnd: subData?.current_period_end
            ? new Date(subData.current_period_end * 1000)
            : null,
        });
      }
    }

    // Update the organization's plan
    await db
      .update(organizations)
      .set({
        planTier,
        maxSeats: planConfig?.maxSeats || 1,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, user.organizationId));

    // Mark checkout as claimed
    await db
      .update(pendingCheckouts)
      .set({
        status: 'claimed',
        claimedByOrgId: user.organizationId,
        updatedAt: new Date(),
      })
      .where(eq(pendingCheckouts.id, checkout.id));

    return NextResponse.json({ success: true, planTier });
  } catch (error) {
    console.error('Error claiming checkout:', error);
    return NextResponse.json(
      { error: 'Failed to claim checkout' },
      { status: 500 }
    );
  }
}
