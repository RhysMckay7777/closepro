import { db } from '@/db';
import { salesCalls, callAnalysis } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { analyzeCall } from '@/lib/ai/analysis';

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

    const [callRow] = await db.select({ analysisIntent: salesCalls.analysisIntent }).from(salesCalls).where(eq(salesCalls.id, callId)).limit(1);
    const outcome = analysisResult.outcome;
    const hasOutcome = outcome && (
      outcome.result != null ||
      outcome.qualified !== undefined ||
      outcome.cashCollected != null ||
      outcome.revenueGenerated != null ||
      (outcome.reasonForOutcome != null && outcome.reasonForOutcome.trim() !== '')
    );
    if (callRow?.analysisIntent === 'update_figures' && hasOutcome) {
      const updatePayload: Record<string, unknown> = {
        status: 'completed',
        completedAt: new Date(),
      };
      if (outcome!.result) updatePayload.result = outcome!.result;
      if (outcome!.qualified !== undefined) updatePayload.qualified = outcome!.qualified;
      if (outcome!.cashCollected !== undefined) updatePayload.cashCollected = outcome!.cashCollected;
      if (outcome!.revenueGenerated !== undefined) updatePayload.revenueGenerated = outcome!.revenueGenerated;
      if (outcome!.reasonForOutcome?.trim()) updatePayload.reasonForOutcome = outcome!.reasonForOutcome.trim();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
await db.update(salesCalls).set(updatePayload as any).where(eq(salesCalls.id, callId));
    } else {
      await db
        .update(salesCalls)
        .set({
          status: 'completed',
          completedAt: new Date(),
        })
        .where(eq(salesCalls.id, callId));
    }
  } catch (error: unknown) {
    console.error('Background analysis error:', error);
    await db
      .update(salesCalls)
      .set({ status: 'failed' })
      .where(eq(salesCalls.id, callId));
  }
}
