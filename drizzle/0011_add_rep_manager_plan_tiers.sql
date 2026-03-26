-- Add new plan tier enum values for the Rep/Manager pricing restructure
ALTER TYPE plan_tier ADD VALUE IF NOT EXISTS 'rep';
ALTER TYPE plan_tier ADD VALUE IF NOT EXISTS 'manager';
