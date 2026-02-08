import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { salesCalls, users, organizations, userOrganizations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { canPerformAction, incrementUsage } from '@/lib/subscription';
import { transcribeAudioFile } from '@/lib/ai/transcription';
import { shouldBypassSubscription } from '@/lib/dev-mode';
import { analyzeCallAsync } from '@/lib/calls/analyze-call';

export const maxDuration = 120; // Allow up to 2 minutes for transcription (large files / slow Deepgram)

/**
 * Upload a sales call audio file
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
    // Bypassed in dev mode via canPerformAction
    const canUpload = await canPerformAction(organizationId, 'upload_call');
    if (!canUpload.allowed) {
      return NextResponse.json(
        { error: canUpload.reason || 'Cannot upload call' },
        { status: 403 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const metadata = formData.get('metadata') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type (MIME and/or extension — M4A is often reported as audio/mp4)
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
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 100MB' },
        { status: 400 }
      );
    }

    // Store metadata; addToFigures (default true) controls whether this call counts in figures
    let callMetadata: Record<string, unknown> = {};
    try {
      if (metadata) callMetadata = JSON.parse(metadata);
    } catch {
      // ignore invalid JSON
    }
    const addToFigures = callMetadata.addToFigures !== false;
    const analysisIntent = addToFigures ? 'update_figures' : 'analysis_only';

    // Create call record immediately with status 'transcribing' so UI never freezes
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

    // Run transcription + analysis INLINE (awaited) so it completes
    // before the HTTP response is sent. maxDuration = 120 keeps the
    // Vercel function alive for the full cycle.
    try {
      await transcribeAndAnalyzeAsync(call.id, audioBuffer, file.name, analysisIntent);

      return NextResponse.json({
        callId: call.id,
        status: 'completed',
        message: 'Upload received. Transcription and analysis complete.',
      }, { status: 201 });
    } catch (analysisErr: unknown) {
      console.error('Inline transcribe/analyze error:', analysisErr);
      // The helper already sets DB status to 'failed', so just return
      // a response the frontend can handle.
      return NextResponse.json({
        callId: call.id,
        status: 'failed',
        message: 'Upload succeeded but analysis failed. You can retry from the call detail page.',
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
 * Background: transcribe audio, update call row, then run analysis.
 */
async function transcribeAndAnalyzeAsync(
  callId: string,
  audioBuffer: Buffer,
  fileName: string,
  analysisIntent: string
): Promise<void> {
  let transcriptionResult;
  try {
    transcriptionResult = await transcribeAudioFile(audioBuffer, fileName);
  } catch (err: unknown) {
    console.error('Background transcription error:', err);
    await db
      .update(salesCalls)
      .set({ status: 'failed' })
      .where(eq(salesCalls.id, callId));
    return;
  }

  await db
    .update(salesCalls)
    .set({
      transcript: transcriptionResult.transcript,
      transcriptJson: JSON.stringify(transcriptionResult.transcriptJson),
      duration: transcriptionResult.duration,
      status: 'analyzing',
    })
    .where(eq(salesCalls.id, callId));

  await analyzeCallAsync(
    callId,
    transcriptionResult.transcript,
    transcriptionResult.transcriptJson
  );
}
