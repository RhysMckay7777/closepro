// Coupon code configuration — server-only
// Coupons map a code to a discount and optional alternate Whop plan

export interface Coupon {
  code: string;
  discountPercent: number;
  description: string;
  // If the coupon uses a separate Whop plan (with discounted pricing already configured),
  // set this env var. Otherwise, the discount is applied via Whop's coupon param.
  whopPlanIdEnvVar?: string;
  isActive: boolean;
}

// All configured coupons — add new coupons here
const COUPONS: Coupon[] = [
  {
    code: 'CONNOR50',
    discountPercent: 50,
    description: '50% off Pro plan',
    whopPlanIdEnvVar: 'WHOP_COUPON_CONNOR50_PLAN_ID',
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
 * Get the Whop plan ID for a coupon (if it has an alternate plan configured).
 * Falls back to null if no alternate plan is set.
 */
export function getCouponWhopPlanId(coupon: Coupon): string | null {
  if (!coupon.whopPlanIdEnvVar) return null;
  return process.env[coupon.whopPlanIdEnvVar] || null;
}
