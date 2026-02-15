/**
 * Transcript Format Parser
 *
 * Parses SRT, WEBVTT, and custom @timestamp transcript formats
 * into clean speaker-attributed conversational text for pattern extraction.
 */

export interface ParsedTranscript {
  cleanText: string;
  speakers: string[];
  format: 'srt' | 'webvtt' | 'custom' | 'plain';
  estimatedDurationSeconds: number | null;
}

/**
 * Auto-detect transcript format and parse to clean text.
 */
export function parseTranscript(raw: string): ParsedTranscript {
  const format = detectFormat(raw);
  switch (format) {
    case 'webvtt':
    case 'srt':
      return parseSRTorVTT(raw, format);
    case 'custom':
      return parseCustomTimestamp(raw);
    default:
      return {
        cleanText: raw.trim(),
        speakers: [],
        format: 'plain',
        estimatedDurationSeconds: null,
      };
  }
}

/**
 * Detect transcript format from raw content.
 */
export function detectFormat(raw: string): 'srt' | 'webvtt' | 'custom' | 'plain' {
  const trimmed = raw.trim();

  // WEBVTT header
  if (trimmed.startsWith('WEBVTT')) return 'webvtt';

  // Custom @timestamp format: @0:00 - Speaker Name
  if (/(?:^|\n)@\d+:\d+\s*-\s*.+/m.test(trimmed)) return 'custom';

  // SRT: starts with sequence number + timestamp line
  if (/^\d+\s*\n\d{2}:\d{2}:\d{2}[.,]\d+\s*-->/.test(trimmed)) return 'srt';

  return 'plain';
}

/**
 * Parse SRT or WEBVTT subtitle format into clean conversational text.
 *
 * Format:
 *   {sequence_number}
 *   00:00:08.160 --> 00:00:10.020
 *   Speaker Name: Dialog text here
 */
function parseSRTorVTT(raw: string, format: 'srt' | 'webvtt'): ParsedTranscript {
  // Strip WEBVTT header
  let content = raw.replace(/^WEBVTT\s*\n+/, '');

  // Remove title line if present (e.g. "Luke lewis transcript\n\n")
  content = content.replace(/^[^\d@\n]+\n+/, '');

  // Split into blocks separated by blank lines
  const blocks = content.split(/\n\s*\n/);

  const entries: { speaker: string; text: string }[] = [];
  const speakers = new Set<string>();
  let lastTimestampSeconds = 0;

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    // Find the timestamp line
    const tsLineIdx = lines.findIndex(
      (l) => /\d{2}:\d{2}:\d{2}/.test(l) && l.includes('-->')
    );
    if (tsLineIdx === -1) continue;

    // Extract end timestamp for duration estimation
    const timestamps = lines[tsLineIdx].match(/(\d{2}):(\d{2}):(\d{2})/g);
    if (timestamps && timestamps.length >= 2) {
      const parts = timestamps[1].split(':').map(Number);
      lastTimestampSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    }

    // Text lines are everything after the timestamp
    const textLines = lines.slice(tsLineIdx + 1);
    const fullText = textLines.join(' ').trim();
    if (!fullText) continue;

    // Extract speaker prefix ("Speaker Name: text")
    const speakerMatch = fullText.match(/^(.+?):\s+(.+)/);
    if (speakerMatch) {
      const speaker = speakerMatch[1].trim();
      const text = speakerMatch[2].trim();
      speakers.add(speaker);
      entries.push({ speaker, text });
    } else {
      entries.push({ speaker: '', text: fullText });
    }
  }

  // Merge consecutive same-speaker entries into single turns
  const merged = mergeSameSpeaker(entries);

  return {
    cleanText: merged.map((e) => (e.speaker ? `${e.speaker}: ${e.text}` : e.text)).join('\n'),
    speakers: Array.from(speakers),
    format,
    estimatedDurationSeconds: lastTimestampSeconds > 0 ? lastTimestampSeconds : null,
  };
}

/**
 * Parse custom @timestamp format into clean conversational text.
 *
 * Format:
 *   @0:00 - Speaker Name (Company)
 *   Dialog text here, possibly spanning multiple lines.
 */
