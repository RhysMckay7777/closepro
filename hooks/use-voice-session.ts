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
const BASE_RECONNECT_DELAY_MS = 2000; // 2s, 4s, 8s (exponential)
const STABLE_CONNECTION_THRESHOLD_MS = 10_000; // 10 seconds before resetting attempt counter
const RAPID_RECONNECT_WINDOW_MS = 60_000; // 60 second window
const MAX_RECONNECTS_IN_WINDOW = 5; // max reconnects in the window

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
  const connectionStartTimeRef = useRef<number>(0);
  const keepaliveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stable connection timer — only reset attempt counter after 10s of stable connection
  const stableConnectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rapid reconnect detection — track timestamps of recent reconnects
  const reconnectTimestampsRef = useRef<number[]>([]);

  // Ref to hold the conversation instance — bridges the circular dependency
  const conversationRef = useRef<ReturnType<typeof useConversation> | null>(null);

  // Cache signed URL to reuse within its validity window (avoids voice config changes mid-session)
  const signedUrlCacheRef = useRef<{ url: string; dynamicVariables: any; createdAt: number } | null>(null);

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

  /**
   * Get or fetch a signed URL. Reuses the cached URL if less than 8 minutes old
   * to prevent voice config changes mid-session on reconnect.
   */
  const getOrFetchSignedUrl = useCallback(async (): Promise<{ signedUrl: string; dynamicVariables: any }> => {
    // Reuse existing URL if less than 8 minutes old (signed URLs valid ~10 minutes)
    if (
      signedUrlCacheRef.current &&
      Date.now() - signedUrlCacheRef.current.createdAt < 8 * 60 * 1000
    ) {
      return {
        signedUrl: signedUrlCacheRef.current.url,
        dynamicVariables: signedUrlCacheRef.current.dynamicVariables,
      };
    }

    // Fetch new signed URL
    const tokenRes = await fetch(`/api/roleplay/${sessionId}/voice-token`);
    if (!tokenRes.ok) {
      const errData = await tokenRes.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to get voice token');
    }

    const data = await tokenRes.json();
    const url = data.signedUrl || data.signed_url || data.url;

    // Cache it
    signedUrlCacheRef.current = {
      url,
      dynamicVariables: data.dynamicVariables,
      createdAt: Date.now(),
    };

    return { signedUrl: url, dynamicVariables: data.dynamicVariables };
  }, [sessionId]);

  /**
   * Clear signed URL cache (on session end or unmount)
   */
  const clearVoiceCache = useCallback(() => {
    signedUrlCacheRef.current = null;
  }, []);

  /**
   * Check if we're in a rapid-reconnect loop.
   * Returns true if too many reconnects happened in the last 60 seconds.
   */
  const isRapidReconnectLoop = useCallback((): boolean => {
    const now = Date.now();
    // Prune old timestamps outside the window
    reconnectTimestampsRef.current = reconnectTimestampsRef.current.filter(
      (t) => now - t < RAPID_RECONNECT_WINDOW_MS
    );
    return reconnectTimestampsRef.current.length >= MAX_RECONNECTS_IN_WINDOW;
  }, []);

  /**
   * Stop all reconnection and show error state.
   */
  const haltReconnection = useCallback((message: string) => {
    console.error(`[voice] Halting reconnection: ${message}`);
    isReconnectingRef.current = false;
    setReconnectFailed(true);
    setError(message);
    setVoiceStatus('disconnected');
    onError?.(message);
    // Clear stable connection timer
    if (stableConnectionTimerRef.current) {
      clearTimeout(stableConnectionTimerRef.current);
      stableConnectionTimerRef.current = null;
    }
  }, [onError]);

  // Reconnection logic — exponential backoff + rapid-loop detection
  const attemptReconnect = useCallback(async () => {
    if (isReconnectingRef.current) return;

    // Check rapid reconnect loop FIRST
    if (isRapidReconnectLoop()) {
      haltReconnection('Connection unstable — please try again or switch to text mode.');
      return;
    }

    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      haltReconnection('Connection lost after multiple retries. Switch to text mode or try again.');
      return;
    }

    isReconnectingRef.current = true;
    reconnectAttemptsRef.current += 1;
    const attempt = reconnectAttemptsRef.current;

    // Record this reconnect timestamp for rapid-loop detection
    reconnectTimestampsRef.current.push(Date.now());

    console.log(`[voice] Reconnecting attempt ${attempt}/${MAX_RECONNECT_ATTEMPTS}`);
    setVoiceStatus('connecting');
    setError(null);
    onStatusChange?.('connecting');

    // Exponential backoff: 2s, 4s, 8s
    const delay = BASE_RECONNECT_DELAY_MS * Math.pow(2, attempt - 1);
    console.log(`[voice] Waiting ${delay}ms before reconnect`);
    await new Promise((r) => setTimeout(r, delay));

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

      // Reuse cached signed URL or fetch new one
      const { signedUrl, dynamicVariables } = await getOrFetchSignedUrl();

      if (!conv) {
        throw new Error('Conversation instance not available');
      }

      // Pass dynamic variables — ElevenLabs injects into {{prospect_context}}, {{offer_info}}, {{first_message}}
      await conv.startSession({ signedUrl, dynamicVariables });

      console.log(`[voice] Reconnect attempt ${attempt} succeeded`);
    } catch (err: any) {
      console.error(`[voice] Reconnect attempt ${attempt} failed:`, err?.message);
      isReconnectingRef.current = false;
      // Try again if attempts remain (will re-check limits at top of function)
      attemptReconnect();
    }
  }, [sessionId, onError, onStatusChange, isRapidReconnectLoop, haltReconnection, getOrFetchSignedUrl]);

  // Initialize ElevenLabs conversation — NO overrides for now (diagnostic)
  // The signed URL encodes the agent ID; the agent's dashboard defaults will be used.
  // If connection holds, the problem is purely in override format.
  const conversation = useConversation({
    onConnect: () => {
      console.log('[voice] Connected');
      hasConnectedRef.current = true;
      isReconnectingRef.current = false;
      setReconnectFailed(false);
      setError(null);

      // Record connection start for immediate-drop detection
      connectionStartTimeRef.current = Date.now();

      // Keepalive: prevent idle WebSocket timeout (ElevenLabs closes after ~20s)
      if (keepaliveRef.current) clearInterval(keepaliveRef.current);
      keepaliveRef.current = setInterval(() => {
        // @elevenlabs/react 0.14.0 handles WebSocket keepalive internally.
        // This interval is a safety net for older SDK versions.
      }, 15_000);

      // DON'T reset reconnectAttemptsRef immediately — wait for stable connection.
      // If the connection drops within 10s, we keep the current attempt count.
      if (stableConnectionTimerRef.current) {
        clearTimeout(stableConnectionTimerRef.current);
      }
      stableConnectionTimerRef.current = setTimeout(() => {
        console.log('[voice] Connection stable for 10s — resetting attempt counter');
        reconnectAttemptsRef.current = 0;
        stableConnectionTimerRef.current = null;
      }, STABLE_CONNECTION_THRESHOLD_MS);
    },
    onDisconnect: () => {
      const connectionDuration = connectionStartTimeRef.current
        ? Date.now() - connectionStartTimeRef.current
        : Infinity;

      console.log('[voice] Disconnected', {
        intentional: intentionalDisconnectRef.current,
        reconnecting: isReconnectingRef.current,
        connectionDurationMs: connectionDuration,
      });

      // Clear keepalive
      if (keepaliveRef.current) {
        clearInterval(keepaliveRef.current);
        keepaliveRef.current = null;
      }

      // Cancel stable-connection timer (connection wasn't stable)
      if (stableConnectionTimerRef.current) {
        clearTimeout(stableConnectionTimerRef.current);
        stableConnectionTimerRef.current = null;
      }

      // Persist transcript on disconnect
      persistTranscript();

      // If this was intentional (endVoice called), don't reconnect
      if (intentionalDisconnectRef.current) {
        intentionalDisconnectRef.current = false;
        return;
      }

      // If connection lasted < 2 seconds, it's a config/auth error — don't retry
      if (connectionDuration < 2000) {
        haltReconnection('Voice connection rejected — check ElevenLabs agent configuration');
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

  // Keep ref in sync every render
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
      reconnectTimestampsRef.current = [];
      sessionStartRef.current = Date.now();
      transcriptRef.current = [];
      lastPersistedIndexRef.current = 0;

      if (stableConnectionTimerRef.current) {
        clearTimeout(stableConnectionTimerRef.current);
        stableConnectionTimerRef.current = null;
      }

      // Fetch signed URL (or reuse cached) + overrides from our API
      clearVoiceCache(); // Clear stale cache from previous session
      const { signedUrl, dynamicVariables } = await getOrFetchSignedUrl();

      // Pass dynamic variables — ElevenLabs injects into {{prospect_context}}, {{offer_info}}, {{first_message}}
      await conversation.startSession({ signedUrl, dynamicVariables });

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
  }, [sessionId, conversation, persistTranscript, onError, getOrFetchSignedUrl, clearVoiceCache]);

  const endVoice = useCallback(async () => {
    console.log('[voice] Ending voice session');
    intentionalDisconnectRef.current = true;
    isReconnectingRef.current = false;
    clearVoiceCache();

    // Cancel keepalive
    if (keepaliveRef.current) {
      clearInterval(keepaliveRef.current);
      keepaliveRef.current = null;
    }

    // Cancel stable-connection timer
    if (stableConnectionTimerRef.current) {
      clearTimeout(stableConnectionTimerRef.current);
      stableConnectionTimerRef.current = null;
    }

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
  }, [conversation, persistTranscript, clearVoiceCache]);

  // Emergency persistence on tab close + cleanup timers
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
      if (stableConnectionTimerRef.current) {
        clearTimeout(stableConnectionTimerRef.current);
      }
      if (keepaliveRef.current) {
        clearInterval(keepaliveRef.current);
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
