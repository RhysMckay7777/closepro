// Whop API integration utilities
import { PlanTier, ActivePlanTier, getPlanTierFromWhopId, PLANS } from './plans';

const WHOP_API_KEY = process.env.WHOP_API_KEY;
const WHOP_API_URL = 'https://api.whop.com/v1';

interface WhopSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'active' | 'past_due' | 'canceled' | 'trialing';
  current_period_start: number;
  current_period_end: number;
  cancel_at_period_end: boolean;
  canceled_at?: number;
}

interface WhopWebhookEvent {
  id: string;
  type: string;
  data: {
    subscription?: WhopSubscription;
    payment?: {
      id: string;
      amount: number;
      currency: string;
      status: string;
      subscription_id: string;
    };
  };
  created_at: number;
}

/**
 * Verify Whop webhook signature
 */
export function verifyWhopWebhook(
  payload: string,
  signature: string,
  secret: string
): boolean {
  // Implement Whop's signature verification
  // This is a placeholder - check Whop's docs for actual implementation
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return signature === expectedSignature;
}

/**
 * Get subscription from Whop API
 */
export async function getWhopSubscription(subscriptionId: string): Promise<WhopSubscription | null> {
  if (!WHOP_API_KEY) {
    throw new Error('WHOP_API_KEY is not configured');
  }

  try {
    const response = await fetch(`${WHOP_API_URL}/subscriptions/${subscriptionId}`, {
      headers: {
        'Authorization': `Bearer ${WHOP_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Failed to fetch Whop subscription:', response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching Whop subscription:', error);
    return null;
  }
}

/**
 * Create a Whop checkout URL for Rep or Manager plans
 */
export function createWhopCheckoutUrl(
  planTier: PlanTier,
  organizationId: string,
  userEmail: string
): string {
  // Map tier to the correct env var
  let whopPlanId: string | undefined;

  if (planTier === 'rep') {
    whopPlanId = process.env.WHOP_REP_PLAN_ID;
  } else if (planTier === 'manager') {
    whopPlanId = process.env.WHOP_MANAGER_PLAN_ID;
  }

  if (!whopPlanId) {
    throw new Error(`Whop plan ID not configured for tier: ${planTier}. Set WHOP_${planTier.toUpperCase()}_PLAN_ID in env.`);
  }

  // Build checkout URL with metadata
  const baseUrl = `https://whop.com/checkout/${whopPlanId}`;
  const params = new URLSearchParams({
    metadata: JSON.stringify({
      organizationId,
      planTier,
    }),
    prefilled_email: userEmail,
  });

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Cancel a subscription via Whop API
 */
export async function cancelWhopSubscription(subscriptionId: string): Promise<boolean> {
  if (!WHOP_API_KEY) {
    throw new Error('WHOP_API_KEY is not configured');
  }

  try {
    const response = await fetch(`${WHOP_API_URL}/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHOP_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    return response.ok;
  } catch (error) {
    console.error('Error canceling Whop subscription:', error);
    return false;
  }
}

/**
 * Parse Whop webhook event
 */
export function parseWhopWebhook(payload: any): WhopWebhookEvent {
  return payload as WhopWebhookEvent;
}

/**
 * Map Whop subscription status to our internal status
 */
export function mapWhopStatus(
  whopStatus: string
): 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete' | 'paused' {
  switch (whopStatus) {
    case 'active':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    case 'trialing':
      return 'trialing';
    default:
      return 'incomplete';
  }
}

export type { WhopSubscription, WhopWebhookEvent };