function parseCustomTimestamp(raw: string): ParsedTranscript {
  // Split on @timestamp markers, keeping delimiter
  const parts = raw.split(/(?=@\d+:\d+\s*-\s*)/);

  const entries: { speaker: string; text: string }[] = [];
  const speakers = new Set<string>();
  let lastTimestampSeconds = 0;

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed.startsWith('@')) continue;

    // Match: @M:SS - Speaker Name (optional company)\ntext
    const headerMatch = trimmed.match(
      /^@(\d+):(\d+)\s*-\s*(.+?)(?:\s*\([^)]*\))?\s*\n([\s\S]*)/
    );
    if (!headerMatch) continue;

    const [, minStr, secStr, rawSpeaker, rawText] = headerMatch;
    const minutes = parseInt(minStr);
    const seconds = parseInt(secStr);
    const speaker = rawSpeaker.trim();

    // Clean text: collapse whitespace, remove ACTION ITEM lines
    const text = rawText
      .split('\n')
      .filter((line) => !line.startsWith('ACTION ITEM:') && !line.startsWith('VIEW RECORDING'))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    lastTimestampSeconds = minutes * 60 + seconds;
    speakers.add(speaker);

    if (text) {
      entries.push({ speaker, text });
    }
  }

  // Merge consecutive same-speaker entries
  const merged = mergeSameSpeaker(entries);

  return {
    cleanText: merged.map((e) => `${e.speaker}: ${e.text}`).join('\n'),
    speakers: Array.from(speakers),
    format: 'custom',
    estimatedDurationSeconds: lastTimestampSeconds > 0 ? lastTimestampSeconds : null,
  };
}

/**
 * Merge consecutive entries from the same speaker into single turns.
 */
function mergeSameSpeaker(
  entries: { speaker: string; text: string }[]
): { speaker: string; text: string }[] {
  const merged: { speaker: string; text: string }[] = [];

  for (const entry of entries) {
    if (merged.length > 0 && merged[merged.length - 1].speaker === entry.speaker && entry.speaker) {
      merged[merged.length - 1].text += ' ' + entry.text;
    } else {
      merged.push({ ...entry });
    }
  }

  return merged;
}

/**
 * Sample representative sections from a long transcript for AI pattern extraction.
 * Returns ~6000 chars covering intro, discovery, pitch/objections, and close.
 */
export function sampleForExtraction(text: string, maxChars: number = 6000): string {
  if (text.length <= maxChars) return text;

  const segmentSize = Math.floor(maxChars / 4);

  // Opening (intro + rapport + early discovery)
  const opening = text.substring(0, segmentSize);

  // Mid-early (qualification / deeper discovery)
  const midStart = Math.floor(text.length * 0.3);
  const midSection = text.substring(midStart, midStart + segmentSize);

  // Late-mid (pitch / objection handling)
  const lateStart = Math.floor(text.length * 0.6);
  const lateSection = text.substring(lateStart, lateStart + segmentSize);

  // Closing (final close, price reveal, outcome)
  const closing = text.substring(text.length - segmentSize);

  return [
    '--- CALL OPENING ---',
    opening,
    '\n--- MID-CALL (Discovery/Qualification) ---',
    midSection,
    '\n--- LATE-CALL (Pitch/Objections) ---',
    lateSection,
    '\n--- CALL CLOSE ---',
    closing,
  ].join('\n');
}

/**
 * Extract a clean title from a transcript filename.
 */
export function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.(txt|srt|vtt|webvtt|csv|json|md|docx)$/i, '')
    .replace(/[_-]+/g, ' ')
    .trim();
}

/**
 * Auto-detect tags from transcript content and filename.
 */
export function autoDetectTags(
  cleanText: string,
  speakers: string[],
  filename: string
): string[] {
  const tags: string[] = [];

  // Detect niche from content/filename
  const lowerFilename = filename.toLowerCase();
  const lowerText = cleanText.toLowerCase().substring(0, 3000);

  if (lowerFilename.includes('close pro') || lowerFilename.includes('closepro')) {
    tags.push('close-pro');
  }
  if (lowerFilename.includes('fitness') || lowerText.includes('fitness') || lowerText.includes('workout') || lowerText.includes('nutrition')) {
    tags.push('fitness-coaching');
  }
  if (lowerText.includes('high-ticket') || lowerText.includes('high ticket') || lowerText.includes('closing')) {
    tags.push('high-ticket-sales');
  }

  // Detect closer from speakers
  if (speakers.some((s) => s.toLowerCase().includes('connor williams'))) {
    tags.push('connor-williams');
  }

  // Detect call type
  if (lowerText.includes('payment') || lowerText.includes('price') || lowerText.includes('invest')) {
    tags.push('closing-call');
  }
  if (lowerText.includes('discovery') || lowerText.includes('tell me about')) {
    tags.push('discovery');
  }

  return [...new Set(tags)];
}
