import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { users, subscriptions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { createWhopCheckoutUrl } from '@/lib/whop';
import { PlanTier, PLANS } from '@/lib/plans';

/**
 * Checkout API - Handles plan selection
 * - Starter (Free): Activates free subscription directly
 * - Pro: Redirects to Whop checkout
 * - Enterprise: Returns mailto link for sales
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

    const body = await request.json();
    const { planTier } = body as { planTier: PlanTier };

    if (!planTier || !['starter', 'pro', 'enterprise'].includes(planTier)) {
      return NextResponse.json(
        { error: 'Invalid plan tier' },
        { status: 400 }
      );
    }

    // Get user's organization
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

    const organizationId = user[0].organizationId;

    // Enterprise → mailto link for sales
    if (planTier === 'enterprise') {
      return NextResponse.json({
        checkoutUrl: 'mailto:sales@closepro.co?subject=Enterprise%20Plan%20Inquiry&body=Hi%2C%20I%27m%20interested%20in%20the%20Enterprise%20plan%20for%20ProCloser.%20Please%20get%20in%20touch%20with%20pricing%20details.',
      });
    }

    // Starter (Free) → activate free plan directly in database
    if (planTier === 'starter') {
      const starterPlan = PLANS.starter;

      // Check if there's already an active subscription
      const existingSub = await db
        .select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.organizationId, organizationId),
            eq(subscriptions.status, 'active')
          )
        )
        .limit(1);

      if (existingSub[0]) {
        return NextResponse.json({
          success: true,
          message: 'Already have an active subscription',
        });
      }

      // Create free subscription record
      const now = new Date();
      const periodEnd = new Date();
      periodEnd.setFullYear(periodEnd.getFullYear() + 100); // Free plan never expires

      await db.insert(subscriptions).values({
        organizationId,
        whopSubscriptionId: `free_${organizationId}_${Date.now()}`,
        whopPlanId: 'free',
        planTier: 'starter',
        status: 'active',
        seats: starterPlan.maxSeats,
        callsPerMonth: starterPlan.callsPerMonth,
        roleplaySessionsPerMonth: starterPlan.roleplaySessionsPerMonth,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      });

      return NextResponse.json({ success: true });
    }

    // Pro → redirect to Whop checkout
    const checkoutUrl = createWhopCheckoutUrl(
      planTier,
      organizationId,
      user[0].email,
    );

    return NextResponse.json({ checkoutUrl });
  } catch (error) {
    console.error('Error creating checkout:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout' },
      { status: 500 }
    );
  }
}
