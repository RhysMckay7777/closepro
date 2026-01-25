// Plan configuration for ClosePro
export type PlanTier = 'starter' | 'pro' | 'enterprise';

export interface PlanFeatures {
  name: string;
  tier: PlanTier;
  price: number; // in dollars
  maxSeats: number;
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
}

export const PLANS: Record<PlanTier, PlanFeatures> = {
  starter: {
    name: 'Starter',
    tier: 'starter',
    price: 99,
    maxSeats: 5,
    callsPerMonth: 50,
    roleplaySessionsPerMonth: 0,
    features: {
      aiAnalysis: true,
      managerDashboard: true,
      aiRoleplay: false,
      prioritySupport: false,
      customIntegrations: false,
    },
    whopPlanId: process.env.WHOP_STARTER_PLAN_ID,
  },
  pro: {
    name: 'Pro',
    tier: 'pro',
    price: 399,
    maxSeats: 20,
    callsPerMonth: 200,
    roleplaySessionsPerMonth: 50,
    features: {
      aiAnalysis: true,
      managerDashboard: true,
      aiRoleplay: true,
      prioritySupport: true,
      customIntegrations: false,
    },
    whopPlanId: process.env.WHOP_PRO_PLAN_ID,
  },
  enterprise: {
    name: 'Enterprise',
    tier: 'enterprise',
    price: 0, // Custom pricing
    maxSeats: 999,
    callsPerMonth: -1, // Unlimited
    roleplaySessionsPerMonth: -1, // Unlimited
    features: {
      aiAnalysis: true,
      managerDashboard: true,
      aiRoleplay: true,
      prioritySupport: true,
      customIntegrations: true,
    },
    whopPlanId: process.env.WHOP_ENTERPRISE_PLAN_ID,
  },
};

/**
 * Get plan configuration by tier
 */
export function getPlan(tier: PlanTier): PlanFeatures {
  return PLANS[tier];
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
 * Check if a feature is available for a plan tier
 */
export function hasFeature(tier: PlanTier, feature: keyof PlanFeatures['features']): boolean {
  return PLANS[tier].features[feature];
}

/**
 * Check if usage is within plan limits
 */
export function isWithinLimit(
  tier: PlanTier,
  usageType: 'calls' | 'roleplay' | 'seats',
  currentUsage: number
): boolean {
  const plan = PLANS[tier];
  
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
  const plan = PLANS[tier];
  const limit = usageType === 'calls' ? plan.callsPerMonth : plan.roleplaySessionsPerMonth;
  
  if (limit === -1) return 0; // Unlimited
  return Math.min((currentUsage / limit) * 100, 100);
}
