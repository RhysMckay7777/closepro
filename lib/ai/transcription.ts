// Transcription service - Using Deepgram (5x faster than AssemblyAI)
// Deepgram: ~30 seconds per hour vs AssemblyAI: ~143 seconds per hour

import { createClient } from '@deepgram/sdk';

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY; // Fallback

// Use Deepgram by default (faster), fallback to AssemblyAI if needed
const USE_DEEPGRAM = !!DEEPGRAM_API_KEY;

const deepgram = DEEPGRAM_API_KEY ? createClient(DEEPGRAM_API_KEY) : null;

export interface TranscriptionResult {
  transcript: string;
  transcriptJson: {
    utterances: Array<{
      speaker: string; // 'A' or 'B' or speaker label
      start: number; // milliseconds
      end: number; // milliseconds
      text: string;
    }>;
    speakers: Array<{
      speaker: string;
      name?: string; // Optional: 'Rep' or 'Prospect'
    }>;
  };
  duration: number; // seconds
}

/**
 * Transcribe audio using Deepgram (fast) or AssemblyAI (fallback).
 * If fileUrl is provided, uses URL-based transcription (no buffer needed).
 */
export async function transcribeAudioFile(
  audioBuffer: Buffer | null,
  fileName: string,
  fileUrl?: string
): Promise<TranscriptionResult> {
  if (USE_DEEPGRAM && deepgram) {
    return transcribeWithDeepgram(audioBuffer, fileName, fileUrl);
  } else if (ASSEMBLYAI_API_KEY) {
    if (!audioBuffer) throw new Error('AssemblyAI fallback requires an audio buffer');
    return transcribeWithAssemblyAI(audioBuffer, fileName);
  } else {
    throw new Error('No transcription service configured. Set DEEPGRAM_API_KEY or ASSEMBLYAI_API_KEY');
  }
}

/**
 * Transcribe with Deepgram (5x faster)
 */
async function transcribeWithDeepgram(
  audioBuffer: Buffer | null,
  fileName: string,
  fileUrl?: string
): Promise<TranscriptionResult> {
  if (!deepgram) {
    throw new Error('Deepgram client not initialized');
  }

  const options = {
    model: 'nova-2' as const,
    smart_format: true,
    diarize: true, // Speaker diarization
    punctuate: true,
    paragraphs: false,
    utterances: true, // Get utterances with timestamps
  };

  let result;
  let error;

  if (fileUrl) {
    // URL-based transcription — faster, no buffer needed
    ({ result, error } = await deepgram.listen.prerecorded.transcribeUrl(
      { url: fileUrl },
      options
    ));
  } else if (audioBuffer) {
    // Buffer-based transcription — for direct small uploads
    ({ result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      options
    ));
  } else {
    throw new Error('Either audioBuffer or fileUrl is required for transcription');
  }

  if (error) {
    throw new Error(`Deepgram transcription error: ${error.message}`);
  }

  if (!result?.results) {
    throw new Error('No transcription results from Deepgram');
  }

  // Extract transcript text
  const transcript = result.results.channels[0]?.alternatives[0]?.transcript || '';

  // Extract utterances with speaker labels
  const utterances: TranscriptionResult['transcriptJson']['utterances'] = [];
  const speakers = new Set<string>();

  if (result.results.utterances) {
    for (const utterance of result.results.utterances) {
      const speaker = `Speaker ${utterance.speaker || 'A'}`;
      speakers.add(speaker);

      utterances.push({
        speaker,
        start: utterance.start * 1000, // Convert to milliseconds
        end: utterance.end * 1000,
        text: utterance.transcript || '',
      });
    }
  } else {
    // Fallback: single speaker if no diarization
    utterances.push({
      speaker: 'Speaker A',
      start: 0,
      end: (result.results.channels[0]?.alternatives[0]?.metadata?.duration || 0) * 1000,
      text: transcript,
    });
    speakers.add('Speaker A');
  }

  // Format transcript with speaker labels
  const formattedTranscript = utterances
    .map((u) => `[${u.speaker}] ${u.text}`)
    .join('\n\n');

  const duration = result.metadata?.duration || 0;

  return {
    transcript: formattedTranscript,
    transcriptJson: {
      utterances,
      speakers: Array.from(speakers).map((s) => ({ speaker: s })),
    },
    duration: Math.round(duration),
  };
}

