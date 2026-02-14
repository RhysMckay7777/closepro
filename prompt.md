PROMPT B-FIX: 3 Bug Fixes (Timestamps, Performance Empty, Cash Collected £0)
CONTEXT
These are bugs found after deploying Prompt B. All 3 are small but critical. Fix each one independently.

BUG 1: Transcript Timestamps Showing Raw Numbers Instead of MM:SS
What's Happening
The TranscriptView component on the call detail page shows timestamps like [36925:10], [36987:50], [37089:09] instead of proper MM:SS format like [06:09].

Root Cause
The transcriptJson data from Deepgram/STT stores timestamps as raw seconds (floats like 3692.5), but they may also come in milliseconds, centiseconds, or other formats depending on the STT provider. The TranscriptView component is displaying them raw without converting to MM:SS.

There are two possible failure modes:

The transcriptJson array has start values as raw large numbers (seconds from epoch or milliseconds) and the MM:SS formatter isn't being applied

The component is falling back to the raw transcript string which has raw timestamps baked in, instead of using the structured transcriptJson

Fix
In components/call-review/TranscriptView.tsx:

Find the timestamp formatting function (or create one if missing):

typescript
function formatTimestamp(rawSeconds: number): string {
  // Handle various input formats
  let seconds = rawSeconds;

  // If the value is unreasonably large, it might be in milliseconds
  // A typical call is under 2 hours = 7200 seconds
  if (seconds > 36000) {
    // Likely milliseconds (> 10 hours in seconds)
    seconds = seconds / 1000;
  }
  if (seconds > 36000) {
    // Still too large — might be centiseconds or deciseconds
    seconds = seconds / 10;
  }
  if (seconds > 36000) {
    seconds = seconds / 10;
  }

  // Now seconds should be a reasonable number
  const totalSeconds = Math.floor(seconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
Apply it to every timestamp in the render. Find where utterance.start or the timestamp value is rendered and wrap it with formatTimestamp().

Also check: If the component falls back to displaying the raw transcript string when transcriptJson is null/empty, add a regex-based cleanup that finds patterns like [LARGE_NUMBER:XX] and converts them:

typescript
function cleanRawTranscriptTimestamps(text: string): string {
  // Match patterns like [36925:10] or [36925.10]
  return text.replace(/\[(\d{3,})[:.](\d+)\]/g, (match, startRaw) => {
    const num = parseFloat(startRaw);
    return `[${formatTimestamp(num)}]`;
  });
}
If the issue is in the raw transcript text being displayed (not transcriptJson), apply cleanRawTranscriptTimestamps to the transcript prop before rendering.

IMPORTANT: Also check the transcriptJson parsing in the call status/detail API. The transcriptJson should be an array of objects like { speaker: string, text: string, start: number }. If the start values are already large numbers, the formatting function above handles it. But make sure transcriptJson is actually being passed to the component — check the call detail page API response to ensure transcriptJson is not null.

BUG 2: Performance Page Shows "No Scored Sessions Yet" Despite Having Analyzed Calls
What's Happening
The Core Sales Principles card and Priority Action Steps card both show empty state messages, even though the user has completed call analyses.

Root Cause
The most likely issue is a date range mismatch. The performance page defaults to a date range (e.g., "This Week", "This Month") that doesn't include the user's analyzed calls. Or the skillCategories computation is returning an empty array because the analysis data format doesn't match what the API expects.

Fix — Check ALL of these in order:
Step 1: Check the default date range on the performance page

In app/(dashboard)/dashboard/performance/page.tsx, find the default range state:

typescript
const [range, setRange] = useState('thisweek'); // or whatever the default is
If the default is 'thisweek' and the user analyzed calls outside this week, the data will be empty. Change the default to 'alltime' so new users see their data immediately:

typescript
const [range, setRange] = useState('alltime');
Step 2: Check the performance API date filtering

In app/api/performance/route.ts, check how allAnalyses is queried. If there's a date range filter that's too restrictive, it might exclude recent calls. Look for:

where clauses filtering by createdAt or callDate

The date range parameters being passed from the frontend

Whether alltime has proper handling (no date filter)

Ensure that when range=alltime, ALL analyses for the user are included without date filtering.

Step 3: Check the allSkillCategories computation

In the performance API, allSkillCategories is built from allAnalyses. Check:

Are the analyses being fetched? Add a console.log('Performance API: found', allAnalyses.length, 'analyses') temporarily.

Does the analysis JSON actually contain categoryScores or scores? The shape of the stored analysis might differ from what the code expects. Check what field name is used to extract per-category scores.

Does the DISPLAY_NAME_TO_ID mapping in the principleSummaries computation match the actual category names returned by the AI? For example, if the AI returns "Objection Handling" but the mapping expects "objection_handling", it won't match.

Step 4: Add defensive logging

In app/api/performance/route.ts, right before computing principleSummaries, add:

typescript
console.log('Performance API debug:', {
  totalAnalyses: allAnalyses.length,
  skillCategoriesCount: allSkillCategories.length,
  sampleCategories: allSkillCategories.slice(0, 3).map(c => ({ cat: c.category, avg: c.averageScore })),
});
This will help diagnose whether the issue is no analyses, no skill categories, or a mapping problem.

BUG 3: Cash Collected Shows £0.00 for Future Month Instalments
What's Happening
When changing the month filter to March 2026, the instalments for that month show £0.00 cash collected, £0.00 revenue, and £0.00 commission. The status shows "pending".

What Connor Said
"Let's assume that the cash had been collected for the next month, and then the person has the option to delete that out if that's not true."

Root Cause
In app/api/performance/figures/route.ts, the instalment loop (~line 306-314) has:

typescript
cashCollected: instStatus === 'collected' ? inst.amountCents : 0,
This shows £0 for any instalment with status pending. But Connor's requirement is to ASSUME collection — show the full amount, and let the user delete the row if it wasn't actually collected.

Fix
In app/api/performance/figures/route.ts, in the instalment processing loop:

Change this:

typescript
// Commission only counts for collected instalments
const commAmt = instStatus === 'collected'
  ? (inst.commissionAmountCents ?? Math.round(inst.amountCents * pct / 100))
  : 0;
salesList.push({
  ...
  cashCollected: instStatus === 'collected' ? inst.amountCents : 0,
  ...
  commissionAmount: commAmt,
  ...
});
To this:

typescript
// ASSUME all instalments are collected (Connor: "assume cash had been collected")
// User can delete the row if the cash wasn't actually collected
const commAmt = inst.commissionAmountCents ?? Math.round(inst.amountCents * pct / 100);
salesList.push({
  ...
  cashCollected: inst.amountCents,  // Always show the amount — assumed collected
  ...
  commissionAmount: commAmt,       // Always calculate commission
  ...
});
Also: Remove the opacity-50 styling for pending instalments in the figures page UI, since all instalments are now treated as collected:

In app/(dashboard)/dashboard/performance/figures/page.tsx, find:

tsx
<tr ... className={`border-b border-border/50${row.instalmentStatus === 'pending' ? ' opacity-50' : ''}`}>
Change to:

tsx
<tr ... className="border-b border-border/50">
And remove the "— pending" / "— missed" status labels from the instalment display since they're no longer relevant to the amounts shown. Keep the instalment number label (e.g., "instalment 2/4") but drop the status word.

Keep the instalmentStatus field in the API response — it's still useful for informational purposes, but it should NOT affect the displayed amounts.

BUILD VERIFICATION
After all 3 fixes:

npm run build must exit code 0

Test with a call that has a 56+ minute audio file — timestamps should show MM:SS

Check Performance page with "All Time" range — principles should show data

Check Figures page for month 2+ of a payment plan — cash collected should show the instalment amount, not £0