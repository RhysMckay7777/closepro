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

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 2000;

export function useVoiceSession({
  sessionId,
  onTranscriptUpdate,
  onError,
  onStatusChange,
}: UseVoiceSessionOptions) {
  const [voiceStatus, setVoiceStatus] = useState<Status>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [reconnectFailed, setReconnectFailed] = useState(false);
  const transcriptRef = useRef<VoiceTranscriptEntry[]>([]);
  const lastPersistedIndexRef = useRef<number>(0);
  const persistTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartRef = useRef<number>(Date.now());
  const reconnectAttemptsRef = useRef(0);
  const isReconnectingRef = useRef(false);
  const intentionalDisconnectRef = useRef(false);
  const hasConnectedRef = useRef(false);

  // Ref to hold the conversation instance — bridges the circular dependency
  // between attemptReconnect (needs conversation) and useConversation (callbacks need attemptReconnect)
  const conversationRef = useRef<ReturnType<typeof useConversation> | null>(null);

  // Persist transcript to server
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
        lastPersistedIndexRef.current = entries.length;
      }
    } catch (err) {
      console.error('[voice] Failed to persist transcript:', err);
    }
  }, [sessionId]);

  // Reconnection logic — uses conversationRef.current (resolved at call time, not definition time)
  const attemptReconnect = useCallback(async () => {
    if (isReconnectingRef.current) return;
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.error('[voice] Max reconnect attempts reached');
      setReconnectFailed(true);
      setError('Connection lost after multiple retries. Switch to text mode or try again.');
      onError?.('Connection lost after multiple retries');
      return;
    }

    isReconnectingRef.current = true;
    reconnectAttemptsRef.current += 1;
    const attempt = reconnectAttemptsRef.current;
    console.log(`[voice] Reconnecting attempt ${attempt}/${MAX_RECONNECT_ATTEMPTS}`);
    setVoiceStatus('connecting');
    setError(null);
    onStatusChange?.('connecting');

    // Wait before reconnecting
    await new Promise((r) => setTimeout(r, RECONNECT_DELAY_MS));

    try {
      const conv = conversationRef.current;

      // Clean up old session first
      if (conv) {
        try {
          await conv.endSession();
        } catch {
          // Ignore — session may already be dead
        }
      }

      // Re-fetch token and restart
      const tokenRes = await fetch(`/api/roleplay/${sessionId}/voice-token`);
      if (!tokenRes.ok) {
        const errData = await tokenRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to get voice token');
      }

      const { signedUrl, systemPrompt, firstMessage, voiceId, voiceSettings } = await tokenRes.json();

      if (!conv) {
        throw new Error('Conversation instance not available');
      }

      await conv.startSession({
        signedUrl,
        overrides: {
          agent: {
            prompt: { prompt: systemPrompt },
            firstMessage: attempt > 1 ? undefined : firstMessage,
          },
          tts: {
            voiceId,
            ...(voiceSettings || {}),
          },
        },
      });

      console.log(`[voice] Reconnect attempt ${attempt} succeeded`);
    } catch (err: any) {
      console.error(`[voice] Reconnect attempt ${attempt} failed:`, err?.message);
      isReconnectingRef.current = false;
      // Try again if attempts remain
      attemptReconnect();
    }
  }, [sessionId, onError, onStatusChange]);

  // Initialize ElevenLabs conversation with callbacks
  const conversation = useConversation({
    onConnect: () => {
      console.log('[voice] Connected');
      hasConnectedRef.current = true;
      isReconnectingRef.current = false;
      reconnectAttemptsRef.current = 0;
      setReconnectFailed(false);
      setError(null);
      // Don't set voiceStatus here — onStatusChange is the single source of truth
    },
    onDisconnect: () => {
      console.log('[voice] Disconnected', {
        intentional: intentionalDisconnectRef.current,
        reconnecting: isReconnectingRef.current,
      });
      // Persist transcript on disconnect
      persistTranscript();

      // If this was intentional (endVoice called), don't reconnect
      if (intentionalDisconnectRef.current) {
        intentionalDisconnectRef.current = false;
        return;
      }

      // If we were previously connected and this is unexpected, attempt reconnect
      if (hasConnectedRef.current && !isReconnectingRef.current) {
        attemptReconnect();
      }
    },
    onError: (message: string) => {
      console.error('[voice] Error:', message);

      // WebSocket errors should trigger reconnect
      const isWebSocketError =
        message.includes('WebSocket') ||
        message.includes('CLOSING') ||
        message.includes('CLOSED') ||
        message.includes('connection');

      if (isWebSocketError && hasConnectedRef.current && !isReconnectingRef.current) {
        attemptReconnect();
      } else {
        setError(message);
        onError?.(message);
      }
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
    // Single source of truth for voiceStatus
    onStatusChange: (status: { status: Status }) => {
      setVoiceStatus(status.status);
      onStatusChange?.(status.status);
    },
  });

  // Keep ref in sync — this runs every render, so conversationRef.current
  // is always the latest conversation instance when attemptReconnect runs
  conversationRef.current = conversation;

  const startVoice = useCallback(async () => {
    try {
      console.log('[voice] Starting voice session');
      setVoiceStatus('connecting');
      setError(null);
      setReconnectFailed(false);
      intentionalDisconnectRef.current = false;
      hasConnectedRef.current = false;
      reconnectAttemptsRef.current = 0;
      isReconnectingRef.current = false;
      sessionStartRef.current = Date.now();
      transcriptRef.current = [];
      lastPersistedIndexRef.current = 0;

      // Fetch signed URL + overrides from our API
      const tokenRes = await fetch(`/api/roleplay/${sessionId}/voice-token`);
      if (!tokenRes.ok) {
        const errData = await tokenRes.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to get voice token');
      }

      const { signedUrl, systemPrompt, firstMessage, voiceId, voiceSettings } = await tokenRes.json();

      // Start ElevenLabs conversation with overrides (includes voice quality settings)
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
            ...(voiceSettings || {}),
          },
        },
      });

      // Start periodic persistence timer (every 30s)
      if (persistTimerRef.current) clearInterval(persistTimerRef.current);
      persistTimerRef.current = setInterval(persistTranscript, 30000);
    } catch (err: any) {
      const message = err?.message || 'Failed to start voice session';
      console.error('[voice] Start failed:', message);
      setError(message);
      setVoiceStatus('disconnected');
      onError?.(message);
    }
  }, [sessionId, conversation, persistTranscript, onError]);

  const endVoice = useCallback(async () => {
    console.log('[voice] Ending voice session');
    intentionalDisconnectRef.current = true;
    isReconnectingRef.current = false;

    // Stop persistence timer
    if (persistTimerRef.current) {
      clearInterval(persistTimerRef.current);
      persistTimerRef.current = null;
    }

    // Persist remaining transcript
    await persistTranscript();

    // End ElevenLabs session
    try {
      await conversation.endSession();
    } catch {
      // Ignore — session may already be closed
    }
  }, [conversation, persistTranscript]);

  // Emergency persistence on tab close
  useEffect(() => {
    const handleBeforeUnload = () => {
      const entries = transcriptRef.current;
      const lastIndex = lastPersistedIndexRef.current;
      if (entries.length > lastIndex) {
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
    reconnectFailed,
    transcript: transcriptRef.current,
    startVoice,
    endVoice,
    setVolume: conversation.setVolume,
    getInputVolume: conversation.getInputVolume,
    getOutputVolume: conversation.getOutputVolume,
  };
}
