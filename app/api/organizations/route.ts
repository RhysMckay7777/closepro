import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { organizations, users, userOrganizations } from '@/db/schema';
import { auth } from '@/lib/auth';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    // Get session from better-auth
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: 'Organization name is required' },
        { status: 400 }
      );
    }

    // Create organization
    const [org] = await db
      .insert(organizations)
      .values({
        name,
        planTier: 'starter',
        maxSeats: 5,
      })
      .returning();

    // Update user with organization ID (primary org)
    await db
      .update(users)
      .set({ 
        organizationId: org.id,
        role: 'admin', // First user becomes admin
      })
      .where(eq(users.id, session.user.id));

    // Also add to user_organizations junction table
    await db.insert(userOrganizations).values({
      userId: session.user.id,
      organizationId: org.id,
      role: 'admin',
      isPrimary: true, // This is their primary organization
    });

    return NextResponse.json(org);
  } catch (error) {
    console.error('Organization creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create organization' },
      { status: 500 }
    );
  }
}
