/**
 * Skill Clusters — Connor's Sales Philosophy Framework v2.1
 * Maps the 10 scoring categories into 6 strategic skill clusters.
 * Used on the dashboard/performance page for aggregated display.
 *
 * Every existing scoring category maps to exactly one cluster.
 */

import type { ScoringCategoryId } from './scoring-categories';

export interface SkillCluster {
  id: string;
  name: string;
  description: string;
  icon: string;
  sourceCategories: ScoringCategoryId[];
}

export const SKILL_CLUSTERS: SkillCluster[] = [
  {
    id: 'authority_leadership',
    name: 'Authority & Leadership',
    description: 'Frame control, confidence, challenging prospects, maintaining expert position throughout the call',
    icon: 'Shield',
    sourceCategories: ['authority', 'structure'],
  },
  {
    id: 'discovery_gap_creation',
    name: 'Discovery & Gap Creation',
    description: 'Questioning depth, uncovering pain, goal setting, getting prospects to self-diagnose their problems',
    icon: 'Search',
    sourceCategories: ['discovery', 'gap'],
  },
  {
    id: 'value_stabilization',
    name: 'Value Stabilization',
    description: 'Pitch effectiveness, social proof usage, program presentation, building perceived value before price reveal',
    icon: 'TrendingUp',
    sourceCategories: ['value', 'communication'],
  },
  {
    id: 'objection_control',
    name: 'Objection Control',
    description: "Staying calm, using prospect's own words, logical workarounds, deposit strategy, never arguing",
    icon: 'ShieldCheck',
    sourceCategories: ['objection_handling'],
  },
  {
    id: 'closing_decision_leadership',
    name: 'Closing & Decision Leadership',
    description: 'Trial close, assumptive close, urgency creation, deposit taking, handling silence, leading to action',
    icon: 'Target',
    sourceCategories: ['closing'],
  },
  {
    id: 'emotional_intelligence',
    name: 'Emotional Intelligence & Adaptation',
    description: 'Reading prospect type (advisee/peer/advisor), adapting tone, managing fight/flight reactions, staying calm under pressure',
    icon: 'Heart',
    sourceCategories: ['trust', 'adaptation'],
  },
] as const;

export type SkillClusterId = typeof SKILL_CLUSTERS[number]['id'];

/**
 * Get the cluster a category belongs to.
 */
export function getClusterForCategory(categoryId: ScoringCategoryId): SkillCluster | undefined {
  return SKILL_CLUSTERS.find(c => c.sourceCategories.includes(categoryId));
}

/**
 * Compute cluster scores from individual category scores.
 * Each cluster score = average of its source category scores.
 */
export function computeClusterScores(
  categoryScores: Partial<Record<string, number>>
): Array<{ cluster: SkillCluster; score: number; categoryBreakdown: Array<{ id: string; score: number }> }> {
  return SKILL_CLUSTERS.map(cluster => {
    const breakdown: Array<{ id: string; score: number }> = [];
    let total = 0;
    let count = 0;

    for (const catId of cluster.sourceCategories) {
      const score = categoryScores[catId];
      if (typeof score === 'number' && score > 0) {
        breakdown.push({ id: catId, score });
        total += score;
        count++;
      }
    }

    return {
      cluster,
      score: count > 0 ? Math.round(total / count) : 0,
      categoryBreakdown: breakdown,
    };
  });
}
