Fix two critical bugs in the roleplay voice session — do not change any API routes or scoring logic.

Bug 1: Reconnection infinite loop
In hooks/use-voice-session.ts, the reconnect logic has a loop:

onConnect resets reconnectAttemptsRef.current = 0

Connection drops immediately after reconnect

attemptReconnect sees attempts = 0, so it always retries

This creates an infinite connect → disconnect → reconnect cycle

Fix:

Do NOT reset reconnectAttemptsRef to 0 on onConnect. Instead, reset it only when the connection has been stable for at least 10 seconds (use a timeout).

Add a reconnectsInWindowRef that tracks how many reconnects happened in the last 60 seconds. If more than 5 reconnects in 60 seconds, stop trying and set status to 'error' with message "Connection unstable — please try again or switch to text mode."

Between each reconnect attempt, add an increasing delay: attempt 1 = 2s, attempt 2 = 4s, attempt 3 = 8s (exponential backoff).

After all 3 attempts fail OR after detecting the rapid-reconnect loop, show the error state and stop retrying.

Bug 2: Control bar pushed off-screen
In the roleplay session page (app/(dashboard)/dashboard/roleplay/[sessionId]/page.tsx), the two-tile layout + control bar exceeds viewport height.

Fix:

Make the entire voice mode area fit within 100vh (or calc(100vh - header height)).

Use a flex column layout:

Header bar: fixed height

Two tiles area: flex-1 overflow-hidden (takes remaining space, never overflows)

Control bar: fixed height at the bottom, always visible

The two tiles inside the middle area should use min-h-0 and scale to fit, not push the control bar down.

Ensure the control bar (mic, speaker, camera, end call, switch to text) is always visible and clickable at the bottom of the viewport.

On the prospect tile, if the description text is too long for the available space, make it scrollable within the tile (overflow-y-auto) rather than expanding the tile height.

Test: After changes, the full page (header + tiles + control bar) must fit in a 1080p browser window without any scrolling needed.


