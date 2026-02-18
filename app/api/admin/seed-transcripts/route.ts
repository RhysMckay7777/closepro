import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { trainingTranscripts } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import {
  parseTranscript,
  titleFromFilename,
  autoDetectTags,
} from '@/lib/training/transcript-parser';
import { extractPatterns } from '@/lib/training/pattern-extraction';

/**
 * POST /api/admin/seed-transcripts
 *
 * Reads all transcript files from the project's `transcripts/` folder,
 * parses them (SRT/WEBVTT/custom formats), and bulk-inserts into the
 * trainingTranscripts table with pattern extraction.
 *
 * Dev-only — requires authentication.
 */
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin role check — restrict to known admin emails
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    if (adminEmails.length > 0 && !adminEmails.includes(session.user.email?.toLowerCase() ?? '')) {
      return NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 });
    }

    // Ensure table exists
    try {
      await db.select({ id: trainingTranscripts.id }).from(trainingTranscripts).limit(0);
    } catch {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS training_transcripts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
          organization_id TEXT REFERENCES organization(id),
          title TEXT NOT NULL,
          raw_transcript TEXT NOT NULL,
          extracted_patterns TEXT,
          tags TEXT,
          status TEXT NOT NULL DEFAULT 'uploaded',
          word_count INTEGER,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
    }

    // Read transcripts folder
    const transcriptsDir = join(process.cwd(), 'transcripts');
    let files: string[];
    try {
      const dirEntries = await readdir(transcriptsDir);
      files = dirEntries.filter((f) =>
        /\.(txt|srt|vtt|webvtt|csv|md)$/i.test(f)
      );
    } catch (err: any) {
      return NextResponse.json(
        { error: `Cannot read transcripts/ folder: ${err.message}` },
        { status: 400 }
      );
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No transcript files found in transcripts/ folder' },
        { status: 400 }
      );
    }

    const results: Array<{
      file: string;
      title: string;
      status: string;
      wordCount?: number;
      speakers?: string[];
      format?: string;
      duration?: string;
      skipped?: boolean;
    }> = [];

    for (const file of files) {
      const title = titleFromFilename(file);

      // Check if already seeded (by title for this user)
      const existing = await db
        .select({ id: trainingTranscripts.id })
        .from(trainingTranscripts)
        .where(
          and(
            eq(trainingTranscripts.userId, session.user.id),
            eq(trainingTranscripts.title, title)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        results.push({ file, title, status: 'skipped (already exists)', skipped: true });
        continue;
      }

      // Read and parse file
      const raw = await readFile(join(transcriptsDir, file), 'utf-8');
      const parsed = parseTranscript(raw);

      if (parsed.cleanText.length < 50) {
        results.push({ file, title, status: 'skipped (too short)' });
        continue;
      }

      const wordCount = parsed.cleanText.split(/\s+/).length;
      const tags = autoDetectTags(parsed.cleanText, parsed.speakers, file);

      // Format duration for display
      let durationDisplay: string | undefined;
      if (parsed.estimatedDurationSeconds) {
        const mins = Math.floor(parsed.estimatedDurationSeconds / 60);
        const secs = parsed.estimatedDurationSeconds % 60;
        durationDisplay = `${mins}m ${secs}s`;
      }

      // Insert into DB
      const [inserted] = await db
        .insert(trainingTranscripts)
        .values({
          userId: session.user.id,
          title,
          rawTranscript: parsed.cleanText,
          tags: tags.length > 0 ? JSON.stringify(tags) : null,
          status: 'processing',
          wordCount,
        })
        .returning();

      // Run pattern extraction (blocking — we want results before responding)
      try {
        const patterns = await extractPatterns(parsed.cleanText);
        await db
          .update(trainingTranscripts)
          .set({
            extractedPatterns: patterns ? JSON.stringify(patterns) : null,
            status: patterns ? 'processed' : 'uploaded',
            updatedAt: new Date(),
          })
          .where(eq(trainingTranscripts.id, inserted.id));

        results.push({
          file,
          title,
          status: patterns ? 'processed' : 'uploaded (no patterns)',
          wordCount,
          speakers: parsed.speakers,
          format: parsed.format,
          duration: durationDisplay,
        });
      } catch (err) {
        console.error(`[seed-transcripts] Pattern extraction failed for ${file}:`, err);
        await db
          .update(trainingTranscripts)
          .set({ status: 'error', updatedAt: new Date() })
          .where(eq(trainingTranscripts.id, inserted.id));

        results.push({
          file,
          title,
          status: 'error (pattern extraction failed)',
          wordCount,
          speakers: parsed.speakers,
          format: parsed.format,
          duration: durationDisplay,
        });
      }
    }

    const processed = results.filter((r) => r.status === 'processed').length;
    const skipped = results.filter((r) => r.skipped).length;

    return NextResponse.json({
      message: `Seeded ${processed} transcript(s), skipped ${skipped}`,
      results,
    });
  } catch (error: any) {
    console.error('[seed-transcripts] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to seed transcripts' },
      { status: 500 }
    );
  }
}
