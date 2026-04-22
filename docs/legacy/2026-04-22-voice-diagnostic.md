# Voice Session Diagnostic Changes — 2026-04-22

## Context

Production voice roleplays were dropping the ElevenLabs Conversational AI
WebSocket after 13–16 seconds with `intentional: false`. The prospect's
first message would play once, the user's microphone worklet would try to
send audio into an already-closing WebSocket, and the session would loop
reconnect → re-greet → drop.

We do **not** have access to the ElevenLabs agent dashboard (credentials
held by a previous developer), so we cannot inspect:

- Whether the agent's system prompt contains `{{placeholder}}` variables
- Whether the agent's LLM backend has a valid API key
- Whether "Allow overrides" is enabled for the agent's fields
- The server-side close reason ElevenLabs logged for the session

Two blind changes were applied as Option A of a triage plan:

1. **Strip custom query params from the signed URL.** The server had been
   appending `&inactivity_timeout=180&turn_end_threshold=0.8` to the signed
   URL returned by ElevenLabs. These params may have been invalidating the
   URL signature or being misinterpreted by the WebSocket handshake.
2. **Enrich `onDisconnect` / `onError` logging** in the voice session hook
   so the next failed session reports WebSocket close code, close reason,
   and any SDK-provided metadata to the server log sink
   (`/api/log/client-error`), which is visible in Vercel's Logs tab.

If the first change is the fix, great. If not, the richer logs tell us
what ElevenLabs is actually saying when it closes the WS, and we can
diagnose without dashboard access.

## Files modified

- `app/api/roleplay/[sessionId]/voice-token/route.ts`
- `hooks/use-voice-session.ts`

## Legacy code (pre-change, verbatim)

### `app/api/roleplay/[sessionId]/voice-token/route.ts` — lines 301–304

```ts
    // Extend ElevenLabs idle timeout from 20s (default) to 180s (max)
    // Also increase silence duration for better turn-taking (800ms instead of default ~300ms)
    const separator = rawSignedUrl.includes('?') ? '&' : '?';
    const signedUrl = `${rawSignedUrl}${separator}inactivity_timeout=180&turn_end_threshold=0.8`;
```

### `hooks/use-voice-session.ts` — `onDisconnect` handler (lines 291–331)

```ts
    onDisconnect: () => {
      wsAliveRef.current = false; // Mark socket as dead immediately
      const connectionDuration = connectionStartTimeRef.current
        ? Date.now() - connectionStartTimeRef.current
        : Infinity;
      console.warn(`[VoiceSession] ❌ Disconnected after ${Math.round(connectionDuration / 1000)}s (intentional: ${intentionalDisconnectRef.current})`);



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
```

### `hooks/use-voice-session.ts` — `onError` handler (lines 332–340)

```ts
    onError: (message: string) => {
      console.error('[VoiceSession] ⚠️ Error:', message, { halted: reconnectHaltedRef.current, alive: wsAliveRef.current, reconnecting: isReconnectingRef.current });
      reportClientError('use-voice-session', `Voice error: ${message}`, { sessionId });

      // If reconnection was explicitly halted, don't do anything else
      if (reconnectHaltedRef.current) {
        return;
      }
```

## How to revert

If these diagnostic changes need to be rolled back, restore the snippets
above verbatim, or `git revert` the diagnostic commit:

```bash
# Find the commit
git log --oneline --grep="voice diagnostic"

# Revert it
git revert <sha>
```

## Expected behaviour after the change

- **Best case:** stripping the custom query params was the fix — voice
  sessions stay connected and turns are processed normally.
- **Worst case:** voice sessions still drop, but the next test run will
  write a richer `[CLIENT:ERROR]` line to Vercel Logs containing the
  WebSocket close code/reason and any SDK metadata. Search Vercel Logs
  for `component=use-voice-session` after the next test.
