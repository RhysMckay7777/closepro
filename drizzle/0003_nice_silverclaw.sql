ALTER TABLE "roleplay_analysis" ADD COLUMN "is_incomplete" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "roleplay_analysis" ADD COLUMN "stages_completed" text;--> statement-breakpoint
ALTER TABLE "roleplay_analysis" ADD COLUMN "category_feedback" text;--> statement-breakpoint
ALTER TABLE "roleplay_analysis" ADD COLUMN "priority_fixes" text;--> statement-breakpoint
ALTER TABLE "roleplay_analysis" ADD COLUMN "objection_analysis" text;