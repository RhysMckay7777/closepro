import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { salesCalls } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getTranscriptionStatus } from '@/lib/ai/transcription';
import { analyzeCall } from '@/lib/ai/analysis';
import { callAnalysis } from '@/db/schema';
import crypto from 'crypto';

/**
 * Webhook endpoint for AssemblyAI transcription completion.
 * Verifies HMAC-SHA256 signature when ASSEMBLYAI_WEBHOOK_SECRET is configured.
 */
export async function POST(request: NextRequest) {
  try {
    // ── Signature verification ──────────────────────────────────
    const webhookSecret = process.env.ASSEMBLYAI_WEBHOOK_SECRET;
    const rawBody = await request.text();

    if (webhookSecret) {
      const signature = request.headers.get('x-assemblyai-signature') || '';
      const expectedSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');
      if (signature !== expectedSig) {
        console.error('[transcription-webhook] Invalid signature — rejecting request');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } else {
      console.warn('[transcription-webhook] ⚠️ ASSEMBLYAI_WEBHOOK_SECRET not set — skipping signature verification');
    }

    const body = JSON.parse(rawBody);

    // AssemblyAI webhook format
    const { transcript_id, status } = body;

    if (!transcript_id) {
      return NextResponse.json(
        { error: 'Missing transcript_id' },
        { status: 400 }
      );
    }

    // Find call by transcript ID (we'll need to store this mapping)
    // For now, this is a simplified version
    // In production, you'd want to store transcriptId -> callId mapping

    // Get transcription result
    const transcriptionStatus = await getTranscriptionStatus(transcript_id);

    if (transcriptionStatus.status === 'completed' && transcriptionStatus.result) {
      // Find call(s) waiting for this transcript
      // This is simplified - you'd want a better way to match
      const calls = await db
        .select()
        .from(salesCalls)
        .where(eq(salesCalls.status, 'processing'))
        .limit(10); // Get recent processing calls

      for (const call of calls) {
        // Update call with transcript
        await db
          .update(salesCalls)
          .set({
            transcript: transcriptionStatus.result.transcript,
            transcriptJson: JSON.stringify(transcriptionStatus.result.transcriptJson),
            duration: transcriptionStatus.result.duration,
            status: 'transcribing', // Ready for analysis
          })
          .where(eq(salesCalls.id, call.id));

        // Trigger analysis (async)
        try {
          const analysisResult = await analyzeCall(
            transcriptionStatus.result.transcript,
            transcriptionStatus.result.transcriptJson
          );

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

          // Save analysis (10-category framework + prospect difficulty)
          await db
            .insert(callAnalysis)
            .values({
              callId: call.id,
              overallScore: analysisResult.overallScore,
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
            });

          // Mark call as completed
          await db
            .update(salesCalls)
            .set({
              status: 'completed',
              completedAt: new Date(),
            })
            .where(eq(salesCalls.id, call.id));
        } catch (analysisError) {
          console.error('Analysis error:', analysisError);
          await db
            .update(salesCalls)
            .set({ status: 'failed' })
            .where(eq(salesCalls.id, call.id));
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
