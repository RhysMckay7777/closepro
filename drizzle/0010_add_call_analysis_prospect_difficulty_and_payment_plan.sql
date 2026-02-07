-- call_analysis: prospect difficulty and objection details
ALTER TABLE "call_analysis"
  ADD COLUMN IF NOT EXISTS "objection_details" text,
  ADD COLUMN IF NOT EXISTS "prospect_difficulty" integer,
  ADD COLUMN IF NOT EXISTS "prospect_difficulty_tier" text;

-- Payment plan instalments (future cash/commission for figures)
CREATE TABLE IF NOT EXISTS "payment_plan_instalments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sales_call_id" uuid NOT NULL REFERENCES "sales_calls"("id") ON DELETE CASCADE,
  "due_date" timestamp NOT NULL,
  "amount_cents" integer NOT NULL,
  "commission_rate_pct" integer,
  "commission_amount_cents" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);
