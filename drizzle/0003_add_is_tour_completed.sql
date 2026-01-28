-- Add is_tour_completed to users for product tour state
ALTER TABLE "users" ADD COLUMN "is_tour_completed" boolean NOT NULL DEFAULT false;