/**
 * Transcribe with AssemblyAI (fallback, slower)
 */
async function transcribeWithAssemblyAI(
  audioBuffer: Buffer,
  fileName: string
): Promise<TranscriptionResult> {
  // Upload to AssemblyAI
  const audioUrl = await uploadAudioToAssemblyAI(audioBuffer, fileName);

  // Start transcription
  const transcriptId = await startTranscription(audioUrl);

  // Poll for completion (max 10 minutes)
  const maxAttempts = 120; // 120 attempts * 5 seconds = 10 minutes
  let attempts = 0;

  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds

    const status = await getTranscriptionStatus(transcriptId);
    attempts++;

    if (status.status === 'completed' && status.result) {
      return status.result;
    }

    if (status.status === 'error') {
      throw new Error(status.error || 'Transcription failed');
    }
  }

  throw new Error('Transcription timeout - took longer than 10 minutes');
}

// AssemblyAI helpers (for fallback)
const ASSEMBLYAI_API_URL = 'https://api.assemblyai.com/v2';

async function uploadAudioToAssemblyAI(file: File | Buffer, fileName: string): Promise<string> {
  if (!ASSEMBLYAI_API_KEY) {
    throw new Error('ASSEMBLYAI_API_KEY is not configured');
  }

  const formData = new FormData();
  formData.append('file', file instanceof File ? file : new Blob([file]), fileName);

  const response = await fetch(`${ASSEMBLYAI_API_URL}/upload`, {
    method: 'POST',
    headers: {
      'authorization': ASSEMBLYAI_API_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(error.error || 'Failed to upload audio file');
  }

  const data = await response.json();
  return data.upload_url;
}

async function startTranscription(audioUrl: string): Promise<string> {
  if (!ASSEMBLYAI_API_KEY) {
    throw new Error('ASSEMBLYAI_API_KEY is not configured');
  }

  const response = await fetch(`${ASSEMBLYAI_API_URL}/transcript`, {
    method: 'POST',
    headers: {
      'authorization': ASSEMBLYAI_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: audioUrl,
      speaker_labels: true,
      language_detection: true,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to start transcription' }));
    throw new Error(error.error || 'Failed to start transcription');
  }

  const data = await response.json();
  return data.id;
}

export async function getTranscriptionStatus(transcriptId: string): Promise<{
  status: 'queued' | 'processing' | 'completed' | 'error';
  result?: TranscriptionResult;
  error?: string;
}> {
  if (!ASSEMBLYAI_API_KEY) {
    throw new Error('ASSEMBLYAI_API_KEY is not configured');
  }

  const response = await fetch(`${ASSEMBLYAI_API_URL}/transcript/${transcriptId}`, {
    headers: {
      'authorization': ASSEMBLYAI_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get transcription status');
  }

  const data = await response.json();

  if (data.status === 'error') {
    return {
      status: 'error',
      error: data.error || 'Transcription failed',
    };
  }

  if (data.status === 'completed') {
    const utterances = data.utterances || [];
    const transcript = utterances
      .map((u: any) => `[Speaker ${u.speaker}] ${u.text}`)
      .join('\n\n');

    const speakers = Array.from(new Set(utterances.map((u: any) => u.speaker)))
      .map((speaker) => ({ speaker: `Speaker ${speaker}` }));

    return {
      status: 'completed',
      result: {
        transcript,
        transcriptJson: {
          utterances: utterances.map((u: any) => ({
            speaker: `Speaker ${u.speaker}`,
            start: u.start,
            end: u.end,
            text: u.text,
          })),
          speakers,
        },
        duration: Math.round((data.audio_duration || 0) / 1000),
      },
    };
  }

  return {
    status: data.status === 'queued' ? 'queued' : 'processing',
  };
}
