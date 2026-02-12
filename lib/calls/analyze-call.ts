import { db } from '@/db';
import { salesCalls, callAnalysis } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { analyzeCall, type ConfirmFormContext } from '@/lib/ai/analysis';

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
  transcriptJson: { utterances: Array<{ speaker: string; start: number; end: number; text: string }> },
  confirmFormContext?: ConfirmFormContext
): Promise<void> {
  console.log('[analyze-call] Starting analysis for callId:', callId, '(transcript:', transcript.length, 'chars,', transcriptJson.utterances.length, 'utterances)');
  const t0 = Date.now();
  try {
    console.log('[analyze-call] Calling AI analyzeCall()...');
    const analysisResult = await analyzeCall(transcript, transcriptJson, undefined, undefined, confirmFormContext);
    console.log('[analyze-call] AI analysis returned in', ((Date.now() - t0) / 1000).toFixed(1), 's — overallScore:', analysisResult.overallScore);

    // Enhance coaching recommendations with execution resistance context if applicable (v1 only)
    let enhancedRecommendations = [...(analysisResult.coachingRecommendations || [])];
    if (!analysisResult.phaseScores && analysisResult.prospectDifficulty?.executionResistance !== undefined) {
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

    // Use phaseScores.overall for overallScore if v2 and overallScore is missing
    const effectiveOverallScore = analysisResult.overallScore || analysisResult.phaseScores?.overall || 0;

    const insertValues: Record<string, unknown> = {
      callId,
      overallScore: effectiveOverallScore,
      valueScore: null,
      trustScore: null,
      fitScore: null,
      logisticsScore: null,
      skillScores: JSON.stringify(analysisResult.categoryScores),
      objectionDetails: JSON.stringify(analysisResult.objections ?? []),
      prospectDifficulty: analysisResult.prospectDifficulty?.totalDifficultyScore ?? null,
      prospectDifficultyTier: analysisResult.prospectDifficulty?.difficultyTier ?? null,
      coachingRecommendations: JSON.stringify(enhancedRecommendations),
      timestampedFeedback: JSON.stringify(analysisResult.timestampedFeedback),
      outcomeDiagnostic: analysisResult.outcomeDiagnostic ?? null,
      categoryFeedback: analysisResult.categoryFeedbackDetailed ? JSON.stringify(analysisResult.categoryFeedbackDetailed) : null,
      momentCoaching: analysisResult.momentCoaching ? JSON.stringify(analysisResult.momentCoaching) : null,
      priorityFixes: analysisResult.enhancedPriorityFixes ? JSON.stringify(analysisResult.enhancedPriorityFixes) : null,
      // v2 columns
      phaseScores: analysisResult.phaseScores ? JSON.stringify(analysisResult.phaseScores) : null,
      phaseAnalysis: analysisResult.phaseAnalysis ? JSON.stringify(analysisResult.phaseAnalysis) : null,
      outcomeDiagnosticP1: analysisResult.outcomeDiagnosticP1 ?? null,
      outcomeDiagnosticP2: analysisResult.outcomeDiagnosticP2 ?? null,
      closerEffectiveness: analysisResult.closerEffectiveness ?? null,
      prospectDifficultyJustifications: analysisResult.prospectDifficultyJustifications ? JSON.stringify(analysisResult.prospectDifficultyJustifications) : null,
      actionPoints: analysisResult.actionPoints ? JSON.stringify(analysisResult.actionPoints) : null,
    };

    console.log('[analyze-call] Inserting analysis row into DB...');
    try {
      await db.insert(callAnalysis).values(insertValues);
      console.log('[analyze-call] Analysis row inserted successfully');
    } catch (insertErr) {
      if (isMissingColumnError(insertErr)) {
        // Auto-migrate: add missing columns
        console.log('[analyze-call] Missing columns detected — running auto-migration…');
        // v1 columns
        await db.execute(sql`ALTER TABLE call_analysis ADD COLUMN IF NOT EXISTS outcome_diagnostic TEXT`);
        await db.execute(sql`ALTER TABLE call_analysis ADD COLUMN IF NOT EXISTS category_feedback TEXT`);
        await db.execute(sql`ALTER TABLE call_analysis ADD COLUMN IF NOT EXISTS moment_coaching TEXT`);
        await db.execute(sql`ALTER TABLE call_analysis ADD COLUMN IF NOT EXISTS priority_fixes TEXT`);
        // v2 columns
        await db.execute(sql`ALTER TABLE call_analysis ADD COLUMN IF NOT EXISTS phase_scores TEXT`);
        await db.execute(sql`ALTER TABLE call_analysis ADD COLUMN IF NOT EXISTS phase_analysis TEXT`);
        await db.execute(sql`ALTER TABLE call_analysis ADD COLUMN IF NOT EXISTS outcome_diagnostic_p1 TEXT`);
        await db.execute(sql`ALTER TABLE call_analysis ADD COLUMN IF NOT EXISTS outcome_diagnostic_p2 TEXT`);
        await db.execute(sql`ALTER TABLE call_analysis ADD COLUMN IF NOT EXISTS closer_effectiveness TEXT`);
        await db.execute(sql`ALTER TABLE call_analysis ADD COLUMN IF NOT EXISTS prospect_difficulty_justifications TEXT`);
        await db.execute(sql`ALTER TABLE call_analysis ADD COLUMN IF NOT EXISTS action_points TEXT`);
        console.log('[analyze-call] Auto-migration complete. Retrying insert…');
        await db.insert(callAnalysis).values(insertValues);
        console.log('[analyze-call] Analysis row inserted after migration');
      } else {
        throw insertErr;
      }
    }

    let callRow: { analysisIntent: string | null } | null = null;
    try {
      const rows = await db.select({ analysisIntent: salesCalls.analysisIntent }).from(salesCalls).where(eq(salesCalls.id, callId)).limit(1);
      callRow = rows[0] ?? null;
    } catch (err) {
      if (!isMissingColumnError(err)) throw err;
    }

    const outcome = analysisResult.outcome;
    if (outcome) {
      console.log('[analyze-call] Outcome detected:', {
        callId,
        result: outcome.result,
        qualified: outcome.qualified,
        cashCollected: outcome.cashCollected,
        revenueGenerated: outcome.revenueGenerated,
        reasonForOutcome: outcome.reasonForOutcome?.slice(0, 80),
      });
    } else {
      console.log('[analyze-call] No outcome in analysis result');
    }
    const hasOutcome = outcome && (
      outcome.result != null ||
      outcome.qualified !== undefined ||
      outcome.cashCollected != null ||
      outcome.revenueGenerated != null ||
      (outcome.reasonForOutcome != null && outcome.reasonForOutcome.trim() !== '')
    );
    const shouldApplyOutcome =
      hasOutcome &&
      (callRow?.analysisIntent === 'update_figures' || callRow?.analysisIntent === null);
    console.log('[analyze-call] Outcome decision:', { hasOutcome, analysisIntent: callRow?.analysisIntent, shouldApplyOutcome });
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
        await db.update(salesCalls).set(updatePayload as any).where(eq(salesCalls.id, callId));
        console.log('[analyze-call] ✅ Call updated with outcome + completed status');
      } catch (err) {
        if (isMissingColumnError(err)) {
          console.log('[analyze-call] Missing column during outcome update, falling back to setCallStatusCompleted');
          await setCallStatusCompleted(callId);
        } else throw err;
      }
    } else {
      console.log('[analyze-call] Setting call status to completed (no outcome applied)');
      await setCallStatusCompleted(callId);
    }
    console.log('[analyze-call] ✅ Analysis pipeline complete for callId:', callId, 'in', ((Date.now() - t0) / 1000).toFixed(1), 's');
  } catch (error: unknown) {
    console.error('[analyze-call] ❌ Analysis FAILED for callId:', callId, 'after', ((Date.now() - t0) / 1000).toFixed(1), 's —', error);
    const msg = error instanceof Error ? error.message : String(error);
    const friendlyMessage =
      /credit|balance|too low|upgrade|purchase credits/i.test(msg)
        ? 'Your API credit balance is too low. Please upgrade or add credits to analyze calls.'
        : msg || 'Analysis failed.';
    console.log('[analyze-call] Setting call status to failed with reason:', friendlyMessage.slice(0, 100));
    await setCallStatusFailed(callId, friendlyMessage);
  }
}
