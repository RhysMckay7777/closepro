'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown } from 'lucide-react';

export interface ProspectDifficultyPanelProps {
  justifications: Record<string, any>;
  sectionNumber?: number;
}

const DIMENSION_ORDER = ['icpAlignment', 'motivationIntensity', 'authorityAndCoachability', 'funnelContext', 'abilityToProceed'] as const;

const dimensionLabels: Record<string, string> = {
  icpAlignment: 'ICP Alignment',
  motivationIntensity: 'Motivation Intensity',
  funnelContext: 'Funnel Context',
  authorityAndCoachability: 'Prospect Authority & Coachability',
  abilityToProceed: 'Ability to Proceed',
};

const dimensionDescriptions: Record<string, string> = {
  icpAlignment: 'How closely does this prospect match your ideal customer profile (ICP) for this offer?',
  motivationIntensity: 'How driven and emotionally motivated is this prospect — how much pain or ambition do they have?',
  authorityAndCoachability: 'What is the prospect\'s authority level and how open to being helped are they?',
  funnelContext: 'How warm is the prospect when they come onto the call — what have they seen so far and where did they come from? (i.e., warm inbound vs cold ads)',
  abilityToProceed: 'What is the ability of the prospect to proceed today? (Do they have the time, the effort, and the finances to go ahead right now?)',
};

function scoreBadgeColor(score: number): string {
  if (score >= 7) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
  if (score >= 4) return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
  return 'bg-red-500/20 text-red-400 border-red-500/30';
}

export function ProspectDifficultyPanel({ justifications, sectionNumber = 2 }: ProspectDifficultyPanelProps) {
  if (!justifications || typeof justifications !== 'object') return null;

  const hasDimensions = DIMENSION_ORDER.some(dim => justifications[dim]);
  if (!hasDimensions) return null;

  const contextSummary = justifications.prospectContextSummary;
  const dimensionScores = justifications.dimensionScores;

  return (
    <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
      <CardHeader>
        <CardTitle className="font-serif text-xl">{sectionNumber}. Prospect Difficulty Analysis</CardTitle>
        <CardDescription>Context on the prospect — not coaching, just what you were working with</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Prospect Context Summary — styled like prospect selection card */}
        {contextSummary && typeof contextSummary === 'string' && (
          <div className="rounded-lg border border-primary/20 bg-linear-to-br from-primary/5 to-card/40 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10">
              <h4 className="text-base font-bold text-foreground">Prospect Context</h4>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-muted-foreground leading-relaxed">{contextSummary}</p>
            </div>
          </div>
        )}

        {/* Five-Point Difficulty Breakdown */}
        <div className="space-y-1">
          {DIMENSION_ORDER.map((dim) => {
            // Backward compat: fall back to old key names for existing analyses
            const fallbackKeys: Record<string, string> = {
              motivationIntensity: 'painAndAmbition',
              funnelContext: 'funnelWarmth',
              abilityToProceed: 'executionResistance',
            };
            const justification = justifications[dim] || (fallbackKeys[dim] ? justifications[fallbackKeys[dim]] : undefined);
            if (!justification) return null;

            const score = dimensionScores?.[dim];
            const hasScore = typeof score === 'number';

            return (
              <details key={dim} className="rounded-lg border border-white/10 overflow-hidden group">
                <summary className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors text-base font-medium">
                  <div className="flex items-center gap-3">
                    <span>{dimensionLabels[dim]}</span>
                    {hasScore && (
                      <Badge className={`text-xs ${scoreBadgeColor(score)}`}>
                        {score}/10
                      </Badge>
                    )}
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-4 pb-4 pt-1 border-t border-white/10 space-y-2">
                  <p className="text-sm text-white">{dimensionDescriptions[dim]}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{justification}</p>
                </div>
              </details>
            );
          }).filter(Boolean)}
        </div>
      </CardContent>
    </Card>
  );
}
