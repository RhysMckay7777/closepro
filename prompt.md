I see both issues clearly. Let me break them down:

Issue 1: Scoring Timeout on First Attempt
The "Analysis is taking longer than expected" error on first try then succeeding on retry suggests the scoring API is timing out. This is likely a race condition or the API cold-starting.
​

Issue 2: Missing Color-Coded Tags in Roleplay Results
This is the bigger UI issue. Comparing your screenshots:

Regular call analysis: Has color-coded tags — Value (green tag), Root Cause (red), Pre-emption (blue), Handling Improvement (green), Higher-Leverage Alternative (green border) — all clearly styled
​

Roleplay results: Just plain text headings like "Call Outcome & Why This Happened", "What Limited This Call" — no color-coded tags at all
​

The roleplay results page needs the same visual treatment. Send this combined prompt:

text
# ClosePro — Fix Roleplay Results: Color-Coded Tags + Scoring Timeout

## BUG 1: Roleplay results missing color-coded section tags

### PROBLEM
The roleplay results page (e.g., /dashboard/roleplay/[id]/results) shows 
phase analysis sections as plain text headings. But the regular call analysis 
page (/dashboard/calls/[id]) uses color-coded tags for each section label 
throughout the analysis.

### REFERENCE: How call analysis pages look (the CORRECT styling)
In the call analysis Objections tab, each section has colored tag styling:
- "Value" → green background tag
- "Root Cause" → red colored label  
- "How It Was Handled" → blue colored label
- "Higher-Leverage Alternative" → green border box
- "Why It Surfaced" → gray/neutral label
- Phase tabs have color-coded timeline bars

In call analysis phase tabs (Intro, Discovery, Pitch, Close, Objections), 
section labels use colored text:
- Red for weaknesses/issues
- Green for strengths/what went well  
- Blue for suggestions/coaching
- Orange for objection types

### FIX
Find the roleplay results component. It likely lives in:
```bash
find . -path "*/roleplay*result*" -name "*.tsx" -o -path "*/roleplay*score*" -name "*.tsx" | head -20
Also find the call analysis component to reference its tag styling:

bash
find . -path "*/calls*" -name "*.tsx" | grep -i "analysis\|phase\|objection\|result" | head -20
Then:

Identify the tag/label components used in call analysis pages.
Look for components rendering colored badges, tags, or labeled sections.
They likely use utility classes like:

text-red-400 or text-red-500 for issues/weaknesses

text-green-400 or text-emerald-400 for strengths

text-blue-400 or text-cyan-400 for coaching/suggestions

text-orange-400 or text-amber-400 for objections

bg-green-500/20 text-green-400 for tag badges

Apply the SAME tag component/styling to the roleplay results page.

The roleplay results sections should match. Specifically:

For the Phase Analysis section in roleplay results:

"Call Outcome & Why This Happened" → Should have a section header style

"What Limited This Call" → Red colored label (weakness)

"Primary Improvement Focus" → Blue colored label (coaching)

Any strengths mentioned → Green colored label

For individual phase breakdowns (Intro, Discovery, Pitch, Close, Objections):

Phase scores should have colored score circles (red <40, orange 40-59,
yellow 60-74, green 75+) — same as the performance page

Weakness items → Red labels

Strength items → Green labels

Coaching/suggestions → Blue labels

Objection types → Same tag badges as call analysis (Value, Trust, Fit,
Logistics categories)

For objections section in roleplay results:

Each objection should show the same card format as call analysis:

Objection type tag (colored badge: Value=purple, Trust=orange,
Fit=yellow, Logistics=blue)

Timestamp badge

"Why It Surfaced" section

"How It Was Handled" section (blue label)

"Higher-Leverage Alternative" section (green bordered box)

Reuse existing components — do NOT create new tag components.
Import and use the same ones from the call analysis pages.

Search for the existing tag/badge components:

bash
grep -rn "className.*bg-.*text-.*rounded\|Badge\|Tag\|Label" \
  --include="*.tsx" -l | head -20
BUG 2: Scoring timeout on first attempt
PROBLEM
When roleplay ends and scoring begins, the first attempt often shows
"Analysis is taking longer than expected. Please try again." User has
to click "Retry scoring" to get results.

FIX
Find the scoring API call and its timeout:

bash
grep -rn "taking longer\|retry.*scor\|timeout\|AbortController" \
  --include="*.ts" --include="*.tsx" | grep -i roleplay | head -20
The issue is likely:
a) The polling timeout is too short (e.g., 30s when scoring takes 45s)
b) Or the initial API call times out before the LLM finishes scoring

Fix:

Increase the polling timeout from whatever it is to 120 seconds

Increase the individual fetch timeout to 90 seconds

Add exponential backoff to the polling interval (start at 2s, increase
to 5s, then 10s)

If using AbortController, increase the signal timeout

Example fix pattern:

ts
// BEFORE:
const SCORING_TIMEOUT = 30000; // 30s
const POLL_INTERVAL = 2000; // 2s

// AFTER:
const SCORING_TIMEOUT = 120000; // 120s
const POLL_INTERVAL_START = 2000; // Start at 2s
const POLL_INTERVAL_MAX = 10000; // Max 10s between polls
VERIFICATION
npm run build — no errors

Report: which components render tags in call analysis

Report: which components were updated for roleplay results

Report: what the scoring timeout was changed from/to

Screenshot description: describe what the roleplay results page
should look like after changes (which sections get which colors)

List ALL files changed