import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { users, subscriptions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { createWhopCheckoutUrl } from '@/lib/whop';
import { PlanTier, PLANS, ActivePlanTier } from '@/lib/plans';
import { validateCoupon, getCouponWhopPlanId } from '@/lib/coupons';

const VALID_PAID_TIERS: ActivePlanTier[] = ['rep', 'manager', 'enterprise'];

/**
 * Checkout API - Handles plan selection
 * - Rep: Redirects to Whop checkout (with optional coupon code)
 * - Manager: Redirects to Whop checkout (with optional coupon code)
 * - Enterprise: Returns mailto link for sales
 *
 * No free tier available.
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
    const { planTier, couponCode } = body as { planTier: ActivePlanTier; couponCode?: string };

    if (!planTier || !VALID_PAID_TIERS.includes(planTier)) {
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

    // Rep / Manager → redirect to Whop checkout (with optional coupon)
    let couponDiscount: number | undefined;

    if (couponCode) {
      const coupon = validateCoupon(couponCode);
      if (!coupon) {
        return NextResponse.json(
          { error: 'Invalid coupon code' },
          { status: 400 }
        );
      }

      couponDiscount = coupon.discountPercent;

      // Check if coupon has a dedicated discounted Whop plan for this tier
      const couponPlanId = getCouponWhopPlanId(coupon, planTier);
      if (couponPlanId) {
        // Use the discounted Whop plan directly
        const baseUrl = `https://whop.com/checkout/${couponPlanId}`;
        const params = new URLSearchParams({
          metadata: JSON.stringify({ organizationId, planTier, couponCode: coupon.code }),
          prefilled_email: user[0].email,
        });
        return NextResponse.json({
          checkoutUrl: `${baseUrl}?${params.toString()}`,
          discount: couponDiscount,
        });
      }
    }

    const checkoutUrl = createWhopCheckoutUrl(
      planTier,
      organizationId,
      user[0].email,
    );

    return NextResponse.json({
      checkoutUrl,
      ...(couponDiscount && { discount: couponDiscount }),
    });
  } catch (error) {
    console.error('Error creating checkout:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout' },
      { status: 500 }
    );
  }
}
