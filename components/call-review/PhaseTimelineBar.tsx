'use client';

export interface PhaseTiming {
  start: string;
  end: string;
}

export interface PhaseTimings {
  intro?: PhaseTiming;
  discovery?: PhaseTiming;
  pitch?: PhaseTiming;
  objections?: PhaseTiming | PhaseTiming[];
  close?: PhaseTiming;
}

export interface PhaseTimelineBarProps {
  phaseTimings?: PhaseTimings | null;
  totalDuration?: string | null;
  activePhase: 'overall' | 'intro' | 'discovery' | 'pitch' | 'objections' | 'close';
}

const PHASE_COLORS: Record<string, string> = {
  intro: 'bg-blue-500',
  discovery: 'bg-green-500',
  pitch: 'bg-purple-500',
  objections: 'bg-orange-500',
  close: 'bg-teal-500',
};

const PHASE_LABELS: Record<string, string> = {
  intro: 'Intro',
  discovery: 'Discovery',
  pitch: 'Pitch',
  objections: 'Objections',
  close: 'Close',
};

const PHASE_INACTIVE = 'bg-gray-600/40';

/** Parse "MM:SS" or "HH:MM:SS" to total seconds */
function parseTimestamp(ts: string): number {
  if (!ts) return 0;
  const parts = ts.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

/** Format seconds to "MM:SS" */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

interface BarSegment {
  phase: string;
  startSec: number;
  endSec: number;
  durationSec: number;
}

function buildSegments(timings: PhaseTimings): BarSegment[] {
  const phases = ['intro', 'discovery', 'pitch', 'objections', 'close'] as const;
  const segments: BarSegment[] = [];

  for (const phase of phases) {
    const timing = timings[phase];
    if (!timing) continue;

    if (Array.isArray(timing)) {
      // Multiple segments (objections)
      for (const seg of timing) {
        const s = parseTimestamp(seg.start);
        const e = parseTimestamp(seg.end);
        if (e > s) segments.push({ phase, startSec: s, endSec: e, durationSec: e - s });
      }
    } else {
      const s = parseTimestamp(timing.start);
      const e = parseTimestamp(timing.end);
      if (e > s) segments.push({ phase, startSec: s, endSec: e, durationSec: e - s });
    }
  }

  return segments.sort((a, b) => a.startSec - b.startSec);
}

export function PhaseTimelineBar({ phaseTimings, totalDuration, activePhase }: PhaseTimelineBarProps) {
  if (!phaseTimings) return null;

  const segments = buildSegments(phaseTimings);
  if (segments.length === 0) return null;

  const totalSec = totalDuration
    ? parseTimestamp(totalDuration)
    : Math.max(...segments.map(s => s.endSec));

  if (totalSec <= 0) return null;

  const isOverall = activePhase === 'overall';

  // Calculate selected phase info for individual tabs
  const selectedSegments = segments.filter(s => s.phase === activePhase);
  const selectedDuration = selectedSegments.reduce((sum, s) => sum + s.durationSec, 0);
  const selectedStart = selectedSegments.length > 0 ? Math.min(...selectedSegments.map(s => s.startSec)) : 0;
  const selectedEnd = selectedSegments.length > 0 ? Math.max(...selectedSegments.map(s => s.endSec)) : 0;

  return (
    <div className="space-y-2">
      {/* Timeline bar */}
      <div className="w-full h-3 rounded-full bg-gray-800 overflow-hidden flex relative">
        {segments.map((seg, i) => {
          const leftPct = (seg.startSec / totalSec) * 100;
          const widthPct = (seg.durationSec / totalSec) * 100;
          const isActive = isOverall || seg.phase === activePhase;
          const color = isActive ? PHASE_COLORS[seg.phase] || PHASE_INACTIVE : PHASE_INACTIVE;

          return (
            <div
              key={`${seg.phase}-${i}`}
              className={`absolute h-full ${color} transition-colors duration-200`}
              style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 0.5)}%` }}
              title={`${PHASE_LABELS[seg.phase] || seg.phase}: ${formatDuration(seg.startSec)} – ${formatDuration(seg.endSec)}`}
            />
          );
        })}
      </div>

      {/* Info below bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {isOverall ? (
          <>
            {/* Phase legend */}
            {(['intro', 'discovery', 'pitch', 'objections', 'close'] as const).map(phase => {
              const phaseSegs = segments.filter(s => s.phase === phase);
              if (phaseSegs.length === 0) return null;
              return (
                <div key={phase} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-sm ${PHASE_COLORS[phase]}`} />
                  <span>{PHASE_LABELS[phase]}</span>
                </div>
              );
            })}
            <span className="ml-auto font-medium">
              Total Call Length: {formatDuration(totalSec)}
            </span>
          </>
        ) : (
          <>
            {selectedSegments.length > 0 && (
              <>
                <span className="font-medium">
                  {PHASE_LABELS[activePhase] || activePhase} Length: {formatDuration(selectedDuration)}
                </span>
                {selectedSegments.length === 1 ? (
                  <>
                    <span>Started at: {formatDuration(selectedStart)}</span>
                    <span>Ended at: {formatDuration(selectedEnd)}</span>
                  </>
                ) : (
                  <>
                    <span>Multiple segments:</span>
                    {selectedSegments.map((seg, i) => (
                      <span key={i}>
                        Seg {i + 1}: {formatDuration(seg.startSec)} – {formatDuration(seg.endSec)}
                      </span>
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
