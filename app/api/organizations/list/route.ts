import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { getUserOrganizations } from '@/lib/organizations';

/**
 * Get all organizations the current user belongs to
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const organizations = await getUserOrganizations(session.user.id);

    return NextResponse.json({
      organizations: organizations.map(org => ({
        id: org.id,
        name: org.name,
        role: org.role,
        isPrimary: org.isPrimary,
        planTier: org.planTier,
        joinedAt: org.joinedAt instanceof Date ? org.joinedAt.toISOString() : org.joinedAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching organizations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}
