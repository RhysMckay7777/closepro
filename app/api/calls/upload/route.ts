import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { salesCalls, users, organizations, userOrganizations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { canPerformAction, incrementUsage } from '@/lib/subscription';
import { transcribeAudioFile } from '@/lib/ai/transcription';
import { shouldBypassSubscription } from '@/lib/dev-mode';
import { extractCallDetails } from '@/lib/ai/extract-call-details';
import { offers } from '@/db/schema';
// analyzeCallAsync is no longer called here — analysis happens after user confirms details

export const maxDuration = 120; // Allow up to 2 minutes for transcription (large files / slow Deepgram)

/**
 * Upload a sales call audio file.
 * Supports two paths:
 *   1. JSON body with { fileUrl } — file already uploaded to Vercel Blob from the browser
 *   2. FormData with a file — direct upload (small files < 4.5 MB)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user and organization
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user[0]) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get organization
    let organizationId = user[0].organizationId;
    if (!organizationId) {
      const firstOrg = await db
        .select()
        .from(userOrganizations)
        .where(eq(userOrganizations.userId, user[0].id))
        .limit(1);

      if (!firstOrg[0]) {
        return NextResponse.json(
          { error: 'No organization found' },
          { status: 404 }
        );
      }
      organizationId = firstOrg[0].organizationId;
    }

    // Check if user can upload calls (usage limits)
    const canUpload = await canPerformAction(organizationId, 'upload_call');
    if (!canUpload.allowed) {
      return NextResponse.json(
        { error: canUpload.reason || 'Cannot upload call' },
        { status: 403 }
      );
    }

    const contentType = request.headers.get('content-type') || '';

    // ─── PATH A: JSON body (file already in Vercel Blob) ───
    if (contentType.includes('application/json')) {
      const body = await request.json();
      const { fileUrl, fileName, fileSize, addToFigures: addToFig, metadata: rawMeta } = body as {
        fileUrl: string;
        fileName: string;
        fileSize?: number;
        addToFigures?: boolean;
        metadata?: Record<string, unknown>;
      };

      if (!fileUrl || !fileName) {
        return NextResponse.json({ error: 'fileUrl and fileName are required' }, { status: 400 });
      }

      const callMetadata = rawMeta || {};
      const addToFigures = addToFig !== false;
      const analysisIntent = addToFigures ? 'update_figures' : 'analysis_only';

      const [call] = await db
        .insert(salesCalls)
        .values({
          organizationId,
          userId: session.user.id,
          fileName,
          fileUrl,
          fileSize: fileSize ?? 0,
          transcript: null,
          transcriptJson: null,
          duration: null,
          status: 'transcribing',
          metadata: JSON.stringify(callMetadata),
          analysisIntent,
        })
        .returning();

      if (!shouldBypassSubscription()) {
        await incrementUsage(organizationId, 'calls');
      }

      try {
        await transcribeOnly(call.id, null, fileName, fileUrl);

        // Non-blocking: extract call details from transcript for auto-populating confirm form
        runExtraction(call.id, session.user.id, organizationId).catch(() => {});

        return NextResponse.json({
          callId: call.id,
          status: 'pending_confirmation',
          message: 'Transcription complete. Please confirm call details.',
        }, { status: 201 });
      } catch (transcribeErr: unknown) {
        console.error('Inline transcription error (blob):', transcribeErr);
        return NextResponse.json({
          callId: call.id,
          status: 'failed',
          message: 'Upload succeeded but transcription failed. You can retry from the call detail page.',
        }, { status: 201 });
      }
    }

    // ─── PATH B: FormData (direct file upload, < 4.5 MB) ───
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const metadata = formData.get('metadata') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/mp4', 'audio/x-m4a', 'audio/webm'];
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    const allowedExts = ['.mp3', '.wav', '.m4a', '.webm'];
    const typeOk = file.type && allowedTypes.includes(file.type);
    const extOk = allowedExts.includes(ext);
    if (!typeOk && !extOk) {
      return NextResponse.json(
        { error: 'Invalid file type. Supported: MP3, WAV, M4A, WebM' },
        { status: 400 }
      );
    }

    // Validate file size (max 100MB)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 100MB' },
        { status: 400 }
      );
    }

    let callMetadata: Record<string, unknown> = {};
    try {
      if (metadata) callMetadata = JSON.parse(metadata);
    } catch {
      // ignore invalid JSON
    }
    const addToFigures = callMetadata.addToFigures !== false;
    const analysisIntent = addToFigures ? 'update_figures' : 'analysis_only';

    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    const [call] = await db
      .insert(salesCalls)
      .values({
        organizationId,
        userId: session.user.id,
        fileName: file.name,
        fileUrl: '',
        fileSize: file.size,
        transcript: null,
        transcriptJson: null,
        duration: null,
        status: 'transcribing',
        metadata: JSON.stringify(callMetadata),
        analysisIntent,
      })
      .returning();

    if (!shouldBypassSubscription()) {
      await incrementUsage(organizationId, 'calls');
    }

    try {
      await transcribeOnly(call.id, audioBuffer, file.name);

      // Non-blocking: extract call details from transcript for auto-populating confirm form
      runExtraction(call.id, session.user.id, organizationId).catch(() => {});

      return NextResponse.json({
        callId: call.id,
        status: 'pending_confirmation',
        message: 'Transcription complete. Please confirm call details.',
      }, { status: 201 });
    } catch (transcribeErr: unknown) {
      console.error('Inline transcription error:', transcribeErr);
      return NextResponse.json({
        callId: call.id,
        status: 'failed',
        message: 'Upload succeeded but transcription failed. You can retry from the call detail page.',
      }, { status: 201 });
    }
  } catch (error: unknown) {
    console.error('Error uploading call:', error);
    let msg = error instanceof Error ? error.message : 'Failed to upload call';
    if (typeof msg === 'string' && (msg.includes('timeout') || msg.includes('TIMEOUT') || msg.includes('aborted'))) {
      msg = 'Upload timed out. Try a shorter file or use Paste transcript instead.';
    }
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}

/**
 * Transcribe audio (from buffer or URL) and update call row.
 * Analysis is NOT triggered here — it happens after user confirms call details.
 */
async function transcribeOnly(
  callId: string,
  audioBuffer: Buffer | null,
  fileName: string,
  fileUrl?: string
): Promise<void> {
  let transcriptionResult;
  try {
    transcriptionResult = await transcribeAudioFile(audioBuffer, fileName, fileUrl);
  } catch (err: unknown) {
    console.error('Transcription error:', err);
    await db
      .update(salesCalls)
      .set({ status: 'failed' })
      .where(eq(salesCalls.id, callId));
    throw err;
  }

  await db
    .update(salesCalls)
    .set({
      transcript: transcriptionResult.transcript,
      transcriptJson: JSON.stringify(transcriptionResult.transcriptJson),
      duration: transcriptionResult.duration,
      status: 'pending_confirmation',
    })
    .where(eq(salesCalls.id, callId));
}

/**
 * Non-blocking: fetch transcript + user's offers, run AI extraction, save to extractedDetails column.
 * If anything fails, we just log and move on — the confirm page will show empty fields (same as before).
 */
async function runExtraction(callId: string, userId: string, organizationId: string): Promise<void> {
  try {
    // Fetch transcript
    const [callRow] = await db
      .select({ transcript: salesCalls.transcript })
      .from(salesCalls)
      .where(eq(salesCalls.id, callId))
      .limit(1);
    if (!callRow?.transcript) return;

    // Fetch user's offer names for matching
    const userOffers = await db
      .select({ name: offers.name })
      .from(offers)
      .where(eq(offers.userId, userId));
    const offerNames = userOffers.map((o) => o.name);

    const extracted = await extractCallDetails(callRow.transcript, offerNames);

    // Only save if at least one field was populated
    const hasValue = Object.values(extracted).some((v) => v !== null);
    if (!hasValue) return;

    await db
      .update(salesCalls)
      .set({ extractedDetails: JSON.stringify(extracted) })
      .where(eq(salesCalls.id, callId));

    console.log('[upload-route] Extraction saved for call:', callId);
  } catch (err) {
    console.error('[upload-route] Extraction failed (non-critical):', err);
  }
}
