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

function buildSegments(timings: PhaseTimings, totalSec?: number): BarSegment[] {
  const phases = ['intro', 'discovery', 'pitch', 'objections', 'close'] as const;
  const raw: BarSegment[] = [];

  for (const phase of phases) {
    const timing = timings[phase];
    if (!timing) continue;

    if (Array.isArray(timing)) {
      for (const seg of timing) {
        const s = parseTimestamp(seg.start);
        const e = parseTimestamp(seg.end);
        if (e > s) raw.push({ phase, startSec: s, endSec: e, durationSec: e - s });
      }
    } else {
      const s = parseTimestamp(timing.start);
      const e = parseTimestamp(timing.end);
      if (e > s) raw.push({ phase, startSec: s, endSec: e, durationSec: e - s });
    }
  }

  if (raw.length === 0) return [];

  // Sort by start time
  raw.sort((a, b) => a.startSec - b.startSec);

  // Priority order — higher-priority phases take overlapping time
  const priority: Record<string, number> = {
    objections: 5,
    close: 4,
    pitch: 3,
    discovery: 2,
    intro: 1,
  };

  // Resolve overlaps: when two phases share time, split at the boundary
  // of the higher-priority phase
  const resolved: BarSegment[] = [];
  for (const seg of raw) {
    let current = { ...seg };

    // Check against already-resolved segments for overlap
    for (let i = 0; i < resolved.length; i++) {
      const existing = resolved[i];
      // No overlap
      if (current.startSec >= existing.endSec || current.endSec <= existing.startSec) continue;

      const currentPri = priority[current.phase] || 0;
      const existingPri = priority[existing.phase] || 0;

      if (currentPri > existingPri) {
        // Current wins — trim the existing segment
        if (existing.startSec < current.startSec) {
          // Existing starts before current: trim existing end
          existing.endSec = current.startSec;
          existing.durationSec = existing.endSec - existing.startSec;
        } else {
          // Existing starts within current: trim existing start
          existing.startSec = current.endSec;
          existing.durationSec = existing.endSec - existing.startSec;
        }
      } else {
        // Existing wins — trim current
        if (current.startSec < existing.startSec) {
          current.endSec = existing.startSec;
          current.durationSec = current.endSec - current.startSec;
        } else {
          current.startSec = existing.endSec;
          current.durationSec = current.endSec - current.startSec;
        }
      }
    }

    // Remove zero-width segments from resolved list
    for (let i = resolved.length - 1; i >= 0; i--) {
      if (resolved[i].durationSec <= 0) resolved.splice(i, 1);
    }

    if (current.durationSec > 0) {
      resolved.push(current);
    }
  }

  // Sort final segments by start time
  resolved.sort((a, b) => a.startSec - b.startSec);

  // Fill gaps: extend previous segment forward OR next segment backward
  const maxEnd = totalSec || Math.max(...resolved.map((s) => s.endSec));
  for (let i = 0; i < resolved.length; i++) {
    const next = resolved[i + 1];
    if (next && resolved[i].endSec < next.startSec) {
      // Gap between this and next — extend current forward to fill
      resolved[i].endSec = next.startSec;
      resolved[i].durationSec = resolved[i].endSec - resolved[i].startSec;
    }
  }
  // Extend last segment to total duration if there's trailing gap
  if (resolved.length > 0 && resolved[resolved.length - 1].endSec < maxEnd) {
    const last = resolved[resolved.length - 1];
    last.endSec = maxEnd;
    last.durationSec = last.endSec - last.startSec;
  }

  return resolved;
}

export function PhaseTimelineBar({ phaseTimings, totalDuration, activePhase }: PhaseTimelineBarProps) {
  if (!phaseTimings) return null;

  const rawTotalSec = totalDuration
    ? parseTimestamp(totalDuration)
    : 0;

  const segments = buildSegments(phaseTimings, rawTotalSec || undefined);
  if (segments.length === 0) return null;

  const totalSec = rawTotalSec || Math.max(...segments.map(s => s.endSec));

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
