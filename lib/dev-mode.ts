// Development mode utilities
// When ENVIRONMENTTYPE=dev, bypass subscription checks for testing

export function isDevMode(): boolean {
  return process.env.ENVIRONMENTTYPE === 'dev';
}

export function shouldBypassSubscription(): boolean {
  return isDevMode();
}
