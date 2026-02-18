// Development mode utilities
// When ENVIRONMENTTYPE=dev, bypass subscription checks for testing

export function isDevMode(): boolean {
  return process.env.ENVIRONMENTTYPE === 'dev';
}

/**
 * Only bypass subscriptions in dev mode AND when running on localhost.
 * This prevents accidental subscription bypass on staging/production deployments.
 */
export function shouldBypassSubscription(): boolean {
  if (!isDevMode()) return false;
  const authUrl = process.env.BETTER_AUTH_URL || '';
  return authUrl.includes('localhost') || authUrl.includes('127.0.0.1');
}
