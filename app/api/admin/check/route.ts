import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isAdminEmail } from '@/lib/admin';

/**
 * Lightweight endpoint to check if the current user is an admin.
 * Used by the sidebar to conditionally show the Admin link.
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.email) {
      return NextResponse.json({ isAdmin: false });
    }

    return NextResponse.json({
      isAdmin: isAdminEmail(session.user.email),
    });
  } catch {
    return NextResponse.json({ isAdmin: false });
  }
}
