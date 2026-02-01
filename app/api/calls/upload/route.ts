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

    // Validate file type
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/webm'];
    if (!allowedTypes.includes(file.type)) {
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

    // Convert file to buffer for transcription
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    // Transcribe audio (Deepgram is fast, completes in seconds)
    let transcriptionResult;
    try {
      transcriptionResult = await transcribeAudioFile(audioBuffer, file.name);
    } catch (transcriptionError: unknown) {
      console.error('Transcription error:', transcriptionError);
      const msg = transcriptionError instanceof Error ? transcriptionError.message : 'Transcription failed';
      const isConfig = typeof msg === 'string' && (msg.includes('configured') || msg.includes('API') || msg.includes('key'));
      return NextResponse.json(
        { error: isConfig ? `Transcription not available: ${msg}. Set DEEPGRAM_API_KEY or ASSEMBLYAI_API_KEY.` : `Transcription failed: ${msg}` },
        { status: 500 }
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

    // Create call record with transcript ready
    const [call] = await db
      .insert(salesCalls)
      .values({
        organizationId,
        userId: session.user.id,
        fileName: file.name,
        fileUrl: '', // Not storing URL anymore
        fileSize: file.size,
        transcript: transcriptionResult.transcript,
        transcriptJson: JSON.stringify(transcriptionResult.transcriptJson),
        duration: transcriptionResult.duration,
        status: 'analyzing', // Ready for analysis immediately
        metadata: JSON.stringify(callMetadata),
        analysisIntent,
      })
      .returning();

    // Increment usage counter (skip in dev mode)
    if (!shouldBypassSubscription()) {
      await incrementUsage(organizationId, 'calls');
    }

    // Trigger analysis in background (non-blocking)
    analyzeCallAsync(call.id, transcriptionResult.transcript, transcriptionResult.transcriptJson).catch(
      (err) => console.error('Background analysis error:', err)
    );

    return NextResponse.json({
      callId: call.id,
      status: 'analyzing',
      message: 'Call uploaded and transcribed. Analysis in progress...',
    });
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
