'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SKILL_CLUSTERS, computeClusterScores } from '@/lib/training/skill-clusters';

export interface PerformanceSummaryProps {
  /** Skill categories from the API (10 categories with averageScore 0-100) */
  skillCategories: Array<{
    category: string;
    averageScore: number;
    trend?: number;
    actionPoints?: string[];
  }>;
  /** AI-generated insight paragraph */
  aiInsight?: string;
  /** Weekly summary from API */
  weeklySummary?: { overview: string; skillTrends: string; actionPlan: string[] };
  /** Monthly summary from API */
  monthlySummary?: { overview: string; skillTrends: string; actionPlan: string[] };
}

/** Map display category names to category IDs */
const NAME_TO_ID: Record<string, string> = {
  'Authority': 'authority',
  'Structure': 'structure',
  'Communication': 'communication',
  'Discovery': 'discovery',
  'Gap': 'gap',
  'Value': 'value',
  'Trust': 'trust',
  'Adaptation': 'adaptation',
  'Objection Handling': 'objection_handling',
  'Closing': 'closing',
};

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

export function PerformanceSummary({
  skillCategories,
  aiInsight,
  weeklySummary,
  monthlySummary,
}: PerformanceSummaryProps) {
  if (skillCategories.length === 0) return null;

  // Build category scores map (name → score)
  const catScores: Record<string, number> = {};
  for (const cat of skillCategories) {
    const id = NAME_TO_ID[cat.category] || cat.category.toLowerCase().replace(/\s+/g, '_');
    catScores[id] = cat.averageScore;
  }

  // Compute cluster scores
  const clusterScores = computeClusterScores(catScores);
  const sorted = [...clusterScores].sort((a, b) => a.score - b.score);
  const primaryFocus = sorted.find(c => c.score > 0);
  const secondaryFocus = sorted.length > 1 ? sorted.find((c, i) => i > 0 && c.score > 0) : null;

  // Collect top action points across all categories
  const allActions: string[] = [];
  for (const cat of skillCategories) {
    if (cat.actionPoints) {
      allActions.push(...cat.actionPoints);
    }
  }
  const topPriorities = allActions.slice(0, 3);

  // Get summary source (prefer weekly, fall back to monthly)
  const summary = weeklySummary || monthlySummary;

  return (
    <Card className="border border-primary/20 bg-linear-to-br from-primary/5 to-card/40 backdrop-blur-xl shadow-xl">
      <CardHeader>
        <CardTitle>Performance Summary & Coaching</CardTitle>
        <CardDescription>Your priorities, focus areas, and what to train next</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* A. Top Priorities */}
        {topPriorities.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3">Top Priorities</h4>
            <ol className="space-y-2">
              {topPriorities.map((action, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground leading-relaxed">{action}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* B. What Skill to Focus On */}
        {primaryFocus && primaryFocus.score > 0 && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
            <h4 className="text-sm font-semibold">Skill Focus</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-red-400">Primary</span>
                  <span className="text-sm font-medium">{primaryFocus.cluster.name}</span>
                </div>
                <span className={`text-lg font-bold ${getScoreColor(primaryFocus.score)}`}>
                  {primaryFocus.score}/100
                </span>
              </div>
              {secondaryFocus && secondaryFocus.score > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Secondary</span>
                    <span className="text-sm font-medium">{secondaryFocus.cluster.name}</span>
                  </div>
                  <span className={`text-lg font-bold ${getScoreColor(secondaryFocus.score)}`}>
                    {secondaryFocus.score}/100
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* C. What to Train Next — from action plan */}
        {summary?.actionPlan && summary.actionPlan.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">What to Train Next</h4>
            <ul className="space-y-1.5">
              {summary.actionPlan.map((item, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-0.5">→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* D. Direct Coaching Statement */}
        {aiInsight && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <h4 className="text-sm font-semibold text-primary mb-2">Coaching Insight</h4>
            <p className="text-sm text-muted-foreground leading-relaxed italic">
              &ldquo;{aiInsight}&rdquo;
            </p>
          </div>
        )}

        {/* Overview from summary */}
        {summary?.overview && !aiInsight && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <h4 className="text-sm font-semibold mb-2">Overview</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">{summary.overview}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
