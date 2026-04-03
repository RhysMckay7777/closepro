ALTER TYPE "public"."plan_tier" ADD VALUE 'rep';--> statement-breakpoint
ALTER TYPE "public"."plan_tier" ADD VALUE 'manager';--> statement-breakpoint
CREATE TABLE "pending_checkouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"checkout_token" text NOT NULL,
	"plan_tier" "plan_tier" NOT NULL,
	"coupon_code" text,
	"email" text,
	"whop_subscription_id" text,
	"whop_customer_id" text,
	"whop_plan_id" text,
	"subscription_data" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"claimed_by_org_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pending_checkouts_checkout_token_unique" UNIQUE("checkout_token")
);
--> statement-breakpoint
ALTER TABLE "billing_history" ADD COLUMN "stripe_event_id" text;--> statement-breakpoint
ALTER TABLE "prospect_avatars" ADD COLUMN "gender" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "stripe_price_id" text;--> statement-breakpoint
ALTER TABLE "pending_checkouts" ADD CONSTRAINT "pending_checkouts_claimed_by_org_id_organizations_id_fk" FOREIGN KEY ("claimed_by_org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_history" ADD CONSTRAINT "billing_history_stripe_event_id_unique" UNIQUE("stripe_event_id");--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id");