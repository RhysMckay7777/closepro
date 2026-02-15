'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useConversation } from '@elevenlabs/react';
import type { Status } from '@elevenlabs/react';

export interface VoiceTranscriptEntry {
  role: 'rep' | 'prospect';
  content: string;
  timestamp: number;
}

interface UseVoiceSessionOptions {
  sessionId: string;
  onTranscriptUpdate?: (entries: VoiceTranscriptEntry[]) => void;
  onError?: (message: string) => void;
  onStatusChange?: (status: Status) => void;
}

export function useVoiceSession({
  sessionId,
  onTranscriptUpdate,
  onError,
  onStatusChange,
}: UseVoiceSessionOptions) {
  const [voiceStatus, setVoiceStatus] = useState<Status>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const transcriptRef = useRef<VoiceTranscriptEntry[]>([]);
  const lastPersistedIndexRef = useRef<number>(0);
  const persistTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef<number>(Date.now());

  const conversation = useConversation({
    onConnect: () => {
      setVoiceStatus('connected');
      setError(null);
      onStatusChange?.('connected');
    },
    onDisconnect: () => {
      setVoiceStatus('disconnected');
      onStatusChange?.('disconnected');
      // Persist any remaining transcript on disconnect
      persistTranscript();
    },
    onError: (message: string) => {
      setError(message);
      onError?.(message);
    },
    onMessage: (props: { message: string; role: 'user' | 'agent' }) => {
      const entry: VoiceTranscriptEntry = {
        role: props.role === 'user' ? 'rep' : 'prospect',
        content: props.message,
        timestamp: Date.now() - sessionStartRef.current,
      };
      transcriptRef.current = [...transcriptRef.current, entry];
      onTranscriptUpdate?.([...transcriptRef.current]);
    },
    onStatusChange: (status: { status: Status }) => {
      setVoiceStatus(status.status);
      onStatusChange?.(status.status);
    },
  });

  const persistTranscript = useCallback(async () => {
    const entries = transcriptRef.current;
    const lastIndex = lastPersistedIndexRef.current;

    if (entries.length <= lastIndex) return;

    try {
      const res = await fetch(`/api/roleplay/${sessionId}/transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: entries,
          lastPersistedIndex: lastIndex,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        lastPersistedIndexRef.current = entries.length;
      }
    } catch (err) {
      console.error('[useVoiceSession] Failed to persist transcript:', err);
    }
  }, [sessionId]);

  const startVoice = useCallback(async () => {
    try {
      setVoiceStatus('connecting');
      setError(null);
      sessionStartRef.current = Date.now();
      transcriptRef.current = [];
      lastPersistedIndexRef.current = 0;

      // Fetch signed URL + overrides from our API
      const tokenRes = await fetch(`/api/roleplay/${sessionId}/voice-token`);
      if (!tokenRes.ok) {
        const errData = await tokenRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to get voice token');
      }

      const { signedUrl, systemPrompt, firstMessage, voiceId } = await tokenRes.json();

      // Start ElevenLabs conversation with overrides
      await conversation.startSession({
        signedUrl,
        overrides: {
          agent: {
            prompt: {
              prompt: systemPrompt,
            },
            firstMessage,
          },
          tts: {
            voiceId,
          },
        },
      });

      // Start periodic persistence timer (every 30s)
      if (persistTimerRef.current) clearInterval(persistTimerRef.current);
      persistTimerRef.current = setInterval(persistTranscript, 30000);
    } catch (err: any) {
      const message = err?.message || 'Failed to start voice session';
      setError(message);
      setVoiceStatus('disconnected');
      onError?.(message);
    }
  }, [sessionId, conversation, persistTranscript, onError]);

  const endVoice = useCallback(async () => {
    // Stop persistence timer
    if (persistTimerRef.current) {
      clearInterval(persistTimerRef.current);
      persistTimerRef.current = null;
    }

    // Persist remaining transcript
    await persistTranscript();

    // End ElevenLabs session
    await conversation.endSession();
  }, [conversation, persistTranscript]);

  // Emergency persistence on tab close
  useEffect(() => {
    const handleBeforeUnload = () => {
      const entries = transcriptRef.current;
      const lastIndex = lastPersistedIndexRef.current;
      if (entries.length > lastIndex) {
        // Use sendBeacon for reliability during unload
        const body = JSON.stringify({
          messages: entries,
          lastPersistedIndex: lastIndex,
        });
        navigator.sendBeacon(
          `/api/roleplay/${sessionId}/transcript`,
          new Blob([body], { type: 'application/json' })
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (persistTimerRef.current) {
        clearInterval(persistTimerRef.current);
      }
    };
  }, [sessionId]);

  return {
    voiceStatus,
    isSpeaking: conversation.isSpeaking,
    error,
    transcript: transcriptRef.current,
    startVoice,
    endVoice,
    setVolume: conversation.setVolume,
    getInputVolume: conversation.getInputVolume,
    getOutputVolume: conversation.getOutputVolume,
  };
}
