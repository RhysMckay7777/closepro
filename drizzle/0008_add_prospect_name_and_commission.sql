-- Add prospect_name and commission_rate_pct to sales_calls; commission_rate_pct to users
ALTER TABLE "sales_calls"
  ADD COLUMN IF NOT EXISTS "prospect_name" text,
  ADD COLUMN IF NOT EXISTS "commission_rate_pct" integer;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "commission_rate_pct" integer;
