import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { salesCalls, callAnalysis } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { analyzeCallAsync } from '@/lib/calls/analyze-call';

export const maxDuration = 60;

/**
 * POST - Trigger analysis for a call that has a transcript but hasn't been analyzed yet.
 * This runs inline (awaited) so the client gets the result when the request completes.
 * The maxDuration = 60 keeps the Vercel function alive for the full analysis cycle.
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ callId: string }> }
) {
    try {
        const { callId } = await params;
        console.log('[analyze-route] POST re-analyse request for callId:', callId);
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Get the call record
        const calls = await db
            .select()
            .from(salesCalls)
            .where(eq(salesCalls.id, callId))
            .limit(1);

        if (!calls[0]) {
            return NextResponse.json(
                { error: 'Call not found' },
                { status: 404 }
            );
        }

        const call = calls[0];
        console.log('[analyze-route] Found call, status:', call.status);

        // Verify ownership
        if (call.userId !== session.user.id) {
            return NextResponse.json(
                { error: 'Access denied' },
                { status: 403 }
            );
        }

        // If already completed, return existing analysis — unless it's missing (re-analyse scenario)
        if (call.status === 'completed') {
            const existingAnalysis = await db
                .select()
                .from(callAnalysis)
                .where(eq(callAnalysis.callId, callId))
                .limit(1);

            if (existingAnalysis[0]) {
                console.log('[analyze-route] Call already has analysis, returning existing');
                return NextResponse.json({
                    status: 'completed',
                    analysis: existingAnalysis[0],
                });
            }
            // Analysis missing — fall through to re-run analysis
            console.log('[analyze-route] Call completed but analysis MISSING — will re-run');
        }

        // If failed, allow retry — update status to analyzing
        if (call.status === 'failed') {
            console.log('[analyze-route] Call failed — retrying, setting status to analyzing');
            await db.update(salesCalls).set({ status: 'analyzing' }).where(eq(salesCalls.id, callId));
        }

        // Must have a transcript to analyze
        if (!call.transcript) {
            return NextResponse.json(
                { error: 'No transcript available for analysis' },
                { status: 400 }
            );
        }

        // Build transcriptJson from existing data or create minimal version
        let transcriptJson = { utterances: [] as Array<{ speaker: string; start: number; end: number; text: string }> };
        if (call.transcriptJson) {
            try {
                const parsed = typeof call.transcriptJson === 'string' ? JSON.parse(call.transcriptJson) : call.transcriptJson;
                if (parsed?.utterances) {
                    transcriptJson = parsed;
                }
            } catch {
                // Fall through to default
            }
        }

        // If transcriptJson has no utterances, build from raw transcript
        if (transcriptJson.utterances.length === 0) {
            const lines = call.transcript.trim().split(/\n+/);
            let time = 0;
            for (const line of lines) {
                const text = line.trim();
                if (!text) continue;
                transcriptJson.utterances.push({ speaker: 'Speaker A', start: time, end: time + 1000, text });
                time += 2000;
            }
        }

        // Run analysis inline (awaited — maxDuration keeps us alive)
        console.log('[analyze-route] Starting analyzeCallAsync...');
        const t0 = Date.now();
        await analyzeCallAsync(callId, call.transcript, transcriptJson);
        console.log('[analyze-route] ✅ Analysis complete in', ((Date.now() - t0) / 1000).toFixed(1), 's');

        // Fetch the analysis that was just created
        const analysis = await db
            .select()
            .from(callAnalysis)
            .where(eq(callAnalysis.callId, callId))
            .limit(1);

        // Fetch updated call status
        const updatedCall = await db
            .select({ status: salesCalls.status })
            .from(salesCalls)
            .where(eq(salesCalls.id, callId))
            .limit(1);

        return NextResponse.json({
            status: updatedCall[0]?.status ?? 'completed',
            analysis: analysis[0] ?? null,
        });
    } catch (error: unknown) {
        console.error('[analyze-route] ❌ Error analyzing call:', error);
        const msg = error instanceof Error ? error.message : 'Analysis failed';
        return NextResponse.json(
            { status: 'failed', error: msg },
            { status: 500 }
        );
    }
}
