import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { salesCalls, users, userOrganizations } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { canPerformAction, incrementUsage } from '@/lib/subscription';
import { shouldBypassSubscription } from '@/lib/dev-mode';
import { extractCallDetails } from '@/lib/ai/extract-call-details';
import { offers } from '@/db/schema';
// analyzeCallAsync is no longer called here — analysis happens after user confirms details
import { extractTextFromTranscriptFile, isAllowedTranscriptFile } from '@/lib/calls/extract-transcript-text';

export const maxDuration = 60;

/**
 * Build minimal transcriptJson from pasted transcript text.
 * Analysis expects { utterances: Array<{ speaker, start, end, text }> }.
 */
function transcriptTextToJson(transcript: string): { utterances: Array<{ speaker: string; start: number; end: number; text: string }> } {
  const trimmed = transcript.trim();
  if (!trimmed) {
    return { utterances: [] };
  }
  // If lines look like "[Speaker A] ..." or "Speaker 1: ...", split by speaker
  const speakerLine = /^(\s*\[?\s*Speaker\s+\w+\s*\]?\s*:?\s*)(.*)$/im;
  const lines = trimmed.split(/\n+/);
  const utterances: Array<{ speaker: string; start: number; end: number; text: string }> = [];
  let time = 0;
  for (const line of lines) {
    const m = line.match(speakerLine);
    const text = m ? m[2].trim() : line.trim();
    if (!text) continue;
    const speaker = m ? m[1].replace(/[\[\]:]/g, '').trim() || 'Speaker A' : 'Speaker A';
    utterances.push({ speaker, start: time, end: time + 1000, text });
    time += 2000;
  }
  if (utterances.length === 0) {
    utterances.push({ speaker: 'Speaker A', start: 0, end: 1000, text: trimmed });
  }
  return { utterances };
}

/**
 * Try to extract a prospect name from transcript text (for pre-filling outcome form).
 * Looks for "Call with X", "Prospect: X", "Client: X", or a short first line that looks like a name.
 */
function extractProspectNameFromTranscript(transcript: string): string | null {
  const head = transcript.trim().slice(0, 800);
  const withMatch = head.match(/(?:call|meeting|session)\s+with\s+([A-Za-z][A-Za-z\s.-]{1,60}?)(?:\n|\.|$)/i);
  if (withMatch) return withMatch[1].trim().slice(0, 200) || null;
  const prospectMatch = head.match(/(?:prospect|client|customer)\s*:\s*([A-Za-z][A-Za-z\s.-]{1,60}?)(?:\n|$)/i);
  if (prospectMatch) return prospectMatch[1].trim().slice(0, 200) || null;
  const firstLine = head.split(/\n/)[0]?.trim();
  if (firstLine && firstLine.length <= 50 && /^[A-Za-z][A-Za-z\s.-]+$/.test(firstLine) && !firstLine.includes(':'))
    return firstLine.slice(0, 200);
  return null;
}

