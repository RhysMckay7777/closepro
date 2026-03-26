// Coupon code configuration — server-only
// Coupons map a code to a discount and optional per-tier alternate Whop plans

import { PlanTier } from './plans';

export interface Coupon {
  code: string;
  discountPercent: number;
  description: string;
  // Per-tier Whop plan IDs for this coupon's discounted checkout pages.
  // Each tier that has a discounted Whop plan should have an env var here.
  whopPlanIdEnvVars?: Partial<Record<PlanTier, string>>;
  isActive: boolean;
}

// All configured coupons — add new coupons here
const COUPONS: Coupon[] = [
  {
    code: 'CONNOR50',
    discountPercent: 50,
    description: '50% off any plan',
    whopPlanIdEnvVars: {
      rep: 'WHOP_COUPON_CONNOR50_REP_PLAN_ID',
      manager: 'WHOP_COUPON_CONNOR50_MANAGER_PLAN_ID',
    },
    isActive: true,
  },
];

/**
 * Validate a coupon code. Case-insensitive.
 * Returns the coupon if valid, null if invalid/inactive.
 */
export function validateCoupon(code: string): Coupon | null {
  const normalized = code.trim().toUpperCase();
  const coupon = COUPONS.find(
    (c) => c.code === normalized && c.isActive
  );
  return coupon || null;
}

/**
 * Get the Whop plan ID for a coupon + tier combination.
 * Returns the discounted plan ID if configured, or null to fall back to regular checkout.
 */
export function getCouponWhopPlanId(coupon: Coupon, tier: PlanTier): string | null {
  if (!coupon.whopPlanIdEnvVars) return null;
  const envVar = coupon.whopPlanIdEnvVars[tier];
  if (!envVar) return null;
  return process.env[envVar] || null;
}
