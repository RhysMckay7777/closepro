'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown } from 'lucide-react';

export interface ProspectDifficultyPanelProps {
  justifications: Record<string, string>;
  sectionNumber?: number;
}

const DIMENSION_ORDER = ['icpAlignment', 'painAndAmbition', 'funnelWarmth', 'authorityAndCoachability', 'executionResistance'] as const;

const dimensionLabels: Record<string, string> = {
  icpAlignment: 'ICP Alignment',
  painAndAmbition: 'Pain & Ambition',
  funnelWarmth: 'Funnel Warmth',
  authorityAndCoachability: 'Authority & Coachability',
  executionResistance: 'Execution Resistance',
};

export function ProspectDifficultyPanel({ justifications, sectionNumber = 2 }: ProspectDifficultyPanelProps) {
  if (!justifications || typeof justifications !== 'object') return null;

  const hasDimensions = DIMENSION_ORDER.some(dim => justifications[dim]);
  if (!hasDimensions) return null;

  return (
    <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
      <CardHeader>
        <CardTitle className="font-serif">{sectionNumber}. Prospect Difficulty</CardTitle>
        <CardDescription>Context on the prospect — not coaching, just what you were working with</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {DIMENSION_ORDER.map((dim) => {
            const justification = justifications[dim];
            if (!justification) return null;
            return (
              <details key={dim} className="rounded-lg border border-white/10 overflow-hidden group">
                <summary className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors text-sm font-medium">
                  <span>{dimensionLabels[dim]}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-4 pb-4 pt-1 border-t border-white/10">
                  <p className="text-sm text-muted-foreground">{justification}</p>
                </div>
              </details>
            );
          }).filter(Boolean)}
        </div>
      </CardContent>
    </Card>
  );
}