/**
 * POST - Create a call from pasted transcript or uploaded file (no audio/Deepgram).
 * Accepts either:
 * - JSON: { transcript: string, addToFigures?: boolean, fileName?: string }
 * - FormData: file (TXT/PDF/DOCX) + optional metadata (JSON string with addToFigures)
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[transcript-route] POST request received');
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      console.log('[transcript-route] Unauthorized — no session');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    console.log('[transcript-route] Authenticated user:', session.user.id);

    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user[0]) {
      console.log('[transcript-route] User not found in DB for id:', session.user.id);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    console.log('[transcript-route] User found, orgId:', user[0].organizationId);

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

    const canUpload = await canPerformAction(organizationId, 'upload_call');
    if (!canUpload.allowed) {
      console.log('[transcript-route] Subscription check failed:', canUpload.reason);
      return NextResponse.json(
        { error: canUpload.reason || 'Cannot add call' },
        { status: 403 }
      );
    }
    console.log('[transcript-route] Subscription check passed');

    const contentType = request.headers.get('content-type') ?? '';
    let transcript: string;
    let fileName: string;
    let addToFigures = true;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const metadataStr = formData.get('metadata') as string | null;
      if (!file || typeof file.name !== 'string' || file.size === 0) {
        return NextResponse.json(
          { error: 'No file provided. Upload a .txt, .pdf, or .docx transcript file.' },
          { status: 400 }
        );
      }
      if (!isAllowedTranscriptFile(file.name, file.type ?? '')) {
        return NextResponse.json(
          { error: 'Unsupported file type. Use .txt, .pdf, or .docx.' },
          { status: 400 }
        );
      }
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        transcript = await extractTextFromTranscriptFile(buffer, file.name, file.type ?? undefined);
      } catch (extractErr: unknown) {
        const msg = extractErr instanceof Error ? extractErr.message : 'Failed to extract text from file';
        return NextResponse.json(
          { error: msg },
          { status: 400 }
        );
      }
      if (!transcript.trim()) {
        return NextResponse.json(
          { error: 'File appears empty or no text could be extracted.' },
          { status: 400 }
        );
      }
      fileName = file.name;
      if (metadataStr && typeof metadataStr === 'string') {
        try {
          const meta = JSON.parse(metadataStr);
          addToFigures = meta.addToFigures !== false;
        } catch {
          // ignore invalid metadata
        }
      }
    } else {
      const body = await request.json();
      const { transcript: bodyTranscript, addToFigures: bodyAddToFigures = true, fileName: bodyFileName = 'pasted-transcript.txt' } = body;
      if (typeof bodyTranscript !== 'string' || !bodyTranscript.trim()) {
        return NextResponse.json(
          { error: 'transcript (string) is required, or upload a .txt / .pdf / .docx file' },
          { status: 400 }
        );
      }
      transcript = bodyTranscript.trim();
      fileName = typeof bodyFileName === 'string' ? bodyFileName : 'pasted-transcript.txt';
      addToFigures = bodyAddToFigures !== false;
    }

    const transcriptJson = transcriptTextToJson(transcript);
    const callMetadata = { addToFigures };
    const prospectName = extractProspectNameFromTranscript(transcript);

    const trimmedTranscript = transcript.trim();
    const metadataStr = JSON.stringify(callMetadata);
    const transcriptJsonStr = JSON.stringify(transcriptJson);

    console.log('[transcript-route] Parsed transcript:', { charCount: trimmedTranscript.length, utteranceCount: transcriptJson.utterances.length, prospectName, fileName });

    let callId: string;

    try {
      const [call] = await db
        .insert(salesCalls)
        .values({
          organizationId,
          userId: session.user.id,
          fileName,
          fileUrl: '',
          fileSize: null,
          duration: null,
          transcript: trimmedTranscript,
          transcriptJson: transcriptJsonStr,
          status: 'pending_confirmation',
          metadata: metadataStr,
          ...(prospectName && { prospectName: prospectName.slice(0, 500) }),
        })
        .returning();

      callId = call.id;
      console.log('[transcript-route] Call inserted via ORM, callId:', callId);
    } catch (insertError: unknown) {
      const err = insertError as { code?: string; cause?: { code?: string }; message?: string };
      const code = err?.code ?? err?.cause?.code;
      const msg = typeof err?.message === 'string' ? err.message : '';
      const isMissingColumn = code === '42703' || (msg.includes('does not exist') && msg.includes('column'));
      if (isMissingColumn) {
        const result = await db.execute<{ id: string }>(sql`
          INSERT INTO sales_calls (organization_id, user_id, file_name, file_url, file_size, duration, transcript, transcript_json, status, metadata)
          VALUES (${organizationId}, ${session.user.id}, ${fileName}, '', null, null, ${trimmedTranscript}, ${transcriptJsonStr}, 'pending_confirmation', ${metadataStr})
          RETURNING id
        `);
        const rows = Array.isArray(result) ? result : (result as { rows?: { id: string }[] })?.rows ?? [];
        const row = Array.isArray(rows) ? rows[0] : (rows as { id?: string }[])?.[0];
        const id = row && typeof row === 'object' && 'id' in row ? (row as { id: string }).id : undefined;
        if (!id) {
          throw new Error('Database schema is out of date. Run: npm run db:migrate');
        }
        callId = id;
        console.log('[transcript-route] Call inserted via raw SQL fallback, callId:', callId);
      } else {
        throw insertError;
      }
    }

    if (!shouldBypassSubscription()) {
      await incrementUsage(organizationId, 'calls');
    }

    // Non-blocking: extract call details from transcript for auto-populating confirm form
    runTranscriptExtraction(callId, session.user.id, trimmedTranscript).catch(() => {});

    console.log('[transcript-route] ✅ Complete — callId:', callId, 'status: pending_confirmation');
    // No analysis here — user must confirm details first on the confirm page.
    return NextResponse.json({
      callId,
      status: 'pending_confirmation',
      message: 'Transcript saved. Please confirm call details.',
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('[transcript-route] ❌ Error creating call from transcript:', error);
    const code = (error as { code?: string })?.code;
    const msg = error instanceof Error ? error.message : 'Failed to create call from transcript';
    const userMessage = code === '42703'
      ? 'Database schema is out of date. Run: npm run db:migrate'
      : msg;
    return NextResponse.json(
      { error: userMessage },
      { status: 500 }
    );
  }
}

/**
 * Non-blocking: run AI extraction on transcript text and save to extractedDetails column.
 * If anything fails, we just log and move on — the confirm page will show empty fields.
 */
async function runTranscriptExtraction(callId: string, userId: string, transcript: string): Promise<void> {
  try {
    // Fetch user's offer names for matching
    const userOffers = await db
      .select({ name: offers.name })
      .from(offers)
      .where(eq(offers.userId, userId));
    const offerNames = userOffers.map((o) => o.name);

    const extracted = await extractCallDetails(transcript, offerNames);

    // Only save if at least one field was populated
    const hasValue = Object.values(extracted).some((v) => v !== null);
    if (!hasValue) return;

    await db
      .update(salesCalls)
      .set({ extractedDetails: JSON.stringify(extracted) } as any)
      .where(eq(salesCalls.id, callId));

    console.log('[transcript-route] Extraction saved for call:', callId);
  } catch (err) {
    console.error('[transcript-route] Extraction failed (non-critical):', err);
  }
}
