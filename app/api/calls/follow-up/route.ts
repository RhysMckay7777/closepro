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
      reasonForOutcome,
      cashCollected,
      revenueGenerated,
      depositTaken,
      commissionRatePct,
    } = body;

    if (!originalCallId || !outcome || !reasonForOutcome) {
      return NextResponse.json(
        { error: 'Missing required fields: originalCallId, outcome, reasonForOutcome' },
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

    // Create follow-up record; callDate and analysisIntent so it feeds figures in the correct month
    const [followUpCall] = await db
      .insert(salesCalls)
      .values({
        organizationId,
        userId: session.user.id,
        fileName: `follow-up-${followUpDate}`,
        fileUrl: '',
        status: 'completed',
        offerId: originalCall[0].offerId,
        offerType: originalCall[0].offerType,
        callType: 'follow_up' as any,
        result: result as any,
        originalCallId,
        reasonForOutcome: reasonForOutcome || null,
        callDate: new Date(followUpDate),
        analysisIntent: 'update_figures',
        cashCollected: cashCollected || null,
        revenueGenerated: revenueGenerated || null,
        depositTaken: depositTaken || false,
        commissionRatePct: typeof commissionRatePct === 'number' && commissionRatePct >= 0 && commissionRatePct <= 100 ? Math.round(commissionRatePct) : null,
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
