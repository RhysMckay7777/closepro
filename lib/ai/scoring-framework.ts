/**
 * Sales Call Scoring – 10 Category Framework
 * Shared across call analysis, roleplay scoring, and performance reporting.
 * Reference: Knowledge Doc – Sales Call Scoring Framework
 */

/** The 10 agreed sales categories (each scored 0–10; total out of 100) */
export const SALES_CATEGORIES = [
  { id: 'authority_leadership', label: 'Authority & Leadership' },
  { id: 'structure_framework', label: 'Structure & Framework' },
  { id: 'communication_storytelling', label: 'Communication & Storytelling' },
  { id: 'discovery_diagnosis', label: 'Discovery Depth & Diagnosis' },
  { id: 'gap_urgency', label: 'Gap & Urgency' },
  { id: 'value_offer_positioning', label: 'Value & Offer Positioning' },
  { id: 'trust_safety_ethics', label: 'Trust, Safety & Ethics' },
  { id: 'adaptation_calibration', label: 'Adaptation & Calibration' },
  { id: 'objection_handling', label: 'Objection Handling & Preemption' },
  { id: 'closing_commitment', label: 'Closing & Commitment Integrity' },
] as const;

export type SalesCategoryId = (typeof SALES_CATEGORIES)[number]['id'];

/** Pillars used only for objection classification (not primary scores) */
export const OBJECTION_PILLARS = [
  { id: 'value', label: 'Value' },
  { id: 'trust', label: 'Trust' },
  { id: 'fit', label: 'Fit' },
  { id: 'logistics', label: 'Logistics' },
] as const;

export type ObjectionPillarId = (typeof OBJECTION_PILLARS)[number]['id'];

/** Prospect difficulty tiers (aligned with 50-point model) */
export const DIFFICULTY_TIERS = [
  'easy',           // 42–50
  'realistic',      // 36–41
  'hard',           // 30–35
  'elite',          // 25–29
  'near_impossible', // <25
] as const;

export type DifficultyTier = (typeof DIFFICULTY_TIERS)[number];

/** Display labels for difficulty tiers */
export const DIFFICULTY_TIER_LABELS: Record<DifficultyTier, string> = {
  easy: 'Easy',
  realistic: 'Realistic',
  hard: 'Hard',
  elite: 'Elite',
  near_impossible: 'Near Impossible',
};

/** Get category label by id */
export function getCategoryLabel(id: string): string {
  const c = SALES_CATEGORIES.find((x) => x.id === id);
  return c?.label ?? id;
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
