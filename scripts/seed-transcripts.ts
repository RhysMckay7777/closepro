/**
 * Seed script — loads transcript files from TRANSCRIPTS/ folder into
 * the trainingTranscripts DB table.
 *
 * Usage: npm run seed:transcripts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import fs from 'fs';
import path from 'path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';

const { trainingTranscripts, organizations, users } = schema;

const TRANSCRIPTS_DIR = path.resolve(__dirname, '..', 'TRANSCRIPTS');

// Direct DB connection (avoids @/ alias issues in standalone scripts)
const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

/**
 * Turn a filename into a human-readable label.
 * "andrei close pro transcript .txt" → "Andrei Close Pro Transcript"
 */
function labelFromFilename(filename: string): string {
  return filename
    .replace(/\.txt$/i, '')
    .replace(/\.docx$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

async function main() {
  console.log('[seed-transcripts] Starting...');

  if (!process.env.DATABASE_URL) {
    console.error('[seed-transcripts] DATABASE_URL not set — check .env.local');
    process.exit(1);
  }

  // 1. Read TRANSCRIPTS directory
  if (!fs.existsSync(TRANSCRIPTS_DIR)) {
    console.error(`[seed-transcripts] Directory not found: ${TRANSCRIPTS_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(TRANSCRIPTS_DIR)
    .filter((f) => f.endsWith('.txt'));

  if (files.length === 0) {
    console.log('[seed-transcripts] No .txt files found in TRANSCRIPTS/');
    process.exit(0);
  }

  console.log(`[seed-transcripts] Found ${files.length} transcript file(s)`);

  // 2. Get default org (first organization in the table)
  const orgs = await db.select().from(organizations).limit(1);
  const defaultOrgId = orgs[0]?.id ?? null;

  if (!defaultOrgId) {
    console.warn('[seed-transcripts] No organization found — orgId will be null');
  } else {
    console.log(`[seed-transcripts] Using org: ${orgs[0].name} (${defaultOrgId})`);
  }

  // 3. Get userId (NOT NULL column) — grab first user from org or any user
  let userId: string;

  if (defaultOrgId) {
    const orgUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.organizationId, defaultOrgId))
      .limit(1);
    userId = orgUsers[0]?.id ?? '';
  } else {
    const anyUser = await db.select({ id: users.id }).from(users).limit(1);
    userId = anyUser[0]?.id ?? '';
  }

  if (!userId) {
    console.error('[seed-transcripts] No users found in DB — cannot seed without a userId');
    process.exit(1);
  }

  console.log(`[seed-transcripts] Using userId: ${userId}`);

  // 4. Load existing titles to skip duplicates
  const existing = await db
    .select({ title: trainingTranscripts.title })
    .from(trainingTranscripts)
    .where(eq(trainingTranscripts.userId, userId));

  const existingTitles = new Set(existing.map((r) => r.title));

  let inserted = 0;
  let skipped = 0;

  // 5. Process each file
  for (const file of files) {
    const title = labelFromFilename(file);

    if (existingTitles.has(title)) {
      console.log(`  Skipped (duplicate): ${title}`);
      skipped++;
      continue;
    }

    const filePath = path.join(TRANSCRIPTS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const wordCount = content.split(/\s+/).filter(Boolean).length;

    // Insert with status 'uploaded' (pattern extraction happens via API or manually)
    await db
      .insert(trainingTranscripts)
      .values({
        userId,
        organizationId: defaultOrgId,
        title,
        rawTranscript: content,
        status: 'uploaded',
        wordCount,
      });

    console.log(`  Inserted: ${title} (${wordCount} words)`);
    inserted++;
  }

  console.log(
    `\n[seed-transcripts] Done — Inserted ${inserted}, skipped ${skipped} duplicate(s)`
  );

  // Close DB connection
  await client.end();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('[seed-transcripts] Fatal error:', err);
  await client.end();
  process.exit(1);
});
