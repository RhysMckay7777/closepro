/**
 * Prospect Difficulty Model — Connor's Framework (Document #2)
 * Single source of truth for prospect difficulty scoring.
 * Used by call analysis, roleplay scoring, and roleplay prospect behavior.
 */

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
- Elite: 25-29 (challenging in most dimensions)
- Near Impossible: 0-24 (hostile on nearly every dimension)

KEY PRINCIPLES:
1. Difficulty score is FIXED at session start — it does not change mid-call
2. BEHAVIOR can change based on closer skill (trust/value building)
3. Execution resistance is reported separately — it increases difficulty but does not excuse poor sales skill
4. Even easy prospects say "I need to think about it" if value isn't built
5. Near-impossible prospects CAN close with exceptional execution
`;

export const DIFFICULTY_BANDS = {
    EASY: { min: 42, max: 50, label: 'Easy' },
    REALISTIC: { min: 36, max: 41, label: 'Realistic' },
    HARD: { min: 30, max: 35, label: 'Hard' },
    ELITE: { min: 25, max: 29, label: 'Elite' },
    NEAR_IMPOSSIBLE: { min: 0, max: 24, label: 'Near Impossible' },
} as const;

export function getDifficultyBand(score: number) {
    if (score >= 42) return DIFFICULTY_BANDS.EASY;
    if (score >= 36) return DIFFICULTY_BANDS.REALISTIC;
    if (score >= 30) return DIFFICULTY_BANDS.HARD;
    if (score >= 25) return DIFFICULTY_BANDS.ELITE;
    return DIFFICULTY_BANDS.NEAR_IMPOSSIBLE;
}
