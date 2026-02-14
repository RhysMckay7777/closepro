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
  overallScore?: number | null;
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

const TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  easy:            { bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-300'  },
  realistic:       { bg: 'bg-amber-100',  text: 'text-amber-800',  border: 'border-amber-300'  },
  hard:            { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
  expert:          { bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-red-300'    },
  elite:           { bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-red-300'    },
  near_impossible: { bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-red-300'    },
};

const effectivenessColors: Record<string, string> = {
  above_expectation: 'text-emerald-400',
  at_expectation: 'text-amber-400',
  below_expectation: 'text-red-400',
};

const effectivenessLabels: Record<string, string> = {
  above_expectation: 'Above Expected',
  at_expectation: 'At Expected',
  below_expectation: 'Below Expected',
};

function scoreColor(score: number) {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-blue-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
}

export function CallSnapshotBar({
  callDate,
  offerName,
  prospectName,
  outcome,
  prospectDifficultyTotal,
  difficultyTier,
  closerEffectiveness,
  overallScore,
}: CallSnapshotBarProps) {
  const outcomeLabel = outcome
    ? resultLabels[outcome] || (outcome.charAt(0).toUpperCase() + outcome.slice(1))
    : '—';

  const tierStyle = difficultyTier ? TIER_COLORS[difficultyTier] : null;
  const tierLabel = difficultyTier === 'elite'
    ? 'Expert'
    : difficultyTier === 'near_impossible'
      ? 'Near Impossible'
      : difficultyTier
        ? difficultyTier.charAt(0).toUpperCase() + difficultyTier.slice(1)
        : '';

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

      {/* Row 2: Three-Column Performance Summary */}
      {(prospectDifficultyTotal != null || closerEffectiveness || overallScore != null) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-8 px-6 rounded-xl border border-white/10 bg-white/5">
          {/* LEFT: Prospect Difficulty */}
          <div className="flex flex-col items-center justify-center text-center space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Prospect Difficulty</p>
            {prospectDifficultyTotal != null && (
              <p className="text-3xl font-bold">
                {prospectDifficultyTotal}
                <span className="text-lg font-normal text-muted-foreground"> / 50</span>
              </p>
            )}
            {tierStyle && (
              <Badge className={`${tierStyle.bg} ${tierStyle.text} ${tierStyle.border} border`}>
                {tierLabel}
              </Badge>
            )}
          </div>

          {/* CENTER: Closer Performance */}
          <div className="flex flex-col items-center justify-center text-center space-y-2 sm:border-x sm:border-white/10">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Closer Performance</p>
            {closerEffectiveness && (
              <p className={`text-2xl font-bold ${effectivenessColors[closerEffectiveness] || 'text-muted-foreground'}`}>
                {effectivenessLabels[closerEffectiveness] || closerEffectiveness}
              </p>
            )}
          </div>

          {/* RIGHT: Overall Score */}
          <div className="flex flex-col items-center justify-center text-center space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Overall Score</p>
            {overallScore != null && (
              <div>
                <span className={`text-5xl font-bold ${scoreColor(overallScore)}`}>{overallScore}</span>
                <span className="text-lg text-muted-foreground"> / 100</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
