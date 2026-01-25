// React hook for call analysis

import { useState, useCallback } from 'react';
import { analyzeCall, CallAnalysisResult } from '@/lib/ai/analysis';
import { TranscriptionResult } from '@/lib/ai/transcription';

export function useCallAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CallAnalysisResult | null>(null);

  const analyze = useCallback(async (transcription: TranscriptionResult) => {
    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const analysis = await analyzeCall(transcription.transcript, transcription.transcriptJson);
      setResult(analysis);
      return analysis;
    } catch (err: any) {
      const errorMessage = err.message || 'Analysis failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setResult(null);
    setIsAnalyzing(false);
  }, []);

  return {
    analyze,
    isAnalyzing,
    error,
    result,
    reset,
  };
}
