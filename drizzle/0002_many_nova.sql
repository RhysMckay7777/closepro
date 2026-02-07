CREATE TYPE "public"."call_result" AS ENUM('no_show', 'closed', 'lost', 'unqualified', 'follow_up', 'deposit');--> statement-breakpoint
CREATE TYPE "public"."call_type" AS ENUM('closing_call', 'follow_up', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."case_study_strength" AS ENUM('none', 'weak', 'moderate', 'strong');--> statement-breakpoint
CREATE TYPE "public"."customer_stage" AS ENUM('aspiring', 'current', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."offer_category" AS ENUM('b2c_health', 'b2c_relationships', 'b2c_wealth', 'mixed_wealth', 'b2b_services');--> statement-breakpoint
CREATE TYPE "public"."primary_funnel_source" AS ENUM('cold_outbound', 'cold_ads', 'warm_inbound', 'content_driven_inbound', 'referral', 'existing_customer');--> statement-breakpoint
CREATE TABLE "payment_plan_instalments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_call_id" uuid NOT NULL,
	"due_date" timestamp NOT NULL,
	"amount_cents" integer NOT NULL,
	"commission_rate_pct" integer,
	"commission_amount_cents" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "offers" ALTER COLUMN "offer_category" SET DATA TYPE offer_category;--> statement-breakpoint
ALTER TABLE "offers" ALTER COLUMN "price_range" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "call_analysis" ADD COLUMN "objection_details" text;--> statement-breakpoint
ALTER TABLE "call_analysis" ADD COLUMN "prospect_difficulty" integer;--> statement-breakpoint
ALTER TABLE "call_analysis" ADD COLUMN "prospect_difficulty_tier" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "core_offer_price" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "customer_stage" "customer_stage";--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "core_problems" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "desired_outcome" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "tangible_outcomes" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "emotional_outcomes" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "deliverables" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "time_per_week" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "estimated_time_to_results" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "case_study_strength" "case_study_strength";--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "guarantees_refund_terms" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "primary_funnel_source" "primary_funnel_source";--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "funnel_context_additional" text;--> statement-breakpoint
ALTER TABLE "prospect_avatars" ADD COLUMN "offer_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "prospect_avatars" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "prospect_avatars" ADD COLUMN "voice_style" text;--> statement-breakpoint
ALTER TABLE "roleplay_analysis" ADD COLUMN "prospect_difficulty" integer;--> statement-breakpoint
ALTER TABLE "roleplay_analysis" ADD COLUMN "prospect_difficulty_tier" text;--> statement-breakpoint
ALTER TABLE "sales_calls" ADD COLUMN "offer_id" uuid;--> statement-breakpoint
ALTER TABLE "sales_calls" ADD COLUMN "offer_type" "offer_category";--> statement-breakpoint
ALTER TABLE "sales_calls" ADD COLUMN "call_type" "call_type";--> statement-breakpoint
ALTER TABLE "sales_calls" ADD COLUMN "result" "call_result";--> statement-breakpoint
ALTER TABLE "sales_calls" ADD COLUMN "qualified" boolean;--> statement-breakpoint
ALTER TABLE "sales_calls" ADD COLUMN "cash_collected" integer;--> statement-breakpoint
ALTER TABLE "sales_calls" ADD COLUMN "revenue_generated" integer;--> statement-breakpoint
ALTER TABLE "sales_calls" ADD COLUMN "deposit_taken" boolean;--> statement-breakpoint
ALTER TABLE "sales_calls" ADD COLUMN "reason_for_outcome" text;--> statement-breakpoint
ALTER TABLE "sales_calls" ADD COLUMN "analysis_intent" text;--> statement-breakpoint
ALTER TABLE "sales_calls" ADD COLUMN "was_confirmed" boolean;--> statement-breakpoint
ALTER TABLE "sales_calls" ADD COLUMN "booking_source" text;--> statement-breakpoint
ALTER TABLE "sales_calls" ADD COLUMN "original_call_id" uuid;--> statement-breakpoint
ALTER TABLE "sales_calls" ADD COLUMN "call_date" timestamp;--> statement-breakpoint
ALTER TABLE "sales_calls" ADD COLUMN "prospect_name" text;--> statement-breakpoint
ALTER TABLE "sales_calls" ADD COLUMN "commission_rate_pct" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_tour_completed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "commission_rate_pct" integer;--> statement-breakpoint
ALTER TABLE "payment_plan_instalments" ADD CONSTRAINT "payment_plan_instalments_sales_call_id_sales_calls_id_fk" FOREIGN KEY ("sales_call_id") REFERENCES "public"."sales_calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_avatars" ADD CONSTRAINT "prospect_avatars_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_calls" ADD CONSTRAINT "sales_calls_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_calls" ADD CONSTRAINT "sales_calls_original_call_id_sales_calls_id_fk" FOREIGN KEY ("original_call_id") REFERENCES "public"."sales_calls"("id") ON DELETE set null ON UPDATE no action;