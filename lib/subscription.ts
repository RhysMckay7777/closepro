// Subscription utilities and verification
import { db } from '@/db';
import { subscriptions, usageTracking, organizations, userOrganizations } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { PlanTier, isWithinLimit } from './plans';
import { shouldBypassSubscription } from './dev-mode';

/**
 * Get active subscription for an organization
 */
export async function getActiveSubscription(organizationId: string) {
  const result = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.organizationId, organizationId),
        eq(subscriptions.status, 'active')
      )
    )
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  return result[0] || null;
}

/**
 * Get current month's usage for an organization
 */
export async function getCurrentUsage(organizationId: string) {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  const result = await db
    .select()
    .from(usageTracking)
    .where(
      and(
        eq(usageTracking.organizationId, organizationId),
        eq(usageTracking.month, currentMonth)
      )
    )
    .limit(1);

  if (result.length === 0) {
    // Create new usage tracking record for this month
    const newUsage = await db
      .insert(usageTracking)
      .values({
        organizationId,
        month: currentMonth,
        callsUsed: 0,
        roleplaySessionsUsed: 0,
      })
      .returning();
    
    return newUsage[0];
  }

  return result[0];
}

/**
 * Increment usage counter
 */
export async function incrementUsage(
  organizationId: string,
  type: 'calls' | 'roleplay'
): Promise<void> {
  const currentMonth = new Date().toISOString().slice(0, 7);

  // Ensure usage record exists
  const usage = await getCurrentUsage(organizationId);

  if (type === 'calls') {
    await db
      .update(usageTracking)
      .set({ callsUsed: usage.callsUsed + 1 })
      .where(eq(usageTracking.id, usage.id));
  } else {
    await db
      .update(usageTracking)
      .set({ roleplaySessionsUsed: usage.roleplaySessionsUsed + 1 })
      .where(eq(usageTracking.id, usage.id));
  }
}

/**
 * Check if organization can perform an action based on plan limits.
 * Auto-creates a Starter subscription if org has none.
 */
export async function canPerformAction(
  organizationId: string,
  action: 'upload_call' | 'start_roleplay'
): Promise<{ allowed: boolean; reason?: string }> {
  // Bypass subscription checks in dev mode
  if (shouldBypassSubscription()) {
    return { allowed: true };
  }

  // Get organization
  const org = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!org[0]) {
    return { allowed: false, reason: 'Organization not found' };
  }

  if (!org[0].isActive) {
    return { allowed: false, reason: 'Organization is not active' };
  }

  // Get subscription
  let subscription = await getActiveSubscription(organizationId);
  
  // Auto-create Starter subscription if none exists
  if (!subscription) {
    // Check if in trial period first
    if (org[0].trialEndsAt && new Date(org[0].trialEndsAt) > new Date()) {
      return { allowed: true };
    }

    // Auto-create free Starter subscription
    const { PLANS } = await import('./plans');
    const starterPlan = PLANS.starter;
    const now = new Date();
    const periodEnd = new Date();
    periodEnd.setFullYear(periodEnd.getFullYear() + 100);

    const [newSub] = await db.insert(subscriptions).values({
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
    }).returning();

    subscription = newSub;
  }

  // Check subscription status
  if (subscription.status !== 'active' && subscription.status !== 'trialing') {
    return { 
      allowed: false, 
      reason: `Subscription is ${subscription.status}` 
    };
  }

  // Get current usage
  const usage = await getCurrentUsage(organizationId);

  // Check limits based on action
  if (action === 'upload_call') {
    if (subscription.callsPerMonth === -1) {
      return { allowed: true }; // Unlimited
    }
    
    if (usage.callsUsed >= subscription.callsPerMonth) {
      return { 
        allowed: false, 
        reason: `You've used all ${subscription.callsPerMonth} calls this month. Upgrade to Pro for 200 calls/month.` 
      };
    }
    
    return { allowed: true };
  }

  if (action === 'start_roleplay') {
    // Check if plan includes roleplay
    if (subscription.roleplaySessionsPerMonth === 0) {
      return { 
        allowed: false, 
        reason: 'AI Roleplay is not available on the Starter plan. Upgrade to Pro to unlock 50 sessions/month.' 
      };
    }

    if (subscription.roleplaySessionsPerMonth === -1) {
      return { allowed: true }; // Unlimited
    }
    
    if (usage.roleplaySessionsUsed >= subscription.roleplaySessionsPerMonth) {
      return { 
        allowed: false, 
        reason: `You've used all ${subscription.roleplaySessionsPerMonth} roleplay sessions this month. Upgrade to Pro or Enterprise for more.` 
      };
    }
    
    return { allowed: true };
  }

  return { allowed: false, reason: 'Unknown action' };
}

/**
 * Get organization seat count
 */
export async function getOrganizationSeatCount(organizationId: string): Promise<number> {
  const result = await db
    .select()
    .from(userOrganizations)
    .where(eq(userOrganizations.organizationId, organizationId));

  return result.length;
}

/**
 * Check if organization can add more seats
 */
export async function canAddSeat(organizationId: string): Promise<boolean> {
  // Bypass seat limits in dev mode
  if (shouldBypassSubscription()) {
    return true;
  }

  const subscription = await getActiveSubscription(organizationId);
  const currentSeats = await getOrganizationSeatCount(organizationId);
  
  // If no subscription, check organization defaults (for trial/new orgs)
  if (!subscription) {
    const org = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);
    
    if (!org[0]) return false;
    
    // Check if in trial period
    if (org[0].trialEndsAt && new Date(org[0].trialEndsAt) > new Date()) {
      return currentSeats < org[0].maxSeats;
    }
    
    // For new orgs without subscription, use default maxSeats
    return currentSeats < org[0].maxSeats;
  }

  // With subscription, check against subscription seats
  return currentSeats < subscription.seats;
}
