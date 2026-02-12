import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { salesCalls, users, roleplaySessions, offers, paymentPlanInstalments } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { analyzeCall } from '@/lib/ai/analysis';
import { callAnalysis } from '@/db/schema';

/** Safely parse a value that may be a JSON string or already-parsed object */
function safeParse<T>(val: unknown, fallback: T): T {
  if (val === null || val === undefined) return fallback;
  if (typeof val !== 'string') return val as T;
  try { return JSON.parse(val) as T; } catch { return fallback; }
}

/** Build analysis object from a DB row, parsing all JSON columns (v1 + v2) */
function buildAnalysisFromRow(row: Record<string, unknown>): Record<string, unknown> {
  const skillScoresRaw = safeParse(row.skillScores, null);
  const categoryScores = skillScoresRaw && typeof skillScoresRaw === 'object' && !Array.isArray(skillScoresRaw) ? skillScoresRaw : {};
  const objections = safeParse(row.objectionDetails, []);
  return {
    ...row,
    categoryScores,
    objections,
    skillScores: categoryScores,
    coachingRecommendations: safeParse(row.coachingRecommendations, []),
    timestampedFeedback: safeParse(row.timestampedFeedback, []),
    categoryFeedback: safeParse(row.categoryFeedback, null),
    momentCoaching: safeParse(row.momentCoaching, []),
    priorityFixes: safeParse(row.priorityFixes, []),
    // v2 columns
    phaseScores: safeParse(row.phaseScores, null),
    phaseAnalysis: safeParse(row.phaseAnalysis, null),
    prospectDifficultyJustifications: safeParse(row.prospectDifficultyJustifications, null),
    actionPoints: safeParse(row.actionPoints, []),
  };
}

