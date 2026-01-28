import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { salesCalls, users, organizations, userOrganizations } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * POST - Log a no-show or cancellation
 */
export async function POST(request: NextRequest) {
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
    const {
      date,
      offerId,
      offerType,
      wasConfirmed,
      bookingSource,
      notes,
    } = body;

    if (!offerId) {
      return NextResponse.json(
        { error: 'Missing required field: offerId' },
        { status: 400 }
      );
    }

    // Get user's organization
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user[0]) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    let organizationId = user[0].organizationId;
    if (!organizationId) {
      const firstOrg = await db
        .select()
        .from(userOrganizations)
        .where(eq(userOrganizations.userId, session.user.id))
        .limit(1);
      
      if (!firstOrg[0]) {
        return NextResponse.json(
          { error: 'No organization found' },
          { status: 404 }
        );
      }
      organizationId = firstOrg[0].organizationId;
    }

    // Create a no-show record
    // Note: This should update booked calls, no-show rate, and funnel diagnostics
    // For now, we'll create a minimal record
    
    const [noShowCall] = await db
      .insert(salesCalls)
      .values({
        organizationId,
        userId: session.user.id,
        fileName: `no-show-${date}`,
        fileUrl: '', // No file for no-shows
        status: 'completed',
        offerId,
        offerType: offerType as any,
        callType: 'no_show' as any,
        result: 'no_show' as any,
        wasConfirmed,
        bookingSource,
        metadata: notes ? JSON.stringify({ notes }) : null,
        completedAt: new Date(date),
      })
      .returning();

    return NextResponse.json({
      call: noShowCall,
      message: 'No-show logged successfully',
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error logging no-show:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to log no-show' },
      { status: 500 }
    );
  }
}
