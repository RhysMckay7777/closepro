ALTER TYPE "public"."call_result" ADD VALUE 'payment_plan';--> statement-breakpoint
ALTER TYPE "public"."call_result" ADD VALUE 'follow_up_result';--> statement-breakpoint
ALTER TYPE "public"."call_type" ADD VALUE 'roleplay';--> statement-breakpoint
CREATE TABLE "training_transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"title" text NOT NULL,
	"raw_transcript" text NOT NULL,
	"extracted_patterns" text,
	"tags" text,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"word_count" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "call_analysis" ADD COLUMN "objection_present" boolean;--> statement-breakpoint
ALTER TABLE "call_analysis" ADD COLUMN "objection_resolved" boolean;--> statement-breakpoint
ALTER TABLE "call_analysis" ADD COLUMN "outcome_diagnostic" text;--> statement-breakpoint
ALTER TABLE "call_analysis" ADD COLUMN "category_feedback" text;--> statement-breakpoint
ALTER TABLE "call_analysis" ADD COLUMN "moment_coaching" text;--> statement-breakpoint
ALTER TABLE "call_analysis" ADD COLUMN "priority_fixes" text;--> statement-breakpoint
ALTER TABLE "call_analysis" ADD COLUMN "phase_scores" text;--> statement-breakpoint
ALTER TABLE "call_analysis" ADD COLUMN "phase_analysis" text;--> statement-breakpoint
ALTER TABLE "call_analysis" ADD COLUMN "outcome_diagnostic_p1" text;--> statement-breakpoint
ALTER TABLE "call_analysis" ADD COLUMN "outcome_diagnostic_p2" text;--> statement-breakpoint
ALTER TABLE "call_analysis" ADD COLUMN "closer_effectiveness" text;--> statement-breakpoint
ALTER TABLE "call_analysis" ADD COLUMN "prospect_difficulty_justifications" text;--> statement-breakpoint
ALTER TABLE "call_analysis" ADD COLUMN "action_points" text;--> statement-breakpoint
ALTER TABLE "payment_plan_instalments" ADD COLUMN "instalment_number" integer;--> statement-breakpoint
ALTER TABLE "payment_plan_instalments" ADD COLUMN "status" text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "payment_plan_instalments" ADD COLUMN "collected_date" timestamp;--> statement-breakpoint
ALTER TABLE "roleplay_analysis" ADD COLUMN "phase_scores" text;--> statement-breakpoint
ALTER TABLE "roleplay_analysis" ADD COLUMN "phase_analysis" text;--> statement-breakpoint
ALTER TABLE "roleplay_analysis" ADD COLUMN "outcome_diagnostic_p1" text;--> statement-breakpoint
ALTER TABLE "roleplay_analysis" ADD COLUMN "outcome_diagnostic_p2" text;--> statement-breakpoint
ALTER TABLE "roleplay_analysis" ADD COLUMN "closer_effectiveness" text;--> statement-breakpoint
ALTER TABLE "roleplay_analysis" ADD COLUMN "prospect_difficulty_justifications" text;--> statement-breakpoint
ALTER TABLE "roleplay_analysis" ADD COLUMN "action_points" text;--> statement-breakpoint
ALTER TABLE "roleplay_analysis" ADD COLUMN "roleplay_feedback" text;--> statement-breakpoint
ALTER TABLE "roleplay_sessions" ADD COLUMN "replay_phase" text;--> statement-breakpoint
ALTER TABLE "roleplay_sessions" ADD COLUMN "replay_source_call_id" text;--> statement-breakpoint
ALTER TABLE "roleplay_sessions" ADD COLUMN "replay_source_session_id" text;--> statement-breakpoint
ALTER TABLE "roleplay_sessions" ADD COLUMN "replay_context" text;--> statement-breakpoint
ALTER TABLE "sales_calls" ADD COLUMN "reason_tag" text;--> statement-breakpoint
ALTER TABLE "sales_calls" ADD COLUMN "add_to_sales_figures" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_calls" ADD COLUMN "extracted_details" text;--> statement-breakpoint
ALTER TABLE "training_transcripts" ADD CONSTRAINT "training_transcripts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_transcripts" ADD CONSTRAINT "training_transcripts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;