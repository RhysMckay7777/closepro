-- Add voice_style to prospect_avatars (optional; ElevenLabs maps to voice ID)
ALTER TABLE "prospect_avatars"
  ADD COLUMN IF NOT EXISTS "voice_style" text;
