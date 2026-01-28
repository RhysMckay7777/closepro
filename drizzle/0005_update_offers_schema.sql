-- Update offers table schema
-- Migration: 0005_update_offers_schema

-- Create enums if they don't exist
DO $$ BEGIN
  CREATE TYPE customer_stage AS ENUM ('aspiring', 'current', 'mixed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE case_study_strength AS ENUM ('none', 'weak', 'moderate', 'strong');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE primary_funnel_source AS ENUM ('cold_outbound', 'cold_ads', 'warm_inbound', 'content_driven_inbound', 'referral', 'existing_customer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Ensure offer_category enum exists (may have been created in previous migration)
DO $$ BEGIN
  CREATE TYPE offer_category AS ENUM ('b2c_health', 'b2c_relationships', 'b2c_wealth', 'mixed_wealth', 'b2b_services');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add new columns to offers table
ALTER TABLE "offers"
  ADD COLUMN IF NOT EXISTS "core_offer_price" text,
  ADD COLUMN IF NOT EXISTS "customer_stage" customer_stage,
  ADD COLUMN IF NOT EXISTS "core_problems" text,
  ADD COLUMN IF NOT EXISTS "desired_outcome" text,
  ADD COLUMN IF NOT EXISTS "tangible_outcomes" text,
  ADD COLUMN IF NOT EXISTS "emotional_outcomes" text,
  ADD COLUMN IF NOT EXISTS "deliverables" text,
  ADD COLUMN IF NOT EXISTS "time_per_week" text,
  ADD COLUMN IF NOT EXISTS "estimated_time_to_results" text,
  ADD COLUMN IF NOT EXISTS "case_study_strength" case_study_strength,
  ADD COLUMN IF NOT EXISTS "guarantees_refund_terms" text,
  ADD COLUMN IF NOT EXISTS "primary_funnel_source" primary_funnel_source,
  ADD COLUMN IF NOT EXISTS "funnel_context_additional" text;

-- Migrate priceRange to coreOfferPrice if priceRange exists and coreOfferPrice is null
-- This is a data migration - copy first value from priceRange if it's a range
UPDATE "offers"
SET "core_offer_price" = CASE 
  WHEN "price_range" LIKE '%-%' THEN SPLIT_PART("price_range", '-', 1)
  ELSE "price_range"
END
WHERE "core_offer_price" IS NULL AND "price_range" IS NOT NULL;

-- Note: We keep priceRange for backward compatibility during transition
-- The application should use coreOfferPrice going forward
