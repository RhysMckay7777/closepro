Build a seed script to load Connor's transcripts from the TRANSCRIPTS folder into the trainingTranscripts DB table. Do NOT change any roleplay, voice, scoring, or analysis logic.

Context
The TRANSCRIPTS/ folder in the repo root contains 5 real sales call transcript files (text files)

The trainingTranscripts table already exists in db/schema.ts

lib/ai/roleplay/transcript-patterns.ts already reads from this table via getTranscriptPatternsForUser

The transcripts need to be INSERTed into the DB so the roleplay engine can use them

What to build
1. Seed script: scripts/seed-transcripts.ts
Create a script that:

Reads all files from the TRANSCRIPTS/ folder

For each file:

Reads the text content

Extracts a label from the filename (e.g., "andrei close pro..." → "Andrei Close Pro")

INSERTs into the trainingTranscripts table with: content, label, and the current user's org ID

Uses Drizzle ORM (db from @/db) for the insert

Skips files that already exist in the DB (check by label to avoid duplicates)

Logs progress: "Inserted X transcripts, skipped Y duplicates"

2. Add npm script
Add to package.json scripts:

json
"seed:transcripts": "npx tsx scripts/seed-transcripts.ts"
3. Also build an API route for future uploads: app/api/training/transcripts/route.ts
If this route already exists, verify it has:

GET: returns all transcripts for the user's org

POST: accepts { content, label } and inserts into trainingTranscripts

DELETE (by ID): removes a transcript

If it doesn't exist, create it with those three handlers

Add maxDuration = 60 since transcript content can be large

4. Check the trainingTranscripts schema
Read db/schema.ts and verify the trainingTranscripts table has columns for: id, content (text), label (varchar), orgId or userId, createdAt

If columns like label are missing, add them with a Drizzle migration

If the table references an org, use the first org from the organizations table as the default for the seed script

After running npm run seed:transcripts, getTranscriptPatternsForUser should automatically pick up these transcripts and feed them into the roleplay prospect's behavior