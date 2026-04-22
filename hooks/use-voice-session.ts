'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useConversation } from '@elevenlabs/react';
import type { Status } from '@elevenlabs/react';
import { reportClientError } from '@/lib/report-client-error';

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
  const wsAliveRef = useRef(false); // Track if WebSocket is in a usable state
  const reconnectHaltedRef = useRef(false); // Track if reconnection was explicitly stopped

  // Stable connection timer — only reset attempt counter after 10s of stable connection
  const stableConnectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rapid reconnect detection — track timestamps of recent reconnects
  const reconnectTimestampsRef = useRef<number[]>([]);

  // Ref to hold the conversation instance — bridges the circular dependency
  const conversationRef = useRef<ReturnType<typeof useConversation> | null>(null);

  // Cache signed URL + voiceId to reuse within its validity window (avoids voice config changes mid-session)
  const signedUrlCacheRef = useRef<{ url: string; dynamicVariables: any; voiceId: string | null; createdAt: number } | null>(null);

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
      reportClientError('use-voice-session', 'Failed to persist transcript', { sessionId });
    }
  }, [sessionId]);

  /**
   * Get or fetch a signed URL. Reuses the cached URL if less than 8 minutes old
   * to prevent voice config changes mid-session on reconnect.
   */
  const getOrFetchSignedUrl = useCallback(async (): Promise<{ signedUrl: string; dynamicVariables: any; voiceId: string | null }> => {
    // Reuse existing URL if less than 8 minutes old (signed URLs valid ~10 minutes)
    if (
      signedUrlCacheRef.current &&
      Date.now() - signedUrlCacheRef.current.createdAt < 8 * 60 * 1000
    ) {
      return {
        signedUrl: signedUrlCacheRef.current.url,
        dynamicVariables: signedUrlCacheRef.current.dynamicVariables,
        voiceId: signedUrlCacheRef.current.voiceId,
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
    const voiceId = data.voiceId || null;

    // Cache it (including voiceId so reconnections use the same voice)
    signedUrlCacheRef.current = {
      url,
      dynamicVariables: data.dynamicVariables,
      voiceId,
      createdAt: Date.now(),
    };

    return { signedUrl: url, dynamicVariables: data.dynamicVariables, voiceId };
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
    reportClientError('use-voice-session', `Halting reconnection: ${message}`, { sessionId });
    console.error('[VoiceSession] HALTED:', message);
    isReconnectingRef.current = false;
    reconnectHaltedRef.current = true; // Prevent onError from overriding
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


    setVoiceStatus('connecting');
    setError(null);
    onStatusChange?.('connecting');

    // Exponential backoff: 2s, 4s, 8s
    const delay = BASE_RECONNECT_DELAY_MS * Math.pow(2, attempt - 1);

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

      // Only clear signed URL cache if it's > 8 minutes old; otherwise reuse for voice consistency
      if (
        signedUrlCacheRef.current &&
        Date.now() - signedUrlCacheRef.current.createdAt > 8 * 60 * 1000
      ) {
        signedUrlCacheRef.current = null;
      }
      const { signedUrl, dynamicVariables, voiceId } = await getOrFetchSignedUrl();

      if (!conv) {
        throw new Error('Conversation instance not available');
      }

      // Build conversation context from transcript so AI continues where it left off
      const history = transcriptRef.current;
      let reconnectDynamicVars = { ...dynamicVariables };
      if (history.length > 0) {
        const transcript = history
          .slice(-20) // Last 20 messages to avoid exceeding context limits
          .map((m) => `${m.role === 'rep' ? 'Closer' : 'Prospect'}: ${m.content}`)
          .join('\n');
        reconnectDynamicVars = {
          ...dynamicVariables,
          conversation_context: `IMPORTANT: This is a reconnected session. The conversation was already in progress. Here is the transcript so far:\n\n${transcript}\n\nContinue the conversation naturally from where it left off. Do NOT restart. Do NOT say generic greetings.`,
        };
      }

      // Pass voice override so reconnection uses the SAME voice as the original session
      await conv.startSession({
        signedUrl,
        dynamicVariables: reconnectDynamicVars,
        overrides: voiceId ? { tts: { voiceId } } : undefined,
      });


    } catch (err: any) {
      reportClientError('use-voice-session', `Reconnect attempt ${attempt} failed: ${err?.message}`, { sessionId });
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
      console.log('[VoiceSession] ✅ Connected successfully');
      hasConnectedRef.current = true;
      wsAliveRef.current = true;
      isReconnectingRef.current = false;
      reconnectHaltedRef.current = false;
      setReconnectFailed(false);
      setError(null);

      // Record connection start for immediate-drop detection
      connectionStartTimeRef.current = Date.now();

      // Keepalive heartbeat: send empty contextual update every 15s to prevent
      // ElevenLabs from closing the WebSocket due to inactivity.
      // Works alongside inactivity_timeout=180 on the signed URL.
      if (keepaliveRef.current) clearInterval(keepaliveRef.current);
      keepaliveRef.current = setInterval(() => {
        if (!wsAliveRef.current) return; // Don't send on dead socket
        try {
          conversationRef.current?.sendContextualUpdate('');
        } catch {
          // Silently ignore — connection may be closing
        }
      }, 15_000);

      // DON'T reset reconnectAttemptsRef immediately — wait for stable connection.
      // If the connection drops within 10s, we keep the current attempt count.
      if (stableConnectionTimerRef.current) {
        clearTimeout(stableConnectionTimerRef.current);
      }
      stableConnectionTimerRef.current = setTimeout(() => {

        reconnectAttemptsRef.current = 0;
        stableConnectionTimerRef.current = null;
      }, STABLE_CONNECTION_THRESHOLD_MS);
    },
    onDisconnect: (...disconnectArgs: unknown[]) => {
      wsAliveRef.current = false; // Mark socket as dead immediately
      const connectionDuration = connectionStartTimeRef.current
        ? Date.now() - connectionStartTimeRef.current
        : Infinity;
      // DIAGNOSTIC 2026-04-22: capture anything the SDK passes into onDisconnect (close code,
      // reason, details) and ship it to the server log sink so we can diagnose ElevenLabs
      // closes without dashboard access. See docs/legacy/2026-04-22-voice-diagnostic.md.
      const disconnectDetails = disconnectArgs.map((a) => {
        if (a && typeof a === 'object') {
          const rec = a as Record<string, unknown>;
          return {
            code: rec.code,
            reason: rec.reason,
            wasClean: rec.wasClean,
            message: rec.message,
            type: rec.type,
            keys: Object.keys(rec),
          };
        }
        return { value: a };
      });
      console.warn(`[VoiceSession] ❌ Disconnected after ${Math.round(connectionDuration / 1000)}s (intentional: ${intentionalDisconnectRef.current})`, { disconnectDetails });
      reportClientError('use-voice-session', 'Voice disconnected', {
        sessionId,
        connectionDurationMs: connectionDuration,
        intentional: intentionalDisconnectRef.current,
        hasConnectedPreviously: hasConnectedRef.current,
        disconnectDetails,
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
    onError: (message: string, ...errorExtra: unknown[]) => {
      // DIAGNOSTIC 2026-04-22: capture any extra args the SDK passes alongside the message.
      // Some SDK versions emit structured payloads with close codes or cause data.
      // See docs/legacy/2026-04-22-voice-diagnostic.md.
      const extraDetails = errorExtra.map((a) => {
        if (a && typeof a === 'object') {
          const rec = a as Record<string, unknown>;
          return {
            code: rec.code,
            reason: rec.reason,
            type: rec.type,
            name: rec.name,
            message: rec.message,
            keys: Object.keys(rec),
          };
        }
        return { value: a };
      });
      console.error('[VoiceSession] ⚠️ Error:', message, { extraDetails, halted: reconnectHaltedRef.current, alive: wsAliveRef.current, reconnecting: isReconnectingRef.current });
      reportClientError('use-voice-session', `Voice error: ${message}`, { sessionId, extraDetails });

      // If reconnection was explicitly halted, don't do anything else
      if (reconnectHaltedRef.current) {
        return;
      }

      // WebSocket CLOSING/CLOSED errors — suppress if socket is already dead
      // to prevent the reconnect → endSession → more errors → reconnect loop
      const isClosingError =
        message.includes('CLOSING') ||
        message.includes('CLOSED');

      if (isClosingError && !wsAliveRef.current) {
        // Socket is already dead — just suppress, don't cascade
        return;
      }

      // Mark socket as dead on any WebSocket error
      const isWebSocketError =
        isClosingError ||
        message.includes('WebSocket') ||
        message.includes('connection');

      if (isWebSocketError) {
        wsAliveRef.current = false;
      }

      if (isWebSocketError && hasConnectedRef.current && !isReconnectingRef.current) {
        attemptReconnect();
      } else if (!isClosingError) {
        // Only surface non-WebSocket errors to the user
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

      // Turn gating: after user speaks, if < 4 prospect turns, remind AI to stay brief and avoid objections
      if (props.role === 'user') {
        const prospectTurns = transcriptRef.current.filter(e => e.role === 'prospect').length;
        if (prospectTurns < 4 && wsAliveRef.current) {
          try {
            conversationRef.current?.sendContextualUpdate(
              'NO OBJECTIONS YET. Keep responses to 1-2 sentences. Be neutral and conversational.'
            );
          } catch {
            // Silently ignore — connection may not be ready
          }
        }
      }
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

      setVoiceStatus('connecting');
      setError(null);
      setReconnectFailed(false);
      intentionalDisconnectRef.current = false;
      hasConnectedRef.current = false;
      reconnectAttemptsRef.current = 0;
      reconnectHaltedRef.current = false;
      isReconnectingRef.current = false;
      reconnectTimestampsRef.current = [];
      sessionStartRef.current = Date.now();
      transcriptRef.current = [];
      lastPersistedIndexRef.current = 0;

      if (stableConnectionTimerRef.current) {
        clearTimeout(stableConnectionTimerRef.current);
        stableConnectionTimerRef.current = null;
      }

      // Pre-check microphone permission to give a clear error before connecting
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Immediately release the stream — ElevenLabs will request its own
        stream.getTracks().forEach(track => track.stop());
        console.log('[VoiceSession] Microphone access confirmed');
      } catch (micErr: any) {
        const micMessage = micErr?.name === 'NotAllowedError'
          ? 'Microphone access denied — please allow microphone permission in your browser settings and try again.'
          : micErr?.name === 'NotFoundError'
            ? 'No microphone found — please connect a microphone and try again.'
            : `Microphone error: ${micErr?.message || 'unknown'}`;
        console.error('[VoiceSession] Microphone pre-check failed:', micMessage);
        setError(micMessage);
        setVoiceStatus('disconnected');
        onError?.(micMessage);
        return;
      }

      // Fetch signed URL (or reuse cached) + overrides from our API
      clearVoiceCache(); // Clear stale cache from previous session
      const { signedUrl, dynamicVariables, voiceId } = await getOrFetchSignedUrl();
      console.log('[VoiceSession] Starting session with signed URL', voiceId ? `(voice: ${voiceId})` : '(no voice override)');

      // Pass dynamic variables + voice override to lock the prospect voice for the entire session
      await conversation.startSession({
        signedUrl,
        dynamicVariables,
        overrides: voiceId ? { tts: { voiceId } } : undefined,
      });

      // Start periodic persistence timer (every 30s)
      if (persistTimerRef.current) clearInterval(persistTimerRef.current);
      persistTimerRef.current = setInterval(persistTranscript, 30000);
    } catch (err: any) {
      const message = err?.message || 'Failed to start voice session';
      reportClientError('use-voice-session', `Start failed: ${message}`, { sessionId });
      console.error('[VoiceSession] Start failed:', message);
      setError(message);
      setVoiceStatus('disconnected');
      onError?.(message);
    }
  }, [sessionId, conversation, persistTranscript, onError, getOrFetchSignedUrl, clearVoiceCache]);

  const endVoice = useCallback(async () => {

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
