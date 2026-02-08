'use client';

import { createAuthClient } from 'better-auth/react';

// Use environment variable if available, otherwise use window.location.origin
// CRITICAL: baseURL must match BETTER_AUTH_URL on the server for cookies to work
const baseURL = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');


export const authClient = createAuthClient({
  baseURL,
  // Better Auth automatically includes credentials, but we can be explicit
  fetchOptions: {
    credentials: 'include',
  },
});

export const { signIn, signUp, signOut, useSession } = authClient;

/** Convenience wrapper for Google OAuth sign-in */
export async function signInWithGoogle() {
  return authClient.signIn.social({
    provider: 'google',
    callbackURL: '/dashboard/create-organization',
  });
}
