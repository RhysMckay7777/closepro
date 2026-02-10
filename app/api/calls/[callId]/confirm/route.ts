import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { salesCalls, callAnalysis, paymentPlanInstalments, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { analyzeCallAsync } from '@/lib/calls/analyze-call';

export const maxDuration = 120;

const VALID_RESULTS = ['no_show', 'closed', 'lost', 'unqualified', 'deposit', 'follow_up'] as const;

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
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch the call and verify ownership
    const rows = await db
      .select()
      .from(salesCalls)
      .where(and(eq(salesCalls.id, callId), eq(salesCalls.userId, session.user.id)))
      .limit(1);

    if (!rows[0]) {
      return NextResponse.json({ error: 'Call not found' }, { status: 404 });
    }

    const call = rows[0];

    const isFirstConfirmation = call.status === 'pending_confirmation';
    const isEditUpdate = ['completed', 'failed', 'manual'].includes(call.status ?? '');

    if (!isFirstConfirmation && !isEditUpdate) {
      return NextResponse.json(
        { error: 'Call is not in a confirmable state' },
        { status: 400 }
      );
    }

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
    const updatePayload: Record<string, unknown> = {
      offerId: offerId.trim(),
      prospectName: prospectName.trim().slice(0, 500),
      result,
      qualified: result !== 'unqualified',
      callType: callType || 'closing_call',
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

    // Save confirmed details
    await db
      .update(salesCalls)
      .set(updatePayload as any)
      .where(eq(salesCalls.id, callId));

    // Create payment plan instalments if applicable (first confirmation only — avoid duplicates)
    if (isFirstConfirmation && result === 'closed' && paymentType === 'payment_plan' && numberOfInstalments && monthlyAmount) {
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

          instalmentValues.push({
            salesCallId: callId,
            dueDate,
            amountCents: monthlyAmountCents,
            commissionRatePct: effectiveCommissionPct,
            commissionAmountCents: commissionAmount,
          });
        }

        await db.insert(paymentPlanInstalments).values(instalmentValues);
      }
    }

    // For edit updates, just return — no re-scoring needed
    if (isEditUpdate) {
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

    // Run full AI analysis (inline, awaited)
    try {
      await analyzeCallAsync(callId, transcript, transcriptJson);
    } catch (analysisErr: unknown) {
      console.error('Analysis failed after confirmation:', analysisErr);
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
    console.error('Error confirming call:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to confirm call' },
      { status: 500 }
    );
  }
}
