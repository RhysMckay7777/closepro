import { NextRequest, NextResponse } from 'next/server';
import { constructWebhookEvent, mapStripeStatus } from '@/lib/stripe';
import { db } from '@/db';
import { subscriptions, organizations, billingHistory } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getPlanTierFromStripePriceId, PLANS, PlanTier } from '@/lib/plans';
import type Stripe from 'stripe';

/**
 * Stripe Webhook Handler
 * Handles subscription lifecycle events from Stripe
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    // Verify and parse the webhook event
    const event = constructWebhookEvent(body, signature);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaymentFailed(invoice);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 400 }
    );
  }
}

/**
 * Handle successful checkout — create or update subscription
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const organizationId = session.metadata?.organizationId;
  const planTier = session.metadata?.planTier as PlanTier | undefined;

  if (!organizationId || !planTier) {
    console.error('Missing metadata in checkout session:', session.id);
    return;
  }

  const stripeSubscriptionId = session.subscription as string;
  const stripeCustomerId = session.customer as string;

  const plan = PLANS[planTier];
  if (!plan) {
    console.error('Unknown plan tier in checkout:', planTier);
    return;
  }

  // Upsert subscription record
  const existing = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, organizationId))
    .limit(1);

  const subscriptionData = {
    stripeSubscriptionId,
    stripeCustomerId,
    status: 'active' as const,
    planTier,
    seats: plan.maxSeats,
    callsPerMonth: plan.callsPerMonth,
    roleplaySessionsPerMonth: plan.roleplaySessionsPerMonth,
    updatedAt: new Date(),
  };

  if (existing.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db
      .update(subscriptions)
      .set(subscriptionData as any)
      .where(eq(subscriptions.organizationId, organizationId));
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.insert(subscriptions).values({
      organizationId,
      ...subscriptionData,
    } as any);
  }

  // Update organization plan tier
  await db
    .update(organizations)
    .set({
      planTier,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId));

  // Log billing event
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.insert(billingHistory).values({
    organizationId,
    stripeEventId: session.id,
    eventType: 'checkout_completed',
    amount: session.amount_total || 0,
    currency: session.currency || 'usd',
    status: 'succeeded',
    description: `Subscribed to ${plan.name} plan`,
  } as any);
}

/**
 * Handle successful invoice payment
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // invoice.subscription may be string or object depending on Stripe API version
  const invoiceAny = invoice as any;
  const subscriptionId = typeof invoiceAny.subscription === 'string'
    ? invoiceAny.subscription
    : invoiceAny.subscription?.id;
  if (!subscriptionId) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sub = await db
    .select()
    .from(subscriptions)
    .where(eq((subscriptions as any).stripeSubscriptionId, subscriptionId))
    .limit(1);

  if (sub.length === 0) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db
    .update(subscriptions)
    .set({
      status: 'active',
      currentPeriodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : undefined,
      currentPeriodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : undefined,
      updatedAt: new Date(),
    } as any)
    .where(eq((subscriptions as any).stripeSubscriptionId, subscriptionId));

  // Log billing event
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.insert(billingHistory).values({
    organizationId: sub[0].organizationId,
    subscriptionId: sub[0].id,
    stripeEventId: invoice.id,
    eventType: 'payment_succeeded',
    amount: invoice.amount_paid || 0,
    currency: invoice.currency || 'usd',
    status: 'succeeded',
    description: 'Payment for subscription',
  } as any);
}

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const invoiceAny = invoice as any;
  const subscriptionId = typeof invoiceAny.subscription === 'string'
    ? invoiceAny.subscription
    : invoiceAny.subscription?.id;
  if (!subscriptionId) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sub = await db
    .select()
    .from(subscriptions)
    .where(eq((subscriptions as any).stripeSubscriptionId, subscriptionId))
    .limit(1);

  if (sub.length === 0) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db
    .update(subscriptions)
    .set({
      status: 'past_due',
      updatedAt: new Date(),
    } as any)
    .where(eq((subscriptions as any).stripeSubscriptionId, subscriptionId));

  // Log billing event
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.insert(billingHistory).values({
    organizationId: sub[0].organizationId,
    subscriptionId: sub[0].id,
    stripeEventId: invoice.id,
    eventType: 'payment_failed',
    amount: invoice.amount_due || 0,
    currency: invoice.currency || 'usd',
    status: 'failed',
    description: 'Payment failed',
  } as any);
}

/**
 * Handle subscription updates (plan changes, cancellations, etc.)
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sub = await db
    .select()
    .from(subscriptions)
    .where(eq((subscriptions as any).stripeSubscriptionId, subscription.id))
    .limit(1);

  if (sub.length === 0) return;

  const priceId = subscription.items.data[0]?.price?.id;
  const newTier = priceId ? getPlanTierFromStripePriceId(priceId) : null;
  const plan = newTier ? PLANS[newTier] : null;

  // Get current period timestamps from the subscription item
  const currentItem = subscription.items.data[0];
  const periodStart = (subscription as any).current_period_start;
  const periodEnd = (subscription as any).current_period_end;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db
    .update(subscriptions)
    .set({
      status: mapStripeStatus(subscription.status),
      ...(newTier && { planTier: newTier }),
      ...(plan && {
        seats: plan.maxSeats,
        callsPerMonth: plan.callsPerMonth,
        roleplaySessionsPerMonth: plan.roleplaySessionsPerMonth,
      }),
      stripePriceId: priceId || undefined,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
      ...(periodStart && { currentPeriodStart: new Date(periodStart * 1000) }),
      ...(periodEnd && { currentPeriodEnd: new Date(periodEnd * 1000) }),
      updatedAt: new Date(),
    } as any)
    .where(eq((subscriptions as any).stripeSubscriptionId, subscription.id));

  // Update org plan tier if changed
  if (newTier) {
    await db
      .update(organizations)
      .set({
        planTier: newTier,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, sub[0].organizationId));
  }
}

/**
 * Handle subscription deletion (cancellation)
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db
    .update(subscriptions)
    .set({
      status: 'canceled',
      canceledAt: new Date(),
      updatedAt: new Date(),
    } as any)
    .where(eq((subscriptions as any).stripeSubscriptionId, subscription.id));

  // Downgrade org to starter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sub = await db
    .select()
    .from(subscriptions)
    .where(eq((subscriptions as any).stripeSubscriptionId, subscription.id))
    .limit(1);

  if (sub.length > 0) {
    await db
      .update(organizations)
      .set({
        planTier: 'starter',
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, sub[0].organizationId));
  }
}
