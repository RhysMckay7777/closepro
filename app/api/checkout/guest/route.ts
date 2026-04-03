import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { pendingCheckouts } from '@/db/schema';
import { createGuestWhopCheckoutUrl } from '@/lib/whop';
import { ActivePlanTier, PLANS } from '@/lib/plans';
import { validateCoupon, getCouponWhopPlanId } from '@/lib/coupons';
import { randomUUID } from 'crypto';

const VALID_PAID_TIERS: ActivePlanTier[] = ['rep', 'manager', 'enterprise'];

/**
 * Guest Checkout API — no auth required.
 * Creates a pending checkout record and returns a Whop checkout URL.
 * Used when unauthenticated users select a plan from the pricing page.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { planTier, couponCode, email } = body as {
      planTier: ActivePlanTier;
      couponCode?: string;
      email?: string;
    };

    if (!planTier || !VALID_PAID_TIERS.includes(planTier)) {
      return NextResponse.json(
        { error: 'Invalid plan tier' },
        { status: 400 }
      );
    }

    // Generate a unique checkout token
    const checkoutToken = randomUUID();

    // Get the base URL for the redirect after payment
    const origin = request.headers.get('origin') || request.headers.get('referer')?.replace(/\/[^/]*$/, '') || '';
    const redirectUrl = `${origin}/signup?checkout=${checkoutToken}`;

    // Validate coupon if provided
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
        // Store pending checkout
        await db.insert(pendingCheckouts).values({
          checkoutToken,
          planTier,
          couponCode: coupon.code,
          email: email || null,
        });

        // Use the discounted Whop plan directly
        const baseUrl = `https://whop.com/checkout/${couponPlanId}`;
        const params = new URLSearchParams({
          metadata: JSON.stringify({ checkoutToken, planTier, couponCode: coupon.code }),
          ...(email && { prefilled_email: email }),
          d: redirectUrl,
        });
        return NextResponse.json({
          checkoutUrl: `${baseUrl}?${params.toString()}`,
          checkoutToken,
          discount: couponDiscount,
        });
      }
    }

    // Store pending checkout record
    await db.insert(pendingCheckouts).values({
      checkoutToken,
      planTier,
      couponCode: couponCode || null,
      email: email || null,
    });

    // Generate Whop checkout URL
    const checkoutUrl = createGuestWhopCheckoutUrl(
      planTier,
      checkoutToken,
      email,
      redirectUrl,
    );

    return NextResponse.json({
      checkoutUrl,
      checkoutToken,
      ...(couponDiscount && { discount: couponDiscount }),
    });
  } catch (error) {
    console.error('Error creating guest checkout:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout' },
      { status: 500 }
    );
  }
}
