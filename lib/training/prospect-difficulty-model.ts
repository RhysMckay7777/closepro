/**
 * Prospect Difficulty Model — Connor's Framework
 * Single source of truth for prospect difficulty scoring.
 * Used by call analysis, roleplay scoring, and roleplay prospect behavior.
 *
 * v1: 6 dimensions, higher score = easier (42-50=Easy, 0-29=Expert)
 * v2: 5 dimensions, higher score = harder (0-20=Easy, 46-50=Expert)
 */

// ═══════════════════════════════════════════════════════════
// V2.0 — Phase-based analysis model (5 dimensions, higher = harder)
// ═══════════════════════════════════════════════════════════

export const V2_DIFFICULTY_DIMENSIONS = [
  'icpAlignment',
  'painAndAmbition',
  'funnelWarmth',
  'authorityAndCoachability',
  'executionResistance',
] as const;

export type V2DifficultyDimension = (typeof V2_DIFFICULTY_DIMENSIONS)[number];

export const V2_DIFFICULTY_DIMENSION_LABELS: Record<V2DifficultyDimension, string> = {
  icpAlignment: 'ICP Alignment',
  painAndAmbition: 'Pain & Ambition',
  funnelWarmth: 'Funnel Warmth',
  authorityAndCoachability: 'Authority & Coachability',
  executionResistance: 'Execution Resistance',
};

export const PROSPECT_DIFFICULTY_MODEL_V2 = `
PROSPECT DIFFICULTY MODEL v2.0 (50-Point Scoring System)
IMPORTANT: Higher score = HARDER prospect. This is the opposite of v1.

Each prospect is scored across 5 dimensions (each 0-10). Total = sum of all 5 (0-50).

DIMENSION 1: ICP Alignment (0-10)
How well does the prospect match the ideal customer profile?
- 0-2: Perfect fit — exact target avatar, ideal situation
- 3-4: Good fit — mostly aligned, minor gaps
- 5-7: Partial fit — some relevance but significant mismatch
- 8-10: Poor fit — doesn't match the ICP at all

DIMENSION 2: Pain & Ambition (0-10)
How motivated is the prospect to change?
- 0-2: Urgent pain or burning ambition, desperate to act
- 3-4: Strong desire, actively seeking solutions
- 5-7: Moderate awareness, not urgently motivated
- 8-10: Content with status quo, no perceived need

DIMENSION 3: Funnel Warmth (0-10)
How warm was the prospect before the call?
- 0-2: Hot — referral, deep content consumption, self-convinced
- 3-4: Warm — applied/registered, consumed some content
- 5-7: Lukewarm — showed mild interest, limited context
- 8-10: Cold — outbound, didn't ask for the call, skeptical

DIMENSION 4: Authority & Coachability (0-10)
How receptive and empowered is the prospect?
- 0-2: Coachable, decision-maker, defers to expert advice
- 3-4: Open-minded, mostly autonomous, some hesitancy
- 5-7: Guarded, needs convincing, shared decision-making
- 8-10: Combative, dismissive, no authority, or needs others to approve

DIMENSION 5: Execution Resistance (0-10)
Practical barriers to proceeding (money, time, logistics):
- 0-2: No barriers — has money, time, and authority to proceed
- 3-4: Minor friction — payment plans acceptable, small scheduling issues
- 5-7: Moderate barriers — needs to discuss with others, tight finances
- 8-10: Severe barriers — no money, no time, immovable blockers

DIFFICULTY BANDS (higher = harder):
  0–20  = Easy (green)
  21–35 = Realistic (amber)
  36–45 = Hard (orange)
  46–50 = Expert (red)

KEY PRINCIPLES:
1. Score each dimension INDEPENDENTLY based on transcript evidence
2. Provide a 2-4 sentence justification for EACH dimension score
3. Higher total = harder prospect — harder prospects deserve more credit for good performance
4. Even easy prospects say "I need to think about it" if value isn't built
5. Expert prospects CAN close with exceptional execution
`;

export const V2_DIFFICULTY_BANDS = {
  EASY: { min: 0, max: 20, label: 'Easy', color: 'green' },
  REALISTIC: { min: 21, max: 35, label: 'Realistic', color: 'amber' },
  HARD: { min: 36, max: 45, label: 'Hard', color: 'orange' },
  EXPERT: { min: 46, max: 50, label: 'Expert', color: 'red' },
} as const;

export type V2DifficultyBandKey = keyof typeof V2_DIFFICULTY_BANDS;

export function getDifficultyBandV2(score: number): (typeof V2_DIFFICULTY_BANDS)[V2DifficultyBandKey] {
  if (score >= 46) return V2_DIFFICULTY_BANDS.EXPERT;
  if (score >= 36) return V2_DIFFICULTY_BANDS.HARD;
  if (score >= 21) return V2_DIFFICULTY_BANDS.REALISTIC;
  return V2_DIFFICULTY_BANDS.EASY;
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