/**
 * Check call status and analysis
 * With Deepgram, transcription is instant, so we only check analysis status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  try {
    const { callId } = await params;
    console.log('[status-route] GET callId:', callId);
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const baseSelect = {
      id: salesCalls.id,
      organizationId: salesCalls.organizationId,
      userId: salesCalls.userId,
      fileName: salesCalls.fileName,
      fileUrl: salesCalls.fileUrl,
      fileSize: salesCalls.fileSize,
      duration: salesCalls.duration,
      status: salesCalls.status,
      transcript: salesCalls.transcript,
      transcriptJson: salesCalls.transcriptJson,
      metadata: salesCalls.metadata,
      createdAt: salesCalls.createdAt,
      updatedAt: salesCalls.updatedAt,
      completedAt: salesCalls.completedAt,
      callDate: salesCalls.callDate,
      offerId: salesCalls.offerId,
      callType: salesCalls.callType,
      prospectName: salesCalls.prospectName,
      commissionRatePct: salesCalls.commissionRatePct,
      offerName: offers.name,
    };
    const whereClause = and(
      eq(salesCalls.id, callId),
      eq(salesCalls.userId, session.user.id)
    );

    let call: Array<Record<string, unknown>>;
    try {
      call = await db
        .select({
          ...baseSelect,
          result: salesCalls.result,
          qualified: salesCalls.qualified,
          cashCollected: salesCalls.cashCollected,
          revenueGenerated: salesCalls.revenueGenerated,
          reasonForOutcome: salesCalls.reasonForOutcome,
          reasonTag: salesCalls.reasonTag,
          addToSalesFigures: salesCalls.addToSalesFigures,
          extractedDetails: salesCalls.extractedDetails,
        })
        .from(salesCalls)
        .leftJoin(offers, eq(salesCalls.offerId, offers.id))
        .where(whereClause)
        .limit(1);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      const isMissingColumn = e?.code === '42703' || (typeof e?.message === 'string' && e.message.includes('does not exist') && e.message.includes('column'));
      if (!isMissingColumn) throw err;
      call = await db
        .select(baseSelect)
        .from(salesCalls)
        .leftJoin(offers, eq(salesCalls.offerId, offers.id))
        .where(whereClause)
        .limit(1);
      if (call[0]) {
        (call[0] as Record<string, unknown>).result = null;
        (call[0] as Record<string, unknown>).qualified = null;
        (call[0] as Record<string, unknown>).cashCollected = null;
        (call[0] as Record<string, unknown>).revenueGenerated = null;
        (call[0] as Record<string, unknown>).reasonForOutcome = null;
        (call[0] as Record<string, unknown>).reasonTag = null;
        (call[0] as Record<string, unknown>).callDate = null;
        (call[0] as Record<string, unknown>).offerId = null;
        (call[0] as Record<string, unknown>).callType = null;
        (call[0] as Record<string, unknown>).prospectName = null;
        (call[0] as Record<string, unknown>).commissionRatePct = null;
      }
    }

    if (!call[0]) {
      return NextResponse.json(
        { error: 'Call not found' },
        { status: 404 }
      );
    }

    // Fetch payment plan instalment data for this call
    let instalmentData: { count: number; monthlyAmountPounds: number } | null = null;
    try {
      const instalments = await db
        .select({
          amountCents: paymentPlanInstalments.amountCents,
        })
        .from(paymentPlanInstalments)
        .where(eq(paymentPlanInstalments.salesCallId, callId));
      if (instalments.length > 0) {
        instalmentData = {
          count: instalments.length,
          monthlyAmountPounds: instalments[0].amountCents / 100,
        };
      }
    } catch {
      // paymentPlanInstalments table may not exist yet
    }

    // Attach instalment info to call object
    if (instalmentData) {
      (call[0] as Record<string, unknown>).paymentType = 'payment_plan';
      (call[0] as Record<string, unknown>).numberOfInstalments = instalmentData.count;
      (call[0] as Record<string, unknown>).monthlyAmount = instalmentData.monthlyAmountPounds;
    }

    // If already completed, return current status
    // Also check if this is a roleplay session (callId might be a sessionId)
    if (call[0].status === 'completed') {
      const analysisRows = await db
        .select()
        .from(callAnalysis)
        .where(eq(callAnalysis.callId, callId))
        .limit(1);
      const row = analysisRows[0];
      const analysis: Record<string, unknown> | null = row ? buildAnalysisFromRow(row as unknown as Record<string, unknown>) : null;
      console.log('[status-route] Returning completed call:', callId, '— analysis:', analysis ? 'found (score: ' + analysis.overallScore + ')' : 'MISSING');
      return NextResponse.json({
        status: 'completed',
        call: call[0],
        analysis,
      });
    }

    // If not found in salesCalls, check if it's a roleplay session
    const roleplay = await db
      .select()
      .from(roleplaySessions)
      .where(eq(roleplaySessions.id, callId))
      .limit(1);

    if (roleplay[0] && roleplay[0].analysisId) {
      const analysisRows = await db
        .select()
        .from(callAnalysis)
        .where(eq(callAnalysis.id, roleplay[0].analysisId))
        .limit(1);
      const row = analysisRows[0];
      const analysis: Record<string, unknown> | null = row ? buildAnalysisFromRow(row as unknown as Record<string, unknown>) : null;
      return NextResponse.json({
        status: 'completed',
        call: null,
        analysis,
      });
    }

    // If analyzing, check if analysis is complete
    console.log('[status-route] Call status:', call[0].status);
    if (call[0].status === 'analyzing') {
      // Check if analysis exists
      const analysis = await db
        .select()
        .from(callAnalysis)
        .where(eq(callAnalysis.callId, callId))
        .limit(1);

      if (analysis[0]) {
        const analysisForClient = buildAnalysisFromRow(analysis[0] as unknown as Record<string, unknown>);
        return NextResponse.json({
          status: 'completed',
          call: {
            ...call[0],
            status: 'completed',
          },
          analysis: analysisForClient,
        });
      } else {
        // Still analyzing
        return NextResponse.json({
          status: 'analyzing',
          call: call[0],
          message: 'Analysis in progress...',
        });
      }
    }

    // If pending confirmation, return call data for the confirm page
    if (call[0].status === 'pending_confirmation') {
      return NextResponse.json({
        status: 'pending_confirmation',
        call: call[0],
      });
    }

    // If failed
    if (call[0].status === 'failed') {
      return NextResponse.json({
        status: 'failed',
        call: call[0],
        error: 'Call processing failed',
      });
    }

    // Return current status
    return NextResponse.json({
      status: call[0].status,
      call: call[0],
    });
  } catch (error: any) {
    console.error('[status-route] ❌ Error checking call status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check status' },
      { status: 500 }
    );
  }
}
