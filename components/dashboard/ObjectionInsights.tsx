'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface ObjectionData {
  text: string;
  count: number;
  pillar: string;
  rootCause?: string;
  preventionOpportunity?: string;
  handlingQuality?: number;
}

export interface PillarBreakdown {
  pillar: string;
  averageHandling: number;
  count: number;
}

export interface ObjectionInsightsProps {
  topObjections: ObjectionData[];
  pillarBreakdown: PillarBreakdown[];
  weakestArea: { pillar: string; averageHandling: number } | null;
  guidance: string;
  improvementActions?: Array<{ problem: string; whatToDoDifferently: string; whenToApply: string; whyItMatters: string }>;
}

const PILLAR_COLORS: Record<string, string> = {
  value: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  trust: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  fit: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  logistics: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const PILLAR_BAR_COLORS: Record<string, string> = {
  value: 'bg-purple-500',
  trust: 'bg-blue-500',
  fit: 'bg-orange-500',
  logistics: 'bg-gray-500',
};

/** Map known objection text to the 6 archetype categories */
const OBJECTION_TYPES: Record<string, string> = {
  'think about it': 'Logistics',
  'don\'t have the money': 'Logistics',
  'check with my partner': 'Logistics',
  'been burned before': 'Trust',
  'market saturated': 'Value',
  'explore other options': 'Value',
};

function getHandlingColor(score: number): string {
  if (score >= 7) return 'text-emerald-400';
  if (score >= 4) return 'text-amber-400';
  return 'text-red-400';
}

export function ObjectionInsights({
  topObjections,
  pillarBreakdown,
  weakestArea,
  guidance,
  improvementActions,
}: ObjectionInsightsProps) {
  if (!topObjections || topObjections.length === 0) return null;

  const totalObjections = topObjections.reduce((s, o) => s + o.count, 0);

  // Detect pre-emption gaps: objections with low handling quality and root causes
  const preEmptionGaps = topObjections.filter(
    o => o.preventionOpportunity && (o.handlingQuality == null || o.handlingQuality < 6)
  );

  return (
    <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
      <CardHeader>
        <CardTitle>Objection Handling Intelligence</CardTitle>
        <CardDescription>Deep analysis of objection patterns, handling quality, and pre-emption opportunities</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* A. Most Common Objection Types */}
        <div>
          <h4 className="text-sm font-semibold mb-3">Most Common Objections</h4>
          <div className="space-y-2">
            {topObjections.slice(0, 6).map((obj, i) => {
              const pct = totalObjections > 0 ? Math.round((obj.count / totalObjections) * 100) : 0;
              return (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium truncate">&ldquo;{obj.text}&rdquo;</p>
                      <Badge className={`text-xs flex-shrink-0 ${PILLAR_COLORS[obj.pillar] || PILLAR_COLORS.logistics}`}>
                        {obj.pillar?.charAt(0).toUpperCase() + obj.pillar?.slice(1)}
                      </Badge>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={PILLAR_BAR_COLORS[obj.pillar] || 'bg-gray-500'}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-muted-foreground">{obj.count}x ({pct}%)</span>
                    {obj.handlingQuality != null && (
                      <span className={`text-sm font-bold ${getHandlingColor(obj.handlingQuality)}`}>
                        {obj.handlingQuality}/10
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* B. Pillar Breakdown */}
        {pillarBreakdown.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3">Handling Quality by Pillar</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {pillarBreakdown.map(p => (
                <div key={p.pillar} className="rounded-lg border border-white/10 bg-white/5 p-3 text-center">
                  <Badge className={`text-xs mb-2 ${PILLAR_COLORS[p.pillar] || PILLAR_COLORS.logistics}`}>
                    {p.pillar.charAt(0).toUpperCase() + p.pillar.slice(1)}
                  </Badge>
                  <p className={`text-2xl font-bold ${getHandlingColor(p.averageHandling)}`}>
                    {p.averageHandling}<span className="text-sm font-normal text-muted-foreground">/10</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{p.count} objection{p.count !== 1 ? 's' : ''}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* C. Pre-emption Gaps */}
        {preEmptionGaps.length > 0 && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
            <h4 className="text-sm font-semibold text-amber-400 mb-2">Pre-emption Gaps</h4>
            <p className="text-sm text-muted-foreground mb-3">
              {preEmptionGaps.length} objection type{preEmptionGaps.length !== 1 ? 's' : ''} could have been prevented with better discovery/pre-setting:
            </p>
            <ul className="space-y-2">
              {preEmptionGaps.map((gap, i) => (
                <li key={i} className="text-sm text-muted-foreground">
                  <span className="text-amber-400 font-medium">&ldquo;{gap.text}&rdquo;</span>
                  {gap.preventionOpportunity && (
                    <span> — {gap.preventionOpportunity}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* E. Improvement Recommendation */}
        {guidance && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="text-sm font-semibold text-primary mb-2">Recommended Focus</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">{guidance}</p>
          </div>
        )}

        {/* Improvement actions */}
        {improvementActions && improvementActions.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3">Priority Actions</h4>
            <div className="space-y-2">
              {improvementActions.slice(0, 3).map((action, i) => (
                <div key={i} className="rounded-lg border border-white/10 overflow-hidden">
                  <div className="border-l-4 border-l-red-500 bg-red-500/5 px-4 py-2">
                    <p className="text-xs font-semibold text-red-400 mb-0.5">Problem</p>
                    <p className="text-sm text-muted-foreground">{action.problem}</p>
                  </div>
                  <div className="border-l-4 border-l-emerald-500 bg-emerald-500/5 px-4 py-2">
                    <p className="text-xs font-semibold text-emerald-400 mb-0.5">What To Do</p>
                    <p className="text-sm text-muted-foreground">{action.whatToDoDifferently}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
