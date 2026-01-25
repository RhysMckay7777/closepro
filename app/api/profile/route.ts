import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { users, organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Get current user's profile
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

    // Get user with organization
    const user = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        profilePhoto: users.profilePhoto,
        bio: users.bio,
        phone: users.phone,
        location: users.location,
        website: users.website,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        organizationId: users.organizationId,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user[0]) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get organization name if user has one
    let organizationName = null;
    if (user[0].organizationId) {
      const org = await db
        .select({ name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, user[0].organizationId))
        .limit(1);
      
      organizationName = org[0]?.name || null;
    }

    return NextResponse.json({
      ...user[0],
      createdAt: user[0].createdAt.toISOString(),
      organizationName,
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

/**
 * Update current user's profile
 */
export async function PATCH(request: NextRequest) {
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

    const body = await request.json();
    const { name, bio, phone, location, website } = body;

    // Validate name if provided
    if (name !== undefined && (!name || name.trim().length === 0)) {
      return NextResponse.json(
        { error: 'Name cannot be empty' },
        { status: 400 }
      );
    }

    // Update user profile
    const updated = await db
      .update(users)
      .set({
        name: name !== undefined ? name.trim() : undefined,
        bio: bio !== undefined ? bio.trim() || null : undefined,
        phone: phone !== undefined ? phone.trim() || null : undefined,
        location: location !== undefined ? location.trim() || null : undefined,
        website: website !== undefined ? website.trim() || null : undefined,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        profilePhoto: users.profilePhoto,
        bio: users.bio,
        phone: users.phone,
        location: users.location,
        website: users.website,
      });

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
