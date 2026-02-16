In app/(dashboard)/dashboard/roleplay/[sessionId]/page.tsx, the "End Call" confirmation dialog is stuttering and causing visible layout jank when it opens.

Fix this without changing behaviour:

Portal the modal to the top level

Ensure the end-call confirmation dialog is rendered at the root of the page (outside the main tile layout), in a fixed inset-0 z-[999] container with backdrop, so opening it does not affect the flex sizing of the tiles.

Separate UI state from heavy work

When the "End Call" button is clicked in VoiceSessionControls, only set showEndSessionDialog = true.

Inside the dialog:

"Cancel" just toggles showEndSessionDialog = false.

"End Session" does the heavy work: call endVoice(), trigger scoring, navigate, etc. Do not run these side effects on the same click that shows the modal.

Stabilise animations

Use Tailwind transitions only on the modal panel itself, not on the entire page:

Backdrop: fixed inset-0 bg-black/60 transition-opacity.

Panel: transition-all duration-200 ease-out with simple scale/opacity.

Make sure the main roleplay layout container does not change any classes when the modal is open (no opacity blur or scale on the background).

Performance sanity checks

Confirm that opening/closing the dialog does not trigger extra renders of the voice tiles beyond the state change (avoid passing the entire session object into the modal if possible; pass only the callbacks and minimal data).

After changes, clicking "End Call" should:

Instantly show the dialog with a smooth fade/scale.

Not cause the tiles to move or jitter.

Only run endVoice() and scoring when the user confirms, not when the dialog appears.