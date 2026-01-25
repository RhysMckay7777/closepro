import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { subscriptions, billingHistory, organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyWhopWebhook, parseWhopWebhook, mapWhopStatus } from '@/lib/whop';
import { getPlanTierFromWhopId, PLANS } from '@/lib/plans';

const WHOP_WEBHOOK_SECRET = process.env.WHOP_WEBHOOK_SECRET || '';

/**
 * Whop Webhook Handler
 * Handles subscription events from Whop
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('whop-signature') || '';

    // Verify webhook signature
    if (!verifyWhopWebhook(body, signature, WHOP_WEBHOOK_SECRET)) {
      console.error('Invalid Whop webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const event = parseWhopWebhook(JSON.parse(body));

    console.log('Received Whop webhook:', event.type, event.id);

    // Handle different event types
    switch (event.type) {
      case 'subscription.created':
      case 'subscription.updated':
        await handleSubscriptionUpdate(event);
        break;

      case 'subscription.canceled':
        await handleSubscriptionCanceled(event);
        break;

      case 'payment.succeeded':
        await handlePaymentSucceeded(event);
        break;

      case 'payment.failed':
        await handlePaymentFailed(event);
        break;

      default:
        console.log('Unhandled Whop event type:', event.type);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing Whop webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle subscription creation or update
 */
async function handleSubscriptionUpdate(event: any) {
  const whopSubscription = event.data.subscription;
  
  if (!whopSubscription) {
    console.error('No subscription data in event');
    return;
  }

  // Get organization from metadata (passed during checkout)
  const metadata = whopSubscription.metadata || {};
  const organizationId = metadata.organizationId;

  if (!organizationId) {
    console.error('No organizationId in subscription metadata');
    return;
  }

  // Determine plan tier from Whop plan ID
  const planTier = getPlanTierFromWhopId(whopSubscription.plan_id);
  
  if (!planTier) {
    console.error('Unknown Whop plan ID:', whopSubscription.plan_id);
    return;
  }

  const planConfig = PLANS[planTier];

  // Check if subscription already exists
  const existing = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.whopSubscriptionId, whopSubscription.id))
    .limit(1);

  const subscriptionData = {
    organizationId,
    whopSubscriptionId: whopSubscription.id,
    whopCustomerId: whopSubscription.user_id,
    whopPlanId: whopSubscription.plan_id,
    status: mapWhopStatus(whopSubscription.status),
    planTier,
    seats: planConfig.maxSeats,
    callsPerMonth: planConfig.callsPerMonth,
    roleplaySessionsPerMonth: planConfig.roleplaySessionsPerMonth,
    currentPeriodStart: new Date(whopSubscription.current_period_start * 1000),
    currentPeriodEnd: new Date(whopSubscription.current_period_end * 1000),
    cancelAtPeriodEnd: whopSubscription.cancel_at_period_end,
    canceledAt: whopSubscription.canceled_at 
      ? new Date(whopSubscription.canceled_at * 1000) 
      : null,
    updatedAt: new Date(),
  };

  if (existing.length > 0) {
    // Update existing subscription
    await db
      .update(subscriptions)
      .set(subscriptionData)
      .where(eq(subscriptions.id, existing[0].id));
    
    console.log('Updated subscription:', existing[0].id);
  } else {
    // Create new subscription
    await db
      .insert(subscriptions)
      .values(subscriptionData);
    
    console.log('Created new subscription for org:', organizationId);
  }

  // Update organization plan tier and status
  await db
    .update(organizations)
    .set({
      planTier,
      maxSeats: planConfig.maxSeats,
      isActive: whopSubscription.status === 'active' || whopSubscription.status === 'trialing',
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId));
}

/**
 * Handle subscription cancellation
 */
async function handleSubscriptionCanceled(event: any) {
  const whopSubscription = event.data.subscription;
  
  if (!whopSubscription) return;

  // Update subscription status
  await db
    .update(subscriptions)
    .set({
      status: 'canceled',
      canceledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.whopSubscriptionId, whopSubscription.id));

  // Find and update organization
  const subscription = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.whopSubscriptionId, whopSubscription.id))
    .limit(1);

  if (subscription.length > 0) {
    await db
      .update(organizations)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, subscription[0].organizationId));
    
    console.log('Canceled subscription and deactivated org:', subscription[0].organizationId);
  }
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(event: any) {
  const payment = event.data.payment;
  
  if (!payment) return;

  // Find subscription
  const subscription = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.whopSubscriptionId, payment.subscription_id))
    .limit(1);

  if (subscription.length === 0) {
    console.error('Subscription not found for payment:', payment.subscription_id);
    return;
  }

  // Record billing history
  await db
    .insert(billingHistory)
    .values({
      organizationId: subscription[0].organizationId,
      subscriptionId: subscription[0].id,
      whopEventId: event.id,
      eventType: 'payment_succeeded',
      amount: payment.amount,
      currency: payment.currency,
      status: 'succeeded',
      description: `Payment for ${subscription[0].planTier} plan`,
      metadata: JSON.stringify(payment),
    });

  console.log('Recorded successful payment for subscription:', payment.subscription_id);
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(event: any) {
  const payment = event.data.payment;
  
  if (!payment) return;

  // Find subscription
  const subscription = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.whopSubscriptionId, payment.subscription_id))
    .limit(1);

  if (subscription.length === 0) return;

  // Record billing history
  await db
    .insert(billingHistory)
    .values({
      organizationId: subscription[0].organizationId,
      subscriptionId: subscription[0].id,
      whopEventId: event.id,
      eventType: 'payment_failed',
      amount: payment.amount,
      currency: payment.currency,
      status: 'failed',
      description: `Failed payment for ${subscription[0].planTier} plan`,
      metadata: JSON.stringify(payment),
    });

  // Update subscription status to past_due
  await db
    .update(subscriptions)
    .set({
      status: 'past_due',
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, subscription[0].id));

  console.log('Recorded failed payment and marked subscription past_due:', payment.subscription_id);
}
