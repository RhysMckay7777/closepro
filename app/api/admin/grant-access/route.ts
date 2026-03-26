import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { db } from '@/db';
import { organizations, subscriptions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { PlanTier, getPlan } from '@/lib/plans';

/**
 * POST /api/admin/grant-access
 *
 * Upgrades or downgrades an organization's subscription plan.
 * Creates a new subscription record with the target plan's limits.
 *
 * Body: { organizationId: string, planTier: 'rep' | 'manager' | 'enterprise' }
 *
 * Admin-only endpoint (ADMIN_EMAILS env var).
 */
export async function POST(request: NextRequest) {
  try {
    const result = await requireAdmin();
    if ('error' in result) return result.error;

    const body = await request.json();
    const { organizationId, planTier } = body as {
      organizationId: string;
      planTier: PlanTier;
    };

    // Validate input
    if (!organizationId || !planTier) {
      return NextResponse.json(
        { error: 'Missing organizationId or planTier' },
        { status: 400 }
      );
    }

    if (!['rep', 'manager', 'enterprise'].includes(planTier)) {
      return NextResponse.json(
        { error: 'Invalid planTier — must be rep, manager, or enterprise' },
        { status: 400 }
      );
    }

    // Verify organization exists
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

    const plan = getPlan(planTier);

    // Step 1: Cancel all existing active subscriptions for this org
    await db
      .update(subscriptions)
      .set({
        status: 'canceled',
        canceledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(subscriptions.organizationId, organizationId),
          eq(subscriptions.status, 'active')
        )
      );

    // Step 2: Create new subscription with target plan limits
    const now = new Date();
    const periodEnd = new Date();
    periodEnd.setFullYear(periodEnd.getFullYear() + 100); // effectively unlimited

    const [newSubscription] = await db
      .insert(subscriptions)
      .values({
        organizationId,
        whopSubscriptionId: `admin_grant_${organizationId}_${Date.now()}`,
        whopPlanId: `admin_${planTier}`,
        planTier,
        status: 'active',
        seats: plan.maxSeats,
        callsPerMonth: plan.callsPerMonth,
        roleplaySessionsPerMonth: plan.roleplaySessionsPerMonth,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      })
      .returning();

    // Step 3: Update organization's planTier
    await db
      .update(organizations)
      .set({
        planTier,
        maxSeats: plan.maxSeats,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId));

    console.log(
      `[admin/grant-access] Admin ${result.session.user.email} granted ${planTier} to org ${org[0].name} (${organizationId})`
    );

    return NextResponse.json({
      success: true,
      message: `Organization "${org[0].name}" upgraded to ${plan.name}`,
      subscription: {
        id: newSubscription.id,
        planTier: newSubscription.planTier,
        status: newSubscription.status,
        callsPerMonth: newSubscription.callsPerMonth,
        roleplaySessionsPerMonth: newSubscription.roleplaySessionsPerMonth,
        seats: newSubscription.seats,
      },
    });
  } catch (error) {
    console.error('[admin/grant-access] Error:', error);
    return NextResponse.json(
      { error: 'Failed to grant access' },
      { status: 500 }
    );
  }
}
