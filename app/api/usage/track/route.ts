import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { incrementUsage, canPerformAction } from '@/lib/subscription';

/**
 * Track usage for calls or roleplay sessions
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
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
    const { type } = body as { type: 'calls' | 'roleplay' };

    if (!type || !['calls', 'roleplay'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid usage type' },
        { status: 400 }
      );
    }

    // Get user's organization
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user[0] || !user[0].organizationId) {
      return NextResponse.json(
        { error: 'User organization not found' },
        { status: 404 }
      );
    }

    const organizationId = user[0].organizationId;

    // Check if action is allowed
    const actionType = type === 'calls' ? 'upload_call' : 'start_roleplay';
    const { allowed, reason } = await canPerformAction(organizationId, actionType);

    if (!allowed) {
      return NextResponse.json(
        { error: reason || 'Action not allowed' },
        { status: 403 }
      );
    }

    // Increment usage
    await incrementUsage(organizationId, type);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error tracking usage:', error);
    return NextResponse.json(
      { error: 'Failed to track usage' },
      { status: 500 }
    );
  }
}
