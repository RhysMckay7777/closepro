'use client';

export interface TranscriptUtterance {
  speaker: string;
  start: number;
  end: number;
  text: string;
}

export interface TranscriptViewProps {
  /** Plain text transcript fallback */
  transcript?: string | null;
  /** Structured transcript JSON with speaker diarization */
  transcriptJson?: string | { utterances: TranscriptUtterance[] } | null;
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `[${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}]`;
}

function getSpeakerLabel(speaker: string): 'Closer' | 'Prospect' {
  // Speaker A / 0 / first speaker is assumed to be the Closer
  const s = speaker?.toString().toLowerCase().trim();
  if (s === 'a' || s === '0' || s === 'closer' || s === 'speaker a' || s === 'speaker 0') return 'Closer';
  return 'Prospect';
}

export function TranscriptView({ transcript, transcriptJson }: TranscriptViewProps) {
  // Try to parse structured transcript
  let utterances: TranscriptUtterance[] | null = null;
  if (transcriptJson) {
    try {
      const parsed = typeof transcriptJson === 'string' ? JSON.parse(transcriptJson) : transcriptJson;
      if (Array.isArray(parsed?.utterances) && parsed.utterances.length > 0) {
        utterances = parsed.utterances;
      }
    } catch {
      // fall through to plain text
    }
  }

  if (utterances && utterances.length > 0) {
    return (
      <div className="max-h-80 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-4 space-y-2">
        {utterances.map((u, i) => {
          const label = getSpeakerLabel(u.speaker);
          const isCloser = label === 'Closer';
          return (
            <div key={i} className="flex gap-2 text-sm leading-relaxed">
              <span className="text-gray-500 font-mono text-xs flex-shrink-0 pt-0.5 w-12 text-right">
                {formatTimestamp(u.start)}
              </span>
              <span className={`font-semibold flex-shrink-0 ${isCloser ? 'text-blue-400' : 'text-amber-400'}`}>
                {label}:
              </span>
              <span className="text-muted-foreground">{u.text}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // Fallback to plain text transcript
  if (transcript) {
    return (
      <div className="max-h-80 overflow-y-auto rounded-lg border border-white/10 bg-black/20 p-4 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
        {transcript}
      </div>
    );
  }

  return null;
}
