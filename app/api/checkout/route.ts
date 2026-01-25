import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { users, organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createWhopCheckoutUrl } from '@/lib/whop';
import { PlanTier } from '@/lib/plans';

/**
 * Checkout API - Creates Whop checkout URL
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

    // For enterprise, redirect to contact sales
    if (planTier === 'enterprise') {
      return NextResponse.json({
        checkoutUrl: '/contact-sales', // You can create this page
      });
    }

    // Create Whop checkout URL
    const checkoutUrl = createWhopCheckoutUrl(
      planTier,
      user[0].organizationId,
      user[0].email
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
