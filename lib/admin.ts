// Admin utilities — shared authorization helpers for admin-only endpoints
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

export interface AdminSession {
  user: {
    id: string;
    email: string;
    name: string;
  };
}

/**
 * Parse ADMIN_EMAILS env var into a normalized array.
 */
function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Check if an email is an admin.
 */
export function isAdminEmail(email: string): boolean {
  const admins = getAdminEmails();
  // If no ADMIN_EMAILS configured, deny all (secure by default)
  if (admins.length === 0) return false;
  return admins.includes(email.toLowerCase());
}

/**
 * Verify the current request is from an authenticated admin.
 * Returns the session if authorized, or a NextResponse error.
 */
export async function requireAdmin(): Promise<
  { session: AdminSession } | { error: NextResponse }
> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized — sign in required' },
        { status: 401 }
      ),
    };
  }

  if (!isAdminEmail(session.user.email)) {
    return {
      error: NextResponse.json(
        { error: 'Forbidden — admin access required' },
        { status: 403 }
      ),
    };
  }

  return {
    session: {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
      },
    },
  };
}
