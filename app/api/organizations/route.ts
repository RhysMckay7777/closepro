import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { organizations, users, userOrganizations, pendingCheckouts, subscriptions } from '@/db/schema';
import { auth } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import { createSeedData } from '@/lib/seed-data';
import { PLANS, PlanTier } from '@/lib/plans';
import { mapWhopStatus } from '@/lib/whop';

export async function POST(request: NextRequest) {
  try {
    // Get session from better-auth
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, checkoutToken } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: 'Organization name is required' },
        { status: 400 }
      );
    }

    // If a checkout token is provided, look up the pending checkout to get the paid plan
    let planTier: PlanTier | 'starter' = 'starter';
    let maxSeats = 1;
    let pendingCheckout: any = null;

    if (checkoutToken) {
      // Look for the pending checkout — accept both 'paid' (webhook received)
      // and 'pending' (webhook may be delayed) since the user already completed payment on Whop
      const [checkout] = await db
        .select()
        .from(pendingCheckouts)
        .where(eq(pendingCheckouts.checkoutToken, checkoutToken))
        .limit(1);

      if (checkout && checkout.status !== 'claimed') {
        pendingCheckout = checkout;
        planTier = checkout.planTier as PlanTier;
        const planConfig = PLANS[planTier as keyof typeof PLANS];
        if (planConfig) {
          maxSeats = planConfig.maxSeats;
        }
      }
    }

    // Create organization with the correct plan tier
    const [org] = await db
      .insert(organizations)
      .values({
        name,
        planTier,
        maxSeats,
        isActive: planTier !== 'starter', // Active if they have a paid plan
      })
      .returning();

    // Update user with organization ID (primary org)
    await db
      .update(users)
      .set({
        organizationId: org.id,
        role: 'admin', // First user becomes admin
      })
      .where(eq(users.id, session.user.id));

    // Also add to user_organizations junction table
    await db.insert(userOrganizations).values({
      userId: session.user.id,
      organizationId: org.id,
      role: 'admin',
      isPrimary: true,
    });

    // If we have a pending checkout with Whop subscription data, create the subscription record
    if (pendingCheckout?.whopSubscriptionId) {
      const planConfig = PLANS[planTier as keyof typeof PLANS];
      const subData = pendingCheckout.subscriptionData
        ? JSON.parse(pendingCheckout.subscriptionData)
        : null;

      await db.insert(subscriptions).values({
        organizationId: org.id,
        whopSubscriptionId: pendingCheckout.whopSubscriptionId,
        whopCustomerId: pendingCheckout.whopCustomerId,
        whopPlanId: pendingCheckout.whopPlanId,
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

      // Mark the pending checkout as claimed
      await db
        .update(pendingCheckouts)
        .set({
          status: 'claimed',
          claimedByOrgId: org.id,
          updatedAt: new Date(),
        })
        .where(eq(pendingCheckouts.id, pendingCheckout.id));
    }

    // Create seed data: 5 default offers with 4 prospects each
    try {
      await createSeedData(org.id, session.user.id);
    } catch (seedError) {
      console.error('Error creating seed data:', seedError);
      // Don't fail organization creation if seed data fails
    }

    return NextResponse.json(org);
  } catch (error) {
    console.error('Organization creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create organization' },
      { status: 500 }
    );
  }
}
