/**
 * Sales Call Scoring – 10 Category Framework
 * Shared across call analysis, roleplay scoring, and performance reporting.
 *
 * CANONICAL SOURCE: lib/training/scoring-categories.ts
 * This file re-exports from the training framework for backward compatibility.
 */

import {
  SCORING_CATEGORIES as TRAINING_CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
  OBJECTION_PILLARS as TRAINING_PILLARS,
  OBJECTION_PILLAR_LABELS,
  getCategoryLabel as trainingGetCategoryLabel,
  type ScoringCategoryId,
  type ObjectionPillar,
} from '@/lib/training';

/** The 10 agreed sales categories (each scored 0–10; total out of 100) */
export const SALES_CATEGORIES = TRAINING_CATEGORIES.map(id => ({
  id,
  label: CATEGORY_LABELS[id],
}));

export type SalesCategoryId = ScoringCategoryId;

/** Pillars used only for objection classification (not primary scores) */
export const OBJECTION_PILLARS = TRAINING_PILLARS.map(id => ({
  id,
  label: OBJECTION_PILLAR_LABELS[id],
}));

export type ObjectionPillarId = ObjectionPillar;

/** Prospect difficulty tiers (aligned with 50-point model) */
export const DIFFICULTY_TIERS = [
  'easy',           // v1: 42–50, v2: 0–20
  'realistic',      // v1: 36–41, v2: 21–35
  'hard',           // v1: 30–35, v2: 36–45
  'expert',         // v1: 0–29,  v2: 46–50
] as const;

export type DifficultyTier = (typeof DIFFICULTY_TIERS)[number];

/** Display labels for difficulty tiers */
export const DIFFICULTY_TIER_LABELS: Record<DifficultyTier, string> = {
  easy: 'Easy',
  realistic: 'Realistic',
  hard: 'Hard',
  expert: 'Expert',
};

/** Get category label by id */
export function getCategoryLabel(id: string): string {
  return trainingGetCategoryLabel(id);
}

/** Get pillar label by id */
export function getPillarLabel(id: string): string {
  const p = OBJECTION_PILLARS.find((x) => x.id === id);
  return p?.label ?? id;
}

/** Get difficulty tier label */
export function getDifficultyTierLabel(tier: string): string {
  return DIFFICULTY_TIER_LABELS[tier as DifficultyTier] ?? tier;
}
