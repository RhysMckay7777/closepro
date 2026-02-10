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
      prospectName,
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

    if (!prospectName || (typeof prospectName === 'string' && !prospectName.trim())) {
      return NextResponse.json(
        { error: 'Missing required field: prospectName' },
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

    // Use selected date for figures month attribution (so January no-show shows in January)
    const callDate = date ? new Date(date) : new Date();
    if (isNaN(callDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date' },
        { status: 400 }
      );
    }

    const [noShowCall] = await db
      .insert(salesCalls)
      .values({
        organizationId,
        userId: session.user.id,
        fileName: `no-show-${date}`,
        fileUrl: '',
        status: 'completed',
        offerId,
        offerType: offerType as any,
        callType: 'no_show' as any,
        result: 'no_show' as any,
        prospectName: typeof prospectName === 'string' ? prospectName.trim().slice(0, 500) || null : null,
        wasConfirmed,
        bookingSource,
        metadata: notes ? JSON.stringify({ notes }) : null,
        completedAt: callDate,
        callDate,
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
