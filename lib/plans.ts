// Plan configuration for ProCloser
export type PlanTier = 'rep' | 'manager' | 'enterprise';
export type ActivePlanTier = PlanTier;

export interface PlanFeatures {
  name: string;
  tier: PlanTier;
  price: number; // in GBP
  includedSeats: number;
  additionalSeatPrice: number; // price per extra seat (GBP/month)
  maxSeats: number; // hard cap
  callsPerMonth: number;
  roleplaySessionsPerMonth: number;
  features: {
    aiAnalysis: boolean;
    managerDashboard: boolean;
    aiRoleplay: boolean;
    prioritySupport: boolean;
    customIntegrations: boolean;
  };
  whopPlanId?: string; // Set this to your actual Whop plan IDs
  stripePriceId?: string; // Stripe Price ID for this plan
}

export const PLANS: Record<ActivePlanTier, PlanFeatures> = {
  rep: {
    name: 'Rep',
    tier: 'rep',
    price: 9,
    includedSeats: 1,
    additionalSeatPrice: 0, // single-seat plan, no add-ons
    maxSeats: 1,
    callsPerMonth: 200,
    roleplaySessionsPerMonth: 50,
    features: {
      aiAnalysis: true,
      managerDashboard: false,
      aiRoleplay: true,
      prioritySupport: true,
      customIntegrations: false,
    },
    whopPlanId: process.env.WHOP_REP_PLAN_ID,
    stripePriceId: process.env.STRIPE_REP_PRICE_ID,
  },
  manager: {
    name: 'Manager',
    tier: 'manager',
    price: 59,
    includedSeats: 2,
    additionalSeatPrice: 9, // £9 per extra seat
    maxSeats: 50,
    callsPerMonth: 500,
    roleplaySessionsPerMonth: 100,
    features: {
      aiAnalysis: true,
      managerDashboard: true,
      aiRoleplay: true,
      prioritySupport: true,
      customIntegrations: false,
    },
    whopPlanId: process.env.WHOP_MANAGER_PLAN_ID,
    stripePriceId: process.env.STRIPE_MANAGER_PRICE_ID,
  },
  enterprise: {
    name: 'Pro Closer AI',
    tier: 'enterprise',
    price: 107, // 3-month Rep bundle
    includedSeats: 1,
    additionalSeatPrice: 0,
    maxSeats: 1,
    callsPerMonth: 200,
    roleplaySessionsPerMonth: 50,
    features: {
      aiAnalysis: true,
      managerDashboard: false,
      aiRoleplay: true,
      prioritySupport: true,
      customIntegrations: false,
    },
    whopPlanId: process.env.WHOP_ENTERPRISE_PLAN_ID,
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID,
  },
};

/**
 * Get plan configuration by tier.
 */
export function getPlan(tier: PlanTier): PlanFeatures {
  return PLANS[tier] ?? PLANS.rep;
}

/**
 * Get plan tier from Whop plan ID
 */
export function getPlanTierFromWhopId(whopPlanId: string): PlanTier | null {
  for (const [tier, plan] of Object.entries(PLANS)) {
    if (plan.whopPlanId === whopPlanId) {
      return tier as PlanTier;
    }
  }
  return null;
}

/**
 * Get plan tier from Stripe Price ID
 */
export function getPlanTierFromStripePriceId(stripePriceId: string): PlanTier | null {
  for (const [tier, plan] of Object.entries(PLANS)) {
    if (plan.stripePriceId === stripePriceId) {
      return tier as PlanTier;
    }
  }
  return null;
}

/**
 * Check if a feature is available for a plan tier
 */
export function hasFeature(tier: PlanTier, feature: keyof PlanFeatures['features']): boolean {
  return getPlan(tier).features[feature];
}

/**
 * Check if usage is within plan limits
 */
export function isWithinLimit(
  tier: PlanTier,
  usageType: 'calls' | 'roleplay' | 'seats',
  currentUsage: number
): boolean {
  const plan = getPlan(tier);
  
  switch (usageType) {
    case 'calls':
      return plan.callsPerMonth === -1 || currentUsage < plan.callsPerMonth;
    case 'roleplay':
      return plan.roleplaySessionsPerMonth === -1 || currentUsage < plan.roleplaySessionsPerMonth;
    case 'seats':
      return currentUsage <= plan.maxSeats;
    default:
      return false;
  }
}

/**
 * Get usage percentage for display
 */
export function getUsagePercentage(
  tier: PlanTier,
  usageType: 'calls' | 'roleplay',
  currentUsage: number
): number {
  const plan = getPlan(tier);
  const limit = usageType === 'calls' ? plan.callsPerMonth : plan.roleplaySessionsPerMonth;
  
  if (limit === -1) return 0; // Unlimited
  if (limit === 0) return 0; // Not available
  return Math.min((currentUsage / limit) * 100, 100);
}

/**
 * Check if a tier is a paid (active) tier
 */
export function isActivePaidTier(tier: string): tier is ActivePlanTier {
  return tier in PLANS;
}
