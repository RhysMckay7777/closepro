Fix the ElevenLabs WebSocket immediate disconnect loop. Do not change any scoring, analysis, or dashboard logic.

The console shows: Connected → WebSocket CLOSING/CLOSED → Disconnected → Reconnecting 1/3 in an infinite cycle. The connection drops immediately after connecting — the prospect never speaks.

Step 1: Diagnose the signed URL flow
In app/api/roleplay/[sessionId]/voice-token/route.ts:

Log the full ElevenLabs signed URL response (status code, body) before returning it to the client.

Log the exact payload you're sending to https://api.elevenlabs.io/v1/convai/conversation/get_signed_url — confirm agent_id matches ELEVENLABS_AGENT_ID env var.

If the agent has dynamic variables configured, ensure they are passed in the startSession overrides on the client side.

Step 2: Check @11labs/react version
Run npm ls @11labs/react and log the version. If it's below 0.2.0, update to latest.

Step 3: Add keepalive
In hooks/use-voice-session.ts, after a successful connection, send a keepalive ping every 15 seconds to prevent the WebSocket from closing due to inactivity. ElevenLabs closes idle connections after 20 seconds. Use:

typescript
// Inside onConnect callback or after startSession resolves
keepaliveRef.current = setInterval(() => {
  // The @11labs/react SDK handles this internally in newer versions
  // but if on older version, this prevents idle timeout
}, 15000);
Clear the interval in onDisconnect and endVoice.

Step 4: Prevent reconnect on immediate drop
In attemptReconnect, before retrying, check if the connection lasted less than 2 seconds. If it did, this is NOT a network glitch — it's a config error. Do NOT retry. Instead, set error state to: "Voice connection rejected — check ElevenLabs agent configuration" and stop.

Step 5: Deploy and check Vercel logs
After deploying, start a voice roleplay and check the Vercel function logs for the voice-token route. We need to see:

Was the signed URL generated successfully (200 from ElevenLabs)?

What agent_id was used?

Were any dynamic variables expected but missing?

Problem 2: Control Bar Still Not Visible
Your screenshots confirm the control bar (mic, camera, end call) is still below the viewport. The previous min-h-0 fix wasn't enough because the prospect tile content is very long (the full backstory text for "Jared Morgan" is pushing the tile height beyond what overflow-y-auto can contain within the flex layout).

Add this to the same Claude Code session:

Fix the control bar being pushed off-screen — it must always be visible at the bottom.

In app/(dashboard)/dashboard/roleplay/[sessionId]/page.tsx, the current flex column layout is:

text
Header (shrink-0)
Avatar area (flex-1 min-h-0)
Control bar (shrink-0)
The problem: the avatar area's inner content (two tiles + long prospect description) still overflows because the outer voice content wrapper doesn't enforce h-full min-h-0 overflow-hidden.

Fix:

The outermost fixed inset-0 flex flex-col container must have h-screen (or h-dvh for mobile).

The middle section (between header and control bar) must be flex-1 min-h-0 overflow-hidden — this is the hard ceiling.

Inside that, the two-tile container must use max-h-full overflow-hidden.

Each tile must use min-h-0 overflow-y-auto so content scrolls inside the tile.

Critically: check if there's a wrapper div around renderAvatarArea() and VoiceSessionControls that doesn't have min-h-0. Every flex parent in the chain from the fixed container to the tiles must have min-h-0.

The VoiceSessionControls component must be a direct child of the outermost flex-col, with shrink-0, so it's always pinned at the bottom.

Test: with the Jared Morgan prospect (long description text), the control bar must be visible without scrolling on a 1080p display.

