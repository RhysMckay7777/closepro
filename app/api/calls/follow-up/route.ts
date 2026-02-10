import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { salesCalls, paymentPlanInstalments, users, userOrganizations } from '@/db/schema';
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
      followUpDate,
      offerId,
      offerType,
      prospectName,
      outcome,
      reasonForOutcome,
      objections,
      cashCollected,
      revenueGenerated,
      commissionRatePct,
      // Payment plan fields
      paymentType, // 'paid_in_full' | 'payment_plan'
      numberOfInstalments,
      monthlyAmount,
    } = body;

    if (!offerId || !outcome) {
      return NextResponse.json(
        { error: 'Missing required fields: offerId, outcome' },
        { status: 400 }
      );
    }

    if (!prospectName || (typeof prospectName === 'string' && !prospectName.trim())) {
      return NextResponse.json(
        { error: 'Missing required field: prospectName' },
        { status: 400 }
      );
    }

    const validOutcomes = ['closed', 'lost', 'no_show', 'further_follow_up'] as const;
    if (!validOutcomes.includes(outcome)) {
      return NextResponse.json(
        { error: `Invalid outcome. Must be one of: ${validOutcomes.join(', ')}` },
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

    // Map outcome to result enum
    const resultMap: Record<string, string> = {
      closed: 'closed',
      lost: 'lost',
      no_show: 'no_show',
      further_follow_up: 'follow_up',
    };
    const result = resultMap[outcome] || 'follow_up';

    const callDate = followUpDate ? new Date(followUpDate) : new Date();
    if (isNaN(callDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid follow-up date' },
        { status: 400 }
      );
    }

    // Determine effective commission rate
    const userCommissionPct = (user[0] as any).commissionRatePct ?? null;
    const effectiveCommissionPct = typeof commissionRatePct === 'number' && commissionRatePct >= 0 && commissionRatePct <= 100
      ? Math.round(commissionRatePct)
      : userCommissionPct;

    // Build notes from reasonForOutcome + objections
    const combinedReason = [reasonForOutcome, objections].filter(Boolean).join('\n\nObjections: ') || null;

    // Create follow-up record
    const [followUpCall] = await db
      .insert(salesCalls)
      .values({
        organizationId,
        userId: session.user.id,
        fileName: `follow-up-${followUpDate}`,
        fileUrl: '',
        status: 'completed',
        offerId,
        offerType: offerType as any,
        callType: 'follow_up' as any,
        result: result as any,
        prospectName: typeof prospectName === 'string' ? prospectName.trim().slice(0, 500) : null,
        reasonForOutcome: combinedReason,
        callDate,
        analysisIntent: 'update_figures',
        cashCollected: cashCollected != null ? Number(cashCollected) : null,
        revenueGenerated: revenueGenerated != null ? Number(revenueGenerated) : null,
        commissionRatePct: effectiveCommissionPct,
        completedAt: callDate,
      })
      .returning();

    console.log('[Follow-Up] Created follow-up call:', {
      callId: followUpCall.id,
      result,
      cashCollected,
      revenueGenerated,
      commissionRatePct: effectiveCommissionPct,
      paymentType,
    });

    // Create payment plan instalments if applicable (same logic as manual call log)
    if (result === 'closed' && paymentType === 'payment_plan' && numberOfInstalments && monthlyAmount) {
      const numInstalments = Number(numberOfInstalments);
      const monthlyAmountCents = Math.round(Number(monthlyAmount) * 100);

      if (numInstalments > 0 && monthlyAmountCents > 0) {
        const instalmentValues = [];

        for (let i = 0; i < numInstalments; i++) {
          const dueDate = new Date(callDate);
          dueDate.setMonth(dueDate.getMonth() + i);

          const commissionAmount = effectiveCommissionPct
            ? Math.round(monthlyAmountCents * (effectiveCommissionPct / 100))
            : null;

          instalmentValues.push({
            salesCallId: followUpCall.id,
            dueDate,
            amountCents: monthlyAmountCents,
            commissionRatePct: effectiveCommissionPct,
            commissionAmountCents: commissionAmount,
          });
        }

        await db.insert(paymentPlanInstalments).values(instalmentValues);

        console.log('[Follow-Up] Created payment plan instalments:', {
          callId: followUpCall.id,
          count: numInstalments,
          monthlyAmountCents,
          commissionRatePct: effectiveCommissionPct,
        });
      }
    }

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
