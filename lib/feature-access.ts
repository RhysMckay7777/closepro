// Feature access control utilities
import { PlanTier, hasFeature as planHasFeature } from './plans';
import { getActiveSubscription } from './subscription';
import { shouldBypassSubscription } from './dev-mode';

/**
 * Check if organization has access to a specific feature
 */
export async function hasFeatureAccess(
  organizationId: string,
  feature: 'aiAnalysis' | 'managerDashboard' | 'aiRoleplay' | 'prioritySupport' | 'customIntegrations'
): Promise<boolean> {
  // Bypass all checks in dev mode
  if (shouldBypassSubscription()) {
    return true;
  }

  const subscription = await getActiveSubscription(organizationId);
  
  if (!subscription) {
    // No subscription - check if feature is available in free tier
    return feature === 'aiAnalysis' || feature === 'managerDashboard';
  }

  // Check if subscription is active
  if (subscription.status !== 'active' && subscription.status !== 'trialing') {
    return false;
  }

  return planHasFeature(subscription.planTier, feature);
}

/**
 * Middleware-style function to check feature access
 * Throws an error if access is denied
 */
export async function requireFeatureAccess(
  organizationId: string,
  feature: 'aiAnalysis' | 'managerDashboard' | 'aiRoleplay' | 'prioritySupport' | 'customIntegrations'
): Promise<void> {
  const hasAccess = await hasFeatureAccess(organizationId, feature);
  
  if (!hasAccess) {
    throw new Error(`Feature '${feature}' is not available in your plan`);
  }
}

/**
 * Get feature access map for an organization
 */
export async function getFeatureAccessMap(organizationId: string): Promise<{
  aiAnalysis: boolean;
  managerDashboard: boolean;
  aiRoleplay: boolean;
  prioritySupport: boolean;
  customIntegrations: boolean;
}> {
  // Bypass all checks in dev mode - all features available
  if (shouldBypassSubscription()) {
    return {
      aiAnalysis: true,
      managerDashboard: true,
      aiRoleplay: true,
      prioritySupport: true,
      customIntegrations: true,
    };
  }

  const subscription = await getActiveSubscription(organizationId);
  
  if (!subscription) {
    return {
      aiAnalysis: true,
      managerDashboard: true,
      aiRoleplay: false,
      prioritySupport: false,
      customIntegrations: false,
    };
  }

  const isActiveSubscription = 
    subscription.status === 'active' || subscription.status === 'trialing';

  if (!isActiveSubscription) {
    return {
      aiAnalysis: false,
      managerDashboard: false,
      aiRoleplay: false,
      prioritySupport: false,
      customIntegrations: false,
    };
  }

  return {
    aiAnalysis: planHasFeature(subscription.planTier, 'aiAnalysis'),
    managerDashboard: planHasFeature(subscription.planTier, 'managerDashboard'),
    aiRoleplay: planHasFeature(subscription.planTier, 'aiRoleplay'),
    prioritySupport: planHasFeature(subscription.planTier, 'prioritySupport'),
    customIntegrations: planHasFeature(subscription.planTier, 'customIntegrations'),
  };
}
