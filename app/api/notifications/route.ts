import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';

/**
 * Get all notifications for the current user
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

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread') === 'true';

    const userNotifications = await db
      .select()
      .from(notifications)
      .where(
        unreadOnly
          ? and(
            eq(notifications.userId, session.user.id),
            eq(notifications.read, false)
          )
          : eq(notifications.userId, session.user.id)
      )
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    const unreadCountResult = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, session.user.id),
          eq(notifications.read, false)
        )
      );

    return NextResponse.json({
      notifications: userNotifications.map(n => ({
        ...n,
        metadata: n.metadata ? JSON.parse(n.metadata) : null,
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.updatedAt.toISOString(),
      })),
      unreadCount: unreadCountResult.length,
    });
  } catch (error) {
    logger.error('AUTH', 'Failed to fetch notifications', error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

/**
 * Mark notification as read
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
    const { notificationId, read } = body;

    if (!notificationId) {
      return NextResponse.json(
        { error: 'Notification ID is required' },
        { status: 400 }
      );
    }

    // Verify notification belongs to user
    const notification = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, session.user.id)
        )
      )
      .limit(1);

    if (!notification[0]) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    // Update notification
    await db
      .update(notifications)
      .set({
        read: read !== undefined ? read : true,
        updatedAt: new Date(),
      })
      .where(eq(notifications.id, notificationId));

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('AUTH', 'Failed to update notification', error as Error);
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    );
  }
}

