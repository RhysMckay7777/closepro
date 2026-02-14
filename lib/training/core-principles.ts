/**
 * Core Sales Principles — Connor's Sales Philosophy Framework
 * Maps the 10 scoring categories into 9 core principles.
 * Used on the dashboard/performance page for principle-based insights.
 */

export interface CorePrinciple {
  id: string;
  name: string;
  description: string;
  relatedCategories: string[]; // Maps to the 10 scoring categories from analysis
}

export const CORE_PRINCIPLES: CorePrinciple[] = [
  {
    id: 'authority',
    name: 'Authority',
    description: 'Positional, conversational, and structural authority — leading the call, not following',
    relatedCategories: ['authority'],
  },
  {
    id: 'structure',
    name: 'Structure',
    description: 'Clear intro, focused discovery, logical pitch transition, controlled close, defined next steps',
    relatedCategories: ['structure'],
  },
  {
    id: 'communication_listening',
    name: 'Communication & Listening',
    description: 'Deep listening, emotional cues, referencing prospect words, strategic silence, layered follow-ups',
    relatedCategories: ['communication'],
  },
  {
    id: 'gap_creation',
    name: 'Gap Creation',
    description: 'Creating distance between current state and desired state, quantifying cost of inaction',
    relatedCategories: ['gap', 'discovery'],
  },
  {
    id: 'value_positioning',
    name: 'Value Positioning',
    description: 'Anchoring value to pain, personalizing the pitch, structuring clearly, avoiding feature dumps',
    relatedCategories: ['value'],
  },
  {
    id: 'trust_building',
    name: 'Trust Building',
    description: 'Clarity, calmness, truth-telling, not overselling, acknowledging concerns properly',
    relatedCategories: ['trust'],
  },
  {
    id: 'adaptability',
    name: 'Adaptability',
    description: 'Adjusting tone, pace, depth, energy, and question style based on prospect personality and context',
    relatedCategories: ['adaptation'],
  },
  {
    id: 'objection_strategy',
    name: 'Objection Strategy',
    description: 'Pre-handling predictable objections, handling at belief level, maintaining authority under resistance',
    relatedCategories: ['objection_handling'],
  },
  {
    id: 'decision_leadership',
    name: 'Decision Leadership',
    description: 'Assumptive language, clear investment framing, controlled silence, direct next-step clarity',
    relatedCategories: ['closing'],
  },
];

// Maps scoring category IDs to principle IDs
export function getPrincipleForCategory(categoryId: string): string | null {
  for (const p of CORE_PRINCIPLES) {
    if (p.relatedCategories.includes(categoryId)) return p.id;
  }
  return null;
}

// Compute principle scores from category scores
export interface PrincipleScore {
  principle: CorePrinciple;
  score: number;
  categoryBreakdown: { id: string; score: number }[];
}

export function computePrincipleScores(
  catScores: Record<string, number>
): PrincipleScore[] {
  return CORE_PRINCIPLES.map((p) => {
    const breakdown = p.relatedCategories
      .filter((c) => catScores[c] !== undefined)
      .map((c) => ({ id: c, score: catScores[c] }));
    const avg = breakdown.length > 0
      ? Math.round(breakdown.reduce((sum, b) => sum + b.score, 0) / breakdown.length)
      : 0;
    return { principle: p, score: avg, categoryBreakdown: breakdown };
  });
}
