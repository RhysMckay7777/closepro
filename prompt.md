You have already implemented the voice reliability and voice‑mapping changes. Now apply Connor’s UI feedback from his Loom video.

Goal: On the live roleplay page (/dashboard/roleplay/[sessionId]), visually separate the user (closer) and the AI prospect into distinct tiles, and improve the camera behavior.

Important constraints:

Do not touch any scoring logic, API routes, or voice connection code.

Only change layout / styling / small component structure in the React files for the roleplay session.

Keep all existing text, transcript, and control functionality intact.

Requirements from Connor (UI/UX)
Separate tiles for user vs prospect

Left side: the user/closer tile.

Right side: the AI prospect tile.

They should look like two participants on a Zoom call.

Keep the vertical divider concept Connor liked.

Prospect tile (right)

No video for the agent.

Show the current context card (avatar + name + context + what you’re selling) in this tile.

Increase font size for:

Prospect name.

Context paragraph.

“What you’re selling” / role context.

Tile should be larger than the current small card, centered vertically in the right half.

User tile (left)

When camera is off:

Show user avatar / initials as we do today.

When camera is on:

Replace the small circle with a larger video tile that fills most of the left half (similar to a Zoom participant tile).

Under/over the tile, keep the “LIVE” label and role (“Closer” or user name) as appropriate.

Overall layout

Use a two‑column layout on desktop:

grid grid-cols-2 or equivalent.

Left = user/closer, right = prospect.

Keep the background gradient and overall aesthetic.

The control bar (mic, speaker, camera, end call, switch to text mode) should stay at the bottom, centered, spanning the full width.

Transcript panel

The transcript / pinned / notes sidebar on the right edge must remain unchanged in functionality.

Ensure the new two‑tile layout fits to the left of this sidebar (so effectively a three‑column page: left user tile, center prospect tile, right transcript sidebar).

If needed, you can treat “user + prospect tiles” as a single centered block, with the transcript sidebar occupying fixed width on the far right.

Files to edit
Primarily:

app/dashboard/dashboard/roleplay/[sessionId]/page.tsx

Where the current roleplay layout and header are defined.

Any small supporting components for the prospect card (if they exist) to adjust typography.

Do not change:

use-voice-session.ts

API routes

Scoring or analysis components

Implementation details
Refactor the main content area into a container with:

A flex or grid layout that places:

Left: user tile.

Right: prospect tile.

Ensure it is responsive; on smaller screens you can stack vertically (user above prospect), but desktop should match Connor’s Loom (two tiles side‑by‑side).

Prospect tile:

Reuse the existing context card content (avatar, name, description, role context).

Increase font size by one step (e.g. text-base → text-lg, text-sm → text-base) for name and main description.

Make the card itself wider/taller to feel like a video tile.

User tile:

Integrate camera state:

If camera off: show current avatar and name.

If camera on: render the video element in a large rectangle (16:9 if possible), with rounded corners.

If there is already a camera/video component, reuse it and just change its placement and size.

Styling:

Keep design consistent with existing ClosePro theme (colors, radii, shadows).

Maintain the small “Role context” dropdown or label under the prospect tile, if present now.

Testing checklist:

Voice roleplay with camera off: layout shows two tiles, prospect speaking, transcript updates.

Turn camera on: left side shows large video tile, right side prospect card unchanged.

Resize window to smaller width: layout remains usable (tiles can stack).

Text mode roleplay (if accessible from this page) still works with the new layout.

After implementing, summarize the changes and show the relevant JSX/TSX diffs only, so we can review before merging.

