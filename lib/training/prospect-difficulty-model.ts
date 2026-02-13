/**
 * Prospect Difficulty Model — Connor's Framework
 * Single source of truth for prospect difficulty scoring.
 * Used by call analysis, roleplay scoring, and roleplay prospect behavior.
 *
 * v1: 6 dimensions, higher score = easier (42-50=Easy, 0-29=Expert)
 * v2: 5 dimensions, higher score = easier (41-50=Easy, <20=Near Impossible)
 */

// ═══════════════════════════════════════════════════════════
// V2.0 — Phase-based analysis model (5 dimensions, higher = easier)
// ═══════════════════════════════════════════════════════════

export const V2_DIFFICULTY_DIMENSIONS = [
  'icpAlignment',
  'motivationIntensity',
  'funnelContext',
  'authorityAndCoachability',
  'abilityToProceed',
] as const;

export type V2DifficultyDimension = (typeof V2_DIFFICULTY_DIMENSIONS)[number];

export const V2_DIFFICULTY_DIMENSION_LABELS: Record<V2DifficultyDimension, string> = {
  icpAlignment: 'ICP Alignment',
  motivationIntensity: 'Motivation Intensity',
  funnelContext: 'Funnel Context',
  authorityAndCoachability: 'Prospect Authority & Coachability',
  abilityToProceed: 'Ability to Proceed',
};

export const PROSPECT_DIFFICULTY_MODEL_V2 = `
PROSPECT DIFFICULTY MODEL v2.0 (50-Point Scoring System)
IMPORTANT: Higher score = EASIER prospect (more favorable conditions).

Each prospect is scored across 5 dimensions (each 0-10). Total = sum of all 5 (0-50).

DIMENSION 1: ICP Alignment (0-10)
How closely the prospect's situation and problems match what the offer solves.
- 9-10: Very High — clear ICP match, problems exactly what offer solves
- 7-8: Good — strong fit but missing one element
- 4-6: Moderate — partial match, needs reframing
- 1-3: Low — weak fit, conceptual mismatch
- 0: None — completely wrong market

DIMENSION 2: Motivation Intensity (0-10)
How emotionally and logically driven the prospect is to change (pain + ambition).
- 9-10: Very High — strong pain AND/OR ambition, clear urgency
- 7-8: Strong — one strong driver, one moderate
- 4-6: Moderate — wants change but not urgent
- 1-3: Low — passive, "just exploring"
- 0: Indifferent

DIMENSION 3: Funnel Context (0-10)
How warm the prospect is before the call begins.
- 9-10: Hot — referral/repeat buyer, followed content, seen proof, strong baseline trust
- 6-8: Warm — familiar with brand, consumed some content, moderate trust
- 3-5: Cold — came from cold ads, limited proof exposure, needs trust-building
- 0-2: Ice Cold — outbound/minimal awareness, strong early trust resistance

DIMENSION 4: Prospect Authority & Coachability (0-10)
How the prospect sees themselves relative to the closer and openness to help.
- 8-10: Advisee/Coachable — open, shares freely, respects expertise
- 5-7: Peer/Balanced — neutral authority, slight skepticism
- 2-4: High Authority/Guarded — tests closer, challenges framing
- 0-1: Advisor/Resistant — attempts to control, believes they know better

DIMENSION 5: Ability to Proceed (0-10)
Whether the prospect has practical ability to act (money, time, authority).
- 9-10: Fully Able — has money, time, can decide independently
- 6-8: Mostly Able — minor restructuring needed, payment plan possible
- 3-5: Restricted — tight financially, limited time, needs partner sign-off
- 0-2: Severe Resistance — no funds, no time, external dependency

DIFFICULTY BANDS (higher = easier):
  41–50 = Easy (green)
  32–40 = Realistic (amber)
  26–31 = Hard (orange)
  20–25 = Expert (red)
  Below 20 = Near Impossible (red)

KEY PRINCIPLES:
1. Score each dimension INDEPENDENTLY based on transcript evidence
2. Provide a 2-4 sentence justification for EACH dimension score
3. Higher total = easier prospect — harder prospects deserve more credit for good performance
4. Difficulty reflects starting conditions — not outcome
5. Do NOT inflate difficulty to excuse poor sales or lower difficulty to punish closers
`;

export const V2_DIFFICULTY_BANDS = {
  EASY: { min: 41, max: 50, label: 'Easy', color: 'green' },
  REALISTIC: { min: 32, max: 40, label: 'Realistic', color: 'amber' },
  HARD: { min: 26, max: 31, label: 'Hard', color: 'orange' },
  EXPERT: { min: 20, max: 25, label: 'Expert', color: 'red' },
  NEAR_IMPOSSIBLE: { min: 0, max: 19, label: 'Near Impossible', color: 'red' },
} as const;

