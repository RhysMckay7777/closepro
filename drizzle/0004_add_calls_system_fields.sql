-- Add calls system fields to sales_calls table
-- Migration: 0004_add_calls_system_fields

-- Create enums if they don't exist
DO $$ BEGIN
  CREATE TYPE call_type AS ENUM ('closing_call', 'follow_up', 'no_show');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE call_result AS ENUM ('no_show', 'closed', 'lost', 'unqualified', 'follow_up', 'deposit');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE offer_category AS ENUM ('b2c_health', 'b2c_relationships', 'b2c_wealth', 'mixed_wealth', 'b2b_services');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add columns to sales_calls table
ALTER TABLE "sales_calls" 
  ADD COLUMN IF NOT EXISTS "offer_id" uuid REFERENCES "offers"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "offer_type" offer_category,
  ADD COLUMN IF NOT EXISTS "call_type" call_type,
  ADD COLUMN IF NOT EXISTS "result" call_result,
  ADD COLUMN IF NOT EXISTS "qualified" boolean,
  ADD COLUMN IF NOT EXISTS "cash_collected" integer,
  ADD COLUMN IF NOT EXISTS "revenue_generated" integer,
  ADD COLUMN IF NOT EXISTS "deposit_taken" boolean,
  ADD COLUMN IF NOT EXISTS "reason_for_outcome" text,
  ADD COLUMN IF NOT EXISTS "analysis_intent" text,
  ADD COLUMN IF NOT EXISTS "was_confirmed" boolean,
  ADD COLUMN IF NOT EXISTS "booking_source" text,
  ADD COLUMN IF NOT EXISTS "original_call_id" uuid REFERENCES "sales_calls"("id") ON DELETE SET NULL;

-- Create index on offer_id for faster lookups
CREATE INDEX IF NOT EXISTS "sales_calls_offer_id_idx" ON "sales_calls"("offer_id");
CREATE INDEX IF NOT EXISTS "sales_calls_original_call_id_idx" ON "sales_calls"("original_call_id");
