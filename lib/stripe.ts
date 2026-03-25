// Stripe API integration utilities
import Stripe from 'stripe';
import { PlanTier } from './plans';

// Initialize Stripe with secret key
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    stripeInstance = new Stripe(stripeSecretKey, {
      apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
      typescript: true,
    });
  }
  return stripeInstance;
}

/**
 * Create a Stripe Checkout session for the given plan
 */
export async function createCheckoutSession(
  planTier: PlanTier,
  organizationId: string,
  userEmail: string,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  const stripe = getStripe();

  const priceId = getPriceIdForTier(planTier);
  if (!priceId) {
    throw new Error(`No Stripe price ID configured for plan tier: ${planTier}`);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: userEmail,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    metadata: {
      organizationId,
      planTier,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  if (!session.url) {
    throw new Error('Stripe checkout session created but no URL returned');
  }

  return session.url;
}

/**
 * Construct and verify a Stripe webhook event
 */
export function constructWebhookEvent(
  body: string | Buffer,
  signature: string
): Stripe.Event {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }

  return stripe.webhooks.constructEvent(body, signature, webhookSecret);
}

/**
 * Get a Stripe subscription by ID
 */
export async function getStripeSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription | null> {
  const stripe = getStripe();

  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error) {
    console.error('Error fetching Stripe subscription:', error);
    return null;
  }
}

/**
 * Cancel a Stripe subscription (at period end)
 */
export async function cancelStripeSubscription(
  subscriptionId: string
): Promise<boolean> {
  const stripe = getStripe();

  try {
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
    return true;
  } catch (error) {
    console.error('Error canceling Stripe subscription:', error);
    return false;
  }
}

/**
 * Create a Stripe Customer Portal session (for managing billing)
 */
export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  const stripe = getStripe();

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
}

/**
 * Get the Stripe Price ID for a given plan tier
 */
function getPriceIdForTier(tier: PlanTier): string | undefined {
  switch (tier) {
    case 'starter':
      return process.env.STRIPE_STARTER_PRICE_ID;
    case 'pro':
      return process.env.STRIPE_PRO_PRICE_ID;
    case 'enterprise':
      return process.env.STRIPE_ENTERPRISE_PRICE_ID;
    default:
      return undefined;
  }
}

/**
 * Map Stripe subscription status to our internal status
 */
export function mapStripeStatus(
  stripeStatus: Stripe.Subscription.Status
): 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete' | 'paused' {
  switch (stripeStatus) {
    case 'active':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    case 'trialing':
      return 'trialing';
    case 'incomplete':
    case 'incomplete_expired':
      return 'incomplete';
    case 'paused':
      return 'paused';
    default:
      return 'incomplete';
  }
}