export type V2DifficultyBandKey = keyof typeof V2_DIFFICULTY_BANDS;

export function getDifficultyBandV2(score: number): (typeof V2_DIFFICULTY_BANDS)[V2DifficultyBandKey] {
  if (score >= 41) return V2_DIFFICULTY_BANDS.EASY;
  if (score >= 32) return V2_DIFFICULTY_BANDS.REALISTIC;
  if (score >= 26) return V2_DIFFICULTY_BANDS.HARD;
  if (score >= 20) return V2_DIFFICULTY_BANDS.EXPERT;
  return V2_DIFFICULTY_BANDS.NEAR_IMPOSSIBLE;
}

// ═══════════════════════════════════════════════════════════
// V1 — Legacy model (6 dimensions, higher = easier) — kept for backward compat
// ═══════════════════════════════════════════════════════════

export const PROSPECT_DIFFICULTY_MODEL = `
PROSPECT DIFFICULTY MODEL (50-Point Scoring System)

Each prospect is scored across 6 dimensions (each 0-10, except Authority which is a tier).
The total difficulty score determines how hard the prospect is to close.

DIMENSION 1: Position-Problem Alignment (0-10)
How well does the prospect's position/role align with the problem the offer solves?
- 8-10: Perfect fit — they're the exact target avatar
- 5-7: Good fit — some alignment, may need framing
- 3-4: Partial fit — they see some relevance
- 0-2: Poor fit — they don't see how this applies to them

DIMENSION 2: Pain / Ambition Intensity (0-10)
How strong is the prospect's pain or desire to change?
- 8-10: Urgent, visceral pain or burning ambition
- 5-7: Moderate discomfort or aspiration
- 3-4: Mild awareness of gap
- 0-2: Content with status quo

DIMENSION 3: Perceived Need for Help (0-10)
Does the prospect believe they need external help to solve this?
- 8-10: "I can't do this alone, I need help"
- 5-7: "Maybe someone could help me get there faster"
- 3-4: "I think I can figure it out myself"
- 0-2: "I don't need anyone's help"

DIMENSION 4: Authority Level (Tier-based)
How the prospect views themselves relative to the closer:
- Advisee: Looks up to closer, defers, long emotional answers, high disclosure
- Peer: Sees closer as equal, reserved, requires proof and data, moderate objections
- Advisor: Sees themselves above closer, uses teaching language, interrupts, challenges, highly logical

DIMENSION 5: Funnel Context (0-10)
How warm the prospect is before the call:
- 9-10: Referral — transferred trust, warm relationship
- 7-8: Content-educated — watched videos, consumed content, self-convinced
- 4-6: Warm inbound — applied/registered, expressed interest
- 0-3: Cold outbound — skeptical, didn't ask for the call

DIMENSION 6: Execution Resistance (0-10)
Prospect's practical ability to proceed (money, time, authority):
- 8-10: Fully able — has resources and decision authority
- 5-7: Partial ability — may need payment plans or to discuss with others
- 1-4: Extreme resistance — severe constraints, very difficult to close on-call

SCORING TOTALS:
- Easy: 42-50 (multiple favorable dimensions, low resistance)
- Realistic: 36-41 (balanced, some friction points)
- Hard: 30-35 (significant challenges in multiple areas)
- Expert: 0-29 (challenging in most dimensions)

KEY PRINCIPLES:
1. Difficulty score is FIXED at session start — it does not change mid-call
2. BEHAVIOR can change based on closer skill (trust/value building)
3. Execution resistance is reported separately — it increases difficulty but does not excuse poor sales skill
4. Even easy prospects say "I need to think about it" if value isn't built
5. Expert prospects CAN close with exceptional execution
`;

export const DIFFICULTY_BANDS = {
    EASY: { min: 42, max: 50, label: 'Easy' },
    REALISTIC: { min: 36, max: 41, label: 'Realistic' },
    HARD: { min: 30, max: 35, label: 'Hard' },
    EXPERT: { min: 0, max: 29, label: 'Expert' },
} as const;

export function getDifficultyBand(score: number) {
    if (score >= 42) return DIFFICULTY_BANDS.EASY;
    if (score >= 36) return DIFFICULTY_BANDS.REALISTIC;
    if (score >= 30) return DIFFICULTY_BANDS.HARD;
    return DIFFICULTY_BANDS.EXPERT;
}
