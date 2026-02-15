import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { trainingTranscripts } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { extractPatterns } from '@/lib/training/pattern-extraction';

/**
 * GET — List all training transcripts for the user
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Auto-create table if it doesn't exist
        try {
            const transcripts = await db
                .select({
                    id: trainingTranscripts.id,
                    title: trainingTranscripts.title,
                    tags: trainingTranscripts.tags,
                    status: trainingTranscripts.status,
                    wordCount: trainingTranscripts.wordCount,
                    createdAt: trainingTranscripts.createdAt,
                })
                .from(trainingTranscripts)
                .where(eq(trainingTranscripts.userId, session.user.id))
                .orderBy(desc(trainingTranscripts.createdAt));

            return NextResponse.json({ transcripts });
        } catch (err: any) {
            if (err?.message?.includes('does not exist') || err?.message?.includes('relation')) {
                // Table doesn't exist yet — auto-migrate
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
                return NextResponse.json({ transcripts: [] });
            }
            throw err;
        }
    } catch (error: any) {
        console.error('[training-transcripts] GET error:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch transcripts' }, { status: 500 });
    }
}

/**
 * POST — Upload new training transcript(s)
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { transcripts: uploads } = body as {
            transcripts: Array<{ title: string; content: string; tags?: string[] }>;
        };

        if (!uploads || !Array.isArray(uploads) || uploads.length === 0) {
            return NextResponse.json({ error: 'No transcripts provided' }, { status: 400 });
        }

        if (uploads.length > 10) {
            return NextResponse.json({ error: 'Maximum 10 transcripts per upload' }, { status: 400 });
        }

        // Auto-create table if needed
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

        const results = [];

        for (const upload of uploads) {
            if (!upload.content || upload.content.trim().length < 50) {
                results.push({ title: upload.title, error: 'Transcript too short (minimum 50 characters)' });
                continue;
            }

            const wordCount = upload.content.split(/\s+/).length;
            const title = upload.title || `Transcript ${new Date().toLocaleDateString()}`;

            // Insert with 'processing' status
            const [inserted] = await db
                .insert(trainingTranscripts)
                .values({
                    userId: session.user.id,
                    title,
                    rawTranscript: upload.content,
                    tags: upload.tags ? JSON.stringify(upload.tags) : null,
                    status: 'processing',
                    wordCount,
                })
                .returning();

            // Extract patterns in background (non-blocking)
            extractPatterns(upload.content)
                .then(async (patterns) => {
                    await db
                        .update(trainingTranscripts)
                        .set({
                            extractedPatterns: patterns ? JSON.stringify(patterns) : null,
                            status: patterns ? 'processed' : 'uploaded',
                            updatedAt: new Date(),
                        })
                        .where(eq(trainingTranscripts.id, inserted.id));
                })
                .catch(async (err) => {
                    console.error('[training-transcripts] Background pattern extraction failed:', err);
                    await db
                        .update(trainingTranscripts)
                        .set({ status: 'error', updatedAt: new Date() })
                        .where(eq(trainingTranscripts.id, inserted.id));
                });

            results.push({
                id: inserted.id,
                title: inserted.title,
                status: 'processing',
                wordCount,
            });
        }

        return NextResponse.json({ results, message: `${results.length} transcript(s) uploaded and processing` });
    } catch (error: any) {
        console.error('[training-transcripts] POST error:', error);
        return NextResponse.json({ error: error.message || 'Failed to upload transcripts' }, { status: 500 });
    }
}

/**
 * DELETE — Delete a training transcript
 */
export async function DELETE(request: NextRequest) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await request.json();
        if (!id) {
            return NextResponse.json({ error: 'Transcript ID required' }, { status: 400 });
        }

        await db
            .delete(trainingTranscripts)
            .where(
                and(
                    eq(trainingTranscripts.id, id),
                    eq(trainingTranscripts.userId, session.user.id)
                )
            );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[training-transcripts] DELETE error:', error);
        return NextResponse.json({ error: error.message || 'Failed to delete transcript' }, { status: 500 });
    }
}
