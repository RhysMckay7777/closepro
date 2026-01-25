// React hook for handling audio transcription

import { useState, useCallback } from 'react';
import { uploadAudioToAssemblyAI, transcribeAudio, TranscriptionResult } from '@/lib/ai/transcription';

export function useTranscription() {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranscriptionResult | null>(null);

  const transcribe = useCallback(async (file: File) => {
    setIsTranscribing(true);
    setError(null);
    setProgress('Uploading audio file...');
    setResult(null);

    try {
      // Upload file to AssemblyAI
      const audioUrl = await uploadAudioToAssemblyAI(file, file.name);
      setProgress('File uploaded, starting transcription...');

      // Transcribe with progress updates
      const transcription = await transcribeAudio(audioUrl, (status) => {
        setProgress(status);
      });

      setResult(transcription);
      setProgress('Transcription completed');
      return transcription;
    } catch (err: any) {
      const errorMessage = err.message || 'Transcription failed';
      setError(errorMessage);
      setProgress('');
      throw err;
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setResult(null);
    setProgress('');
    setIsTranscribing(false);
  }, []);

  return {
    transcribe,
    isTranscribing,
    progress,
    error,
    result,
    reset,
  };
}
