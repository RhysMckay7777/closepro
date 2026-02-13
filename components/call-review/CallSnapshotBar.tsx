'use client';

import { Badge } from '@/components/ui/badge';

export interface CallSnapshotBarProps {
  callDate?: string | null;
  offerName?: string | null;
  prospectName?: string | null;
  outcome?: string | null;
  prospectDifficultyTotal?: number | null;
  difficultyTier?: string | null;
  closerEffectiveness?: string | null;
}

const resultColors: Record<string, string> = {
  closed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  lost: 'bg-red-500/20 text-red-400 border-red-500/30',
  follow_up: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  follow_up_result: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  deposit: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  payment_plan: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  unqualified: 'bg-red-500/20 text-red-400 border-red-500/30',
  no_show: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const resultLabels: Record<string, string> = {
  follow_up: 'Follow-up',
  follow_up_result: 'Follow-up',
  no_show: 'No Show',
  payment_plan: 'Payment Plan',
  unqualified: 'Unqualified',
};

const tierColors: Record<string, string> = {
  easy: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  realistic: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  hard: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  expert: 'bg-red-500/20 text-red-400 border-red-500/30',
  elite: 'bg-red-500/20 text-red-400 border-red-500/30',
  near_impossible: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const effectivenessColors: Record<string, string> = {
  above_expectation: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  at_expectation: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  below_expectation: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const effectivenessLabels: Record<string, string> = {
  above_expectation: 'Above Expectation',
  at_expectation: 'At Expectation',
  below_expectation: 'Below Expectation',
};

export function CallSnapshotBar({
  callDate,
  offerName,
  prospectName,
  outcome,
  prospectDifficultyTotal,
  difficultyTier,
  closerEffectiveness,
}: CallSnapshotBarProps) {
  const outcomeLabel = outcome
    ? resultLabels[outcome] || (outcome.charAt(0).toUpperCase() + outcome.slice(1))
    : '—';

  return (
    <div className="space-y-4">
      {/* Row 1: Call metadata */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {callDate && (
          <div>
            <p className="text-xs text-muted-foreground">Call Date</p>
            <p className="text-sm font-medium">
              {new Date(callDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        )}
        <div>
          <p className="text-xs text-muted-foreground">Offer</p>
          <p className="text-sm font-medium">{offerName || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Prospect</p>
          <p className="text-sm font-medium">{prospectName || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Result</p>
          <Badge className={outcome ? (resultColors[outcome] || 'bg-gray-500/20 text-gray-400') : 'bg-gray-500/20 text-gray-400'}>
            {outcomeLabel}
          </Badge>
        </div>
      </div>

      {/* Row 2: Difficulty + Effectiveness */}
      {(prospectDifficultyTotal != null || difficultyTier || closerEffectiveness) && (
        <div className="flex items-center gap-4 p-3 rounded-lg border border-white/10 bg-white/5">
          {prospectDifficultyTotal != null && (
            <div>
              <p className="text-xs text-muted-foreground">Prospect Difficulty</p>
              <p className="text-lg font-bold">
                {prospectDifficultyTotal} <span className="text-sm font-normal text-muted-foreground">/ 50</span>
              </p>
            </div>
          )}
          {difficultyTier && (
            <Badge className={tierColors[difficultyTier] || 'bg-gray-500/20 text-gray-400'}>
              {difficultyTier === 'elite' ? 'Expert' : difficultyTier === 'near_impossible' ? 'Near Impossible' : difficultyTier.charAt(0).toUpperCase() + difficultyTier.slice(1)}
            </Badge>
          )}
          {closerEffectiveness && (
            <div>
              <p className="text-xs text-muted-foreground">Closer Performance</p>
              <Badge className={effectivenessColors[closerEffectiveness] || 'bg-gray-500/20 text-gray-400'}>
                {effectivenessLabels[closerEffectiveness] || closerEffectiveness}
              </Badge>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
