import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { salesCalls } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getTranscriptionStatus } from '@/lib/ai/transcription';
import { analyzeCall } from '@/lib/ai/analysis';
import { callAnalysis } from '@/db/schema';

/**
 * Webhook endpoint for AssemblyAI transcription completion
 * This should be called by AssemblyAI when transcription is complete
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
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

          // Save analysis
          await db
            .insert(callAnalysis)
            .values({
              callId: call.id,
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
              coachingRecommendations: JSON.stringify(analysisResult.coachingRecommendations),
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
