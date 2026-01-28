import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { salesCalls, users, organizations, userOrganizations } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * POST - Log a follow-up call
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
      originalCallId,
      followUpDate,
      outcome,
      cashCollected,
      revenueGenerated,
      depositTaken,
    } = body;

    if (!originalCallId || !outcome) {
      return NextResponse.json(
        { error: 'Missing required fields: originalCallId, outcome' },
        { status: 400 }
      );
    }

    // Get the original call to inherit offer info
    const originalCall = await db
      .select()
      .from(salesCalls)
      .where(eq(salesCalls.id, originalCallId))
      .limit(1);

    if (!originalCall[0]) {
      return NextResponse.json(
        { error: 'Original call not found' },
        { status: 404 }
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

    // Map outcome to result
    const resultMap: Record<string, string> = {
      sale_made: 'closed',
      lost: 'lost',
      did_not_attend: 'no_show',
    };

    const result = resultMap[outcome] || 'follow_up';

    // Create follow-up record
    // Note: Follow-ups do NOT increase total call count, but can increase sales + close rate
    const [followUpCall] = await db
      .insert(salesCalls)
      .values({
        organizationId,
        userId: session.user.id,
        fileName: `follow-up-${followUpDate}`,
        fileUrl: '', // No file for manual follow-ups
        status: 'completed',
        offerId: originalCall[0].offerId,
        offerType: originalCall[0].offerType,
        callType: 'follow_up' as any,
        result: result as any,
        originalCallId,
        cashCollected: cashCollected || null,
        revenueGenerated: revenueGenerated || null,
        depositTaken: depositTaken || false,
        completedAt: new Date(followUpDate),
      })
      .returning();

    return NextResponse.json({
      call: followUpCall,
      message: 'Follow-up logged successfully',
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error logging follow-up:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to log follow-up' },
      { status: 500 }
    );
  }
}
