import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { salesCalls, callAnalysis, paymentPlanInstalments, users, offers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { analyzeCallAsync } from '@/lib/calls/analyze-call';
import type { ConfirmFormContext } from '@/lib/ai/analysis';

export const maxDuration = 120;

const VALID_RESULTS = ['no_show', 'closed', 'lost', 'unqualified', 'deposit', 'follow_up', 'payment_plan', 'follow_up_result'] as const;

/**
 * POST - Confirm call details and trigger AI analysis.
 * Called from the "Confirm Call Details" page after the user reviews/edits pre-filled data.
 * Body: { offerId, prospectName, result, callDate?, cashCollected?, revenueGenerated?,
 *         commissionRatePct?, reasonForOutcome?, callType?, paymentType?, numberOfInstalments?, monthlyAmount? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const { callId } = await params;
    console.log('[confirm-route] POST request for callId:', callId);
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      console.log('[confirm-route] Unauthorized — no session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('[confirm-route] Authenticated user:', session.user.id);

    // Fetch the call and verify ownership
    const rows = await db
      .select()
      .from(salesCalls)
      .where(and(eq(salesCalls.id, callId), eq(salesCalls.userId, session.user.id)))
      .limit(1);

    if (!rows[0]) {
      console.log('[confirm-route] Call not found:', callId);
      return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    }

    const call = rows[0];
    console.log('[confirm-route] Found call, status:', call.status);

    const isFirstConfirmation = call.status === 'pending_confirmation';
    const isEditUpdate = ['completed', 'failed', 'manual'].includes(call.status ?? '');

    if (!isFirstConfirmation && !isEditUpdate) {
      console.log('[confirm-route] Call not in confirmable state:', call.status);
      return NextResponse.json(
        { error: 'Call is not in a confirmable state' },
        { status: 400 }
      );
    }
    console.log('[confirm-route] Mode:', isFirstConfirmation ? 'first_confirmation' : 'edit_update');

    // Parse body
    const body = await request.json();
    const {
      offerId,
      prospectName,
      result,
      callDate: callDateRaw,
      cashCollected,
      revenueGenerated,
      commissionRatePct,
      reasonForOutcome,
      callType,
      paymentType,
      numberOfInstalments,
      monthlyAmount,
      addToSalesFigures,
    } = body;

    // Validate required fields
    if (!offerId || typeof offerId !== 'string' || !offerId.trim()) {
      return NextResponse.json({ error: 'Offer is required' }, { status: 400 });
    }
    if (!prospectName || typeof prospectName !== 'string' || !prospectName.trim()) {
      return NextResponse.json({ error: 'Prospect name is required' }, { status: 400 });
    }
    if (!result || !VALID_RESULTS.includes(result as typeof VALID_RESULTS[number])) {
      return NextResponse.json({ error: 'Valid result is required' }, { status: 400 });
    }

    // Build update payload
    const effectiveCallType = callType || 'closing_call';
    const updatePayload: Record<string, unknown> = {
      offerId: offerId.trim(),
      prospectName: prospectName.trim().slice(0, 500),
      result,
      qualified: result !== 'unqualified',
      callType: effectiveCallType,
    };

    // Only set status to 'analyzing' for first confirmation
    if (isFirstConfirmation) {
      updatePayload.status = 'analyzing';
      updatePayload.analysisIntent = 'analysis_only';
    }

    if (callDateRaw) {
      const d = new Date(callDateRaw);
      if (!isNaN(d.getTime())) updatePayload.callDate = d;
    }

    // addToSalesFigures: force false for roleplay, otherwise use provided value
    if (effectiveCallType === 'roleplay') {
      updatePayload.addToSalesFigures = false;
    } else if (typeof addToSalesFigures === 'boolean') {
      updatePayload.addToSalesFigures = addToSalesFigures;
    }

    // Result-specific field handling
    if (result === 'closed') {
      // Closed: save all financial fields, clear reason
      if (typeof cashCollected === 'number' && cashCollected >= 0) {
        updatePayload.cashCollected = Math.round(cashCollected);
      }
      if (typeof revenueGenerated === 'number' && revenueGenerated >= 0) {
        updatePayload.revenueGenerated = Math.round(revenueGenerated);
      }
      if (typeof commissionRatePct === 'number' && commissionRatePct >= 0 && commissionRatePct <= 100) {
        updatePayload.commissionRatePct = Math.round(commissionRatePct);
      }
      updatePayload.reasonForOutcome = null;
    } else if (result === 'deposit') {
      // Deposit: save financial fields + reason, clear payment plan fields
      if (typeof cashCollected === 'number' && cashCollected >= 0) {
        updatePayload.cashCollected = Math.round(cashCollected);
      }
      if (typeof revenueGenerated === 'number' && revenueGenerated >= 0) {
        updatePayload.revenueGenerated = Math.round(revenueGenerated);
      }
      if (typeof commissionRatePct === 'number' && commissionRatePct >= 0 && commissionRatePct <= 100) {
        updatePayload.commissionRatePct = Math.round(commissionRatePct);
      }
      if (typeof reasonForOutcome === 'string' && reasonForOutcome.trim()) {
        updatePayload.reasonForOutcome = reasonForOutcome.trim().slice(0, 2000);
      }
    } else if (result === 'lost' || result === 'follow_up_result' || result === 'unqualified') {
      // Lost/Follow-up/Unqualified: clear financial fields, save reason only
      updatePayload.cashCollected = null;
      updatePayload.revenueGenerated = null;
      updatePayload.commissionRatePct = null;
      if (typeof reasonForOutcome === 'string' && reasonForOutcome.trim()) {
        updatePayload.reasonForOutcome = reasonForOutcome.trim().slice(0, 2000);
      }
    } else {
      // Other results (no_show, payment_plan legacy, follow_up legacy): save what's provided
      if (typeof cashCollected === 'number' && cashCollected >= 0) {
        updatePayload.cashCollected = Math.round(cashCollected);
      }
      if (typeof revenueGenerated === 'number' && revenueGenerated >= 0) {
        updatePayload.revenueGenerated = Math.round(revenueGenerated);
      }
      if (typeof commissionRatePct === 'number' && commissionRatePct >= 0 && commissionRatePct <= 100) {
        updatePayload.commissionRatePct = Math.round(commissionRatePct);
      }
      if (typeof reasonForOutcome === 'string' && reasonForOutcome.trim()) {
        updatePayload.reasonForOutcome = reasonForOutcome.trim().slice(0, 2000);
      }
    }

    // Save confirmed details
    console.log('[confirm-route] Saving confirmed details:', { offerId: updatePayload.offerId, result: updatePayload.result, callType: updatePayload.callType });
    await db
      .update(salesCalls)
      .set(updatePayload as any)
      .where(eq(salesCalls.id, callId));
    console.log('[confirm-route] Details saved to DB');

    // Always delete existing instalments first (handles edits changing plan details or switching away)
    await db.delete(paymentPlanInstalments)
      .where(eq(paymentPlanInstalments.salesCallId, callId));

    // Create payment plan instalments if applicable (both new confirmations and edits)
    if (((result === 'closed' && paymentType === 'payment_plan') || result === 'payment_plan') && numberOfInstalments && monthlyAmount) {
      const numInstalments = Number(numberOfInstalments);
      const monthlyAmountCents = Math.round(Number(monthlyAmount) * 100);

      if (numInstalments > 0 && monthlyAmountCents > 0) {
        // Get effective commission rate: per-call override → user default
        let effectiveCommissionPct: number | null = null;
        if (typeof commissionRatePct === 'number' && commissionRatePct >= 0) {
          effectiveCommissionPct = Math.round(commissionRatePct);
        } else {
          try {
            const u = await db.select({ commissionRatePct: users.commissionRatePct })
              .from(users).where(eq(users.id, session.user.id)).limit(1);
            effectiveCommissionPct = u[0]?.commissionRatePct ?? null;
          } catch { /* column may not exist */ }
        }

        const instalmentValues = [];
        const callDate = callDateRaw ? new Date(callDateRaw) : new Date();

        for (let i = 0; i < numInstalments; i++) {
          const dueDate = new Date(callDate);
          dueDate.setMonth(dueDate.getMonth() + i);

          const commissionAmount = effectiveCommissionPct
            ? Math.round(monthlyAmountCents * (effectiveCommissionPct / 100))
            : null;

          // First instalment is auto-collected (paid on the call), rest are pending
          const isFirst = i === 0;

          instalmentValues.push({
            salesCallId: callId,
            instalmentNumber: i + 1,
            dueDate,
            amountCents: monthlyAmountCents,
            status: isFirst ? 'collected' : 'pending',
            collectedDate: isFirst ? callDate : null,
            commissionRatePct: effectiveCommissionPct,
            commissionAmountCents: commissionAmount,
          });
        }

        await db.insert(paymentPlanInstalments).values(instalmentValues);
      }
    }

    // For edit updates, just return — no re-scoring needed
    if (isEditUpdate) {
      console.log('[confirm-route] ✅ Edit update complete, no re-scoring');
      return NextResponse.json({
        callId,
        status: call.status,
        message: 'Call details updated.',
      });
    }

    // Build transcript data for analysis (first confirmation only)
    const transcript = call.transcript;
    if (!transcript) {
      return NextResponse.json(
        { error: 'No transcript available for analysis' },
        { status: 400 }
      );
    }

    let transcriptJson = { utterances: [] as Array<{ speaker: string; start: number; end: number; text: string }> };
    if (call.transcriptJson) {
      try {
        const parsed = typeof call.transcriptJson === 'string'
          ? JSON.parse(call.transcriptJson)
          : call.transcriptJson;
        if (parsed?.utterances) transcriptJson = parsed;
      } catch {
        // Fall through with empty utterances
      }
    }

    // Build confirm form context for AI prompt
    let offerName: string | undefined;
    try {
      const offerRows = await db.select({ name: offers.name }).from(offers).where(eq(offers.id, offerId.trim())).limit(1);
      offerName = offerRows[0]?.name ?? undefined;
    } catch { /* offer name is optional context */ }

    const confirmFormContext: ConfirmFormContext = {
      callDate: callDateRaw ? new Date(callDateRaw).toISOString() : undefined,
      offerName,
      prospectName: prospectName?.trim(),
      callType: effectiveCallType,
      result,
      cashCollected: typeof cashCollected === 'number' ? Math.round(cashCollected) : undefined,
      revenueGenerated: typeof revenueGenerated === 'number' ? Math.round(revenueGenerated) : undefined,
      reasonForOutcome: typeof reasonForOutcome === 'string' ? reasonForOutcome.trim() : undefined,
    };

    // Run full AI analysis (inline, awaited)
    console.log('[confirm-route] Starting AI analysis for callId:', callId, '(transcript length:', transcript.length, 'chars)');
    const analysisStartTime = Date.now();
    try {
      await analyzeCallAsync(callId, transcript, transcriptJson, confirmFormContext);
      console.log('[confirm-route] ✅ AI analysis complete in', ((Date.now() - analysisStartTime) / 1000).toFixed(1), 'seconds');
    } catch (analysisErr: unknown) {
      console.error('[confirm-route] ❌ Analysis FAILED after', ((Date.now() - analysisStartTime) / 1000).toFixed(1), 'seconds:', analysisErr);
      return NextResponse.json({
        callId,
        status: 'failed',
        message: 'Call confirmed but analysis failed. You can retry from the call detail page.',
      }, { status: 201 });
    }

    return NextResponse.json({
      callId,
      status: 'completed',
      message: 'Call confirmed and analysis complete.',
    });
  } catch (error: unknown) {
    console.error('[confirm-route] ❌ Unexpected error confirming call:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to confirm call' },
      { status: 500 }
    );
  }
}
