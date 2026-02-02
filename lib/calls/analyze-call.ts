import { db } from '@/db';
import { salesCalls, callAnalysis } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { analyzeCall } from '@/lib/ai/analysis';

function isMissingColumnError(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string }; message?: string };
  const code = e?.code ?? e?.cause?.code;
  const msg = typeof e?.message === 'string' ? e.message : '';
  return code === '42703' || (msg.includes('does not exist') && msg.includes('column'));
}

async function setCallStatusCompleted(callId: string): Promise<void> {
  try {
    await db.update(salesCalls).set({ status: 'completed', completedAt: new Date() }).where(eq(salesCalls.id, callId));
  } catch (err) {
    if (isMissingColumnError(err)) {
      await db.execute(sql`UPDATE sales_calls SET status = 'completed', completed_at = now() WHERE id = ${callId}`);
    } else {
      throw err;
    }
  }
}

async function setCallStatusFailed(callId: string, failureReason?: string): Promise<void> {
  try {
    await db.update(salesCalls).set({ status: 'failed' }).where(eq(salesCalls.id, callId));
  } catch (err) {
    if (isMissingColumnError(err)) {
      await db.execute(sql`UPDATE sales_calls SET status = 'failed' WHERE id = ${callId}`);
    } else {
      throw err;
    }
  }
  if (failureReason) {
    try {
      const [row] = await db.select({ metadata: salesCalls.metadata }).from(salesCalls).where(eq(salesCalls.id, callId)).limit(1);
      const meta = row?.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : {};
      await db.update(salesCalls).set({ metadata: JSON.stringify({ ...meta, failureReason }) }).where(eq(salesCalls.id, callId));
    } catch {
      // non-fatal: status already set to failed
    }
  }
}

/**
 * Analyze call in background (non-blocking).
 * Used by both upload and transcript routes.
 */
export async function analyzeCallAsync(
  callId: string,
  transcript: string,
  transcriptJson: { utterances: Array<{ speaker: string; start: number; end: number; text: string }> }
): Promise<void> {
  try {
    const analysisResult = await analyzeCall(transcript, transcriptJson);

    // Enhance coaching recommendations with execution resistance context if applicable
    let enhancedRecommendations = [...(analysisResult.coachingRecommendations || [])];
    if (analysisResult.prospectDifficulty?.executionResistance !== undefined) {
      const execResistance = analysisResult.prospectDifficulty.executionResistance;
      if (execResistance <= 4) {
        enhancedRecommendations.push({
          priority: 'medium' as const,
          category: 'Prospect Difficulty',
          issue: `Prospect had extreme execution resistance (${execResistance}/10) - severe money/time/authority constraints`,
          explanation: 'This call was difficult due to structural blockers, not just sales skill. Execution resistance increases difficulty but does not excuse poor performance - both should be addressed.',
          action: 'Flag this as a lead quality issue. Consider qualifying for execution ability earlier in the funnel.',
        });
      } else if (execResistance <= 7) {
        enhancedRecommendations.push({
          priority: 'low' as const,
          category: 'Prospect Difficulty',
          issue: `Prospect had partial execution ability (${execResistance}/10)`,
          explanation: 'Prospect may need payment plans, time restructuring, or prioritization reframing.',
          action: 'Consider offering flexible payment options or helping prospect reprioritize.',
        });
      }
    }

    await db
      .insert(callAnalysis)
      .values({
        callId,
        overallScore: analysisResult.overallScore,
        valueScore: analysisResult.value.score,
        trustScore: analysisResult.trust.score,
        fitScore: analysisResult.fit.score,
        logisticsScore: analysisResult.logistics.score,
        valueDetails: JSON.stringify(analysisResult.value),
        trustDetails: JSON.stringify(analysisResult.trust),
        fitDetails: JSON.stringify(analysisResult.fit),
        logisticsDetails: JSON.stringify(analysisResult.logistics),
        skillScores: JSON.stringify(analysisResult.skillScores),
        coachingRecommendations: JSON.stringify(enhancedRecommendations),
        timestampedFeedback: JSON.stringify(analysisResult.timestampedFeedback),
      });

    let callRow: { analysisIntent: string | null } | null = null;
    try {
      const rows = await db.select({ analysisIntent: salesCalls.analysisIntent }).from(salesCalls).where(eq(salesCalls.id, callId)).limit(1);
      callRow = rows[0] ?? null;
    } catch (err) {
      if (!isMissingColumnError(err)) throw err;
      // DB has no analysis_intent column – skip outcome update
    }

    const outcome = analysisResult.outcome;
    if (outcome) {
      console.log('Analysis outcome for figures:', {
        callId,
        result: outcome.result,
        qualified: outcome.qualified,
        cashCollected: outcome.cashCollected,
        revenueGenerated: outcome.revenueGenerated,
        reasonForOutcome: outcome.reasonForOutcome?.slice(0, 80),
      });
    }
    const hasOutcome = outcome && (
      outcome.result != null ||
      outcome.qualified !== undefined ||
      outcome.cashCollected != null ||
      outcome.revenueGenerated != null ||
      (outcome.reasonForOutcome != null && outcome.reasonForOutcome.trim() !== '')
    );
    // Apply AI outcome to call when user asked for figures (update_figures) or intent is null (e.g. raw-insert fallback)
    const shouldApplyOutcome =
      hasOutcome &&
      (callRow?.analysisIntent === 'update_figures' || callRow?.analysisIntent === null);
    if (shouldApplyOutcome) {
      try {
        const updatePayload: Record<string, unknown> = {
          status: 'completed',
          completedAt: new Date(),
        };
        if (outcome!.result) updatePayload.result = outcome!.result;
        if (outcome!.qualified !== undefined) updatePayload.qualified = outcome!.qualified;
        if (outcome!.cashCollected !== undefined) updatePayload.cashCollected = outcome!.cashCollected;
        if (outcome!.revenueGenerated !== undefined) updatePayload.revenueGenerated = outcome!.revenueGenerated;
        if (outcome!.reasonForOutcome?.trim()) updatePayload.reasonForOutcome = outcome!.reasonForOutcome.trim();
        await db.update(salesCalls).set(updatePayload as Parameters<typeof db.update>[1]).where(eq(salesCalls.id, callId));
      } catch (err) {
        if (isMissingColumnError(err)) await setCallStatusCompleted(callId);
        else throw err;
      }
    } else {
      await setCallStatusCompleted(callId);
    }
  } catch (error: unknown) {
    console.error('Background analysis error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    const friendlyMessage =
      /credit|balance|too low|upgrade|purchase credits/i.test(msg)
        ? 'Your API credit balance is too low. Please upgrade or add credits to analyze calls.'
        : msg || 'Analysis failed.';
    await setCallStatusFailed(callId, friendlyMessage);
  }
}
