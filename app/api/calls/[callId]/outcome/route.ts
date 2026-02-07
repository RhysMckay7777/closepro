import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { salesCalls } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

const VALID_RESULTS = ['no_show', 'closed', 'lost', 'unqualified', 'deposit', 'follow_up'] as const;

/**
 * PATCH - Update call outcome for sales figures (result, qualified, cashCollected, revenueGenerated, reasonForOutcome).
 * Body: { result?, qualified?, cashCollected?, revenueGenerated?, reasonForOutcome? }
 * cashCollected and revenueGenerated are in cents.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const { callId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const {
      result: resultRaw,
      qualified,
      cashCollected,
      revenueGenerated,
      reasonForOutcome,
      callDate: callDateRaw,
      offerId,
      prospectName,
      callType,
      commissionRatePct,
    } = body;

    const updatePayload: Record<string, unknown> = {};
    if (typeof resultRaw === 'string' && VALID_RESULTS.includes(resultRaw as typeof VALID_RESULTS[number])) {
      updatePayload.result = resultRaw;
      // Qualified if result ≠ Unqualified; only "Unqualified" marks the call as not qualified
      updatePayload.qualified = resultRaw !== 'unqualified';
    } else if (typeof qualified === 'boolean') {
      updatePayload.qualified = qualified;
    }
    if (typeof cashCollected === 'number' && cashCollected >= 0) {
      updatePayload.cashCollected = Math.round(cashCollected);
    }
    if (typeof revenueGenerated === 'number' && revenueGenerated >= 0) {
      updatePayload.revenueGenerated = Math.round(revenueGenerated);
    }
    if (typeof reasonForOutcome === 'string') {
      updatePayload.reasonForOutcome = reasonForOutcome.trim().slice(0, 2000) || null;
    }
    if (callDateRaw !== undefined) {
      const d = new Date(callDateRaw);
      updatePayload.callDate = isNaN(d.getTime()) ? null : d;
    }
    if (typeof offerId === 'string') {
      updatePayload.offerId = offerId.trim() || null;
    }
    if (typeof prospectName === 'string') {
      updatePayload.prospectName = prospectName.trim().slice(0, 500) || null;
    }
    if (typeof callType === 'string' && ['closing_call', 'follow_up'].includes(callType)) {
      updatePayload.callType = callType;
    }
    if (typeof commissionRatePct === 'number' && commissionRatePct >= 0 && commissionRatePct <= 100) {
      updatePayload.commissionRatePct = Math.round(commissionRatePct);
    } else if (commissionRatePct === null) {
      updatePayload.commissionRatePct = null;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: 'Provide at least one of: result, qualified, cashCollected, revenueGenerated, reasonForOutcome, callDate, offerId, prospectName, callType, commissionRatePct' },
        { status: 400 }
      );
    }

    let updated: { id: string } | undefined;
    try {
      [updated] = await db
        .update(salesCalls)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .set(updatePayload as any)
        .where(
          and(
            eq(salesCalls.id, callId),
            eq(salesCalls.userId, session.user.id)
          )
        )
        .returning({ id: salesCalls.id });
    } catch (dbErr: unknown) {
      const e = dbErr as { code?: string; message?: string };
      const isMissingColumn = e?.code === '42703' || (typeof e?.message === 'string' && e.message.includes('does not exist') && e.message.includes('column'));
      if (isMissingColumn) {
        return NextResponse.json(
          { error: 'Database schema is out of date. Run: npm run db:migrate to save outcome and figures.' },
          { status: 400 }
        );
      }
      throw dbErr;
    }

    if (!updated) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error('Error updating call outcome:', error);
    return NextResponse.json(
      { error: 'Failed to update outcome' },
      { status: 500 }
    );
  }
}
