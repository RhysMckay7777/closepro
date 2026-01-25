-- Add roleplay_analysis table (FK to roleplay_sessions).
-- Run with: psql $DATABASE_URL -f scripts/add-roleplay-analysis.sql

CREATE TABLE IF NOT EXISTS "roleplay_analysis" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "roleplay_session_id" uuid NOT NULL REFERENCES "public"."roleplay_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  "overall_score" integer,
  "value_score" integer,
  "trust_score" integer,
  "fit_score" integer,
  "logistics_score" integer,
  "value_details" text,
  "trust_details" text,
  "fit_details" text,
  "logistics_details" text,
  "skill_scores" text,
  "coaching_recommendations" text,
  "timestamped_feedback" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
