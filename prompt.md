PROMPT 3/5 — PHASE TIMELINE BAR + TRANSCRIPT IMPROVEMENTS
CONTEXT
Connor's V2.1 spec adds a visual timeline bar to phase analysis and fixes transcript display issues.
These are connected: the timeline bar must align with transcript timestamps, and coaching references
must use exact timestamps from the transcript.

STEP 1: AUDIT
bash
# Find phase analysis components
find . -path "*phase*" -name "*.tsx" | head -20
find . -path "*analysis*" -name "*.tsx" | head -20
grep -rn "phase.*tab\|phaseTab\|ActivePhase\|selectedPhase" --include="*.tsx" components/ app/

# Find transcript display components
find . -path "*transcript*" -name "*.tsx" | head -20
grep -rn "Speaker.*A\|Speaker.*B\|speakerA\|speakerB\|speaker.*label" --include="*.tsx" components/ app/
grep -rn "transcript.*line\|TranscriptLine\|transcriptEntry" --include="*.tsx" components/ app/

# Find timestamp handling
grep -rn "timestamp\|startTime\|endTime\|duration" --include="*.ts" --include="*.tsx" lib/ app/ components/

# Find phase detection / phase transition logic
grep -rn "phaseTransition\|detectPhase\|phaseStart\|phaseEnd\|phaseBoundary" --include="*.ts" lib/ app/
Read the entire phase analysis component and transcript display component.

STEP 2: IMPLEMENT 10.1 — Speaker Labels Fix
CURRENT: Shows "Speaker A" and "Speaker B"
REQUIRED: Shows "Closer" and "Prospect"
Find the transcript processing function (where raw transcript is formatted for display)

Replace speaker label logic:

typescript
// OLD
const speakerLabel = speaker === 'A' ? 'Speaker A' : 'Speaker B';

// NEW
const speakerLabel = speaker === 'A' ? 'Closer' : 'Prospect';
// OR if detected by who speaks first / who opened the call:
const speakerLabel = isCloser(speaker) ? 'Closer' : 'Prospect';
Apply this EVERYWHERE transcript lines are displayed:

Main transcript panel

Phase analysis quoted moments

Action step references

Any modal/popup that shows transcript excerpts

STEP 3: IMPLEMENT 10.2 — Timestamp Display on Each Transcript Line
CURRENT: Transcript lines may not show timestamps
REQUIRED: Every line shows [MM:SS] Closer: or [MM:SS] Prospect:
Find where transcript data comes from (transcription API response)

Verify timestamps exist in the raw data (they should from Deepgram/Whisper/AssemblyAI)

Format each line as:

text
[12:43] Closer: So what would that look like for you?
[12:46] Prospect: I think I'd want to…
The timestamp format MUST be [MM:SS] — consistent, zero-padded

Implementation in the transcript component:

typescript
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `[${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}]`;
}

// Each transcript line renders as:
<span className="text-gray-400 font-mono text-sm">{formatTimestamp(line.startTime)}</span>
<span className="font-semibold">{line.speaker === 'closer' ? 'Closer' : 'Prospect'}:</span>
<span>{line.text}</span>
STEP 4: IMPLEMENT SECTION 11 — Timestamp Consistency Between Transcript and Phase Analysis
REQUIREMENT:
All timestamps referenced in coaching output (What Limited Impact, Action Steps, Phase summaries)
MUST match the exact transcript timestamps. No approximations.

Find the AI analysis prompt that generates phase summaries and coaching

ADD this instruction:

text
TIMESTAMP ACCURACY RULE:
When referencing specific moments from the transcript, you MUST use the EXACT [MM:SS]
timestamp from the transcript data provided. Do NOT approximate, round, or estimate
timestamps. Every timestamp you reference must correspond to an actual line in the
transcript.

Format: Always use [MM:SS] format (e.g., [04:23], [12:07], [45:31])
Ensure the full transcript with timestamps is passed to the AI during analysis

Verify that the AI's referenced timestamps appear in the actual transcript

STEP 5: IMPLEMENT SECTION 9 — Phase Analysis Visual Timeline Bar
This is a NEW feature. Create a horizontal timeline bar component.

9.1: OVERALL TAB — Full Timeline
When the "Overall" tab is selected in Phase Analysis:

text
┌──────────────────────────────────────────────────────────────────────┐
│ [INTRO]  [    DISCOVERY     ]  [ PITCH ]  [OBJECTIONS] [  CLOSE  ] │
│  blue       green               purple     orange        teal      │
└──────────────────────────────────────────────────────────────────────┘
                    Total Call Length: 47:32
Full-width thin horizontal bar (h-3 or h-4)

Each phase section is proportionally sized based on duration

Each phase has a distinct color

Below the bar: "Total Call Length: XX:XX"

Phases should have subtle labels on hover or inline if space allows

9.2-9.5: INDIVIDUAL PHASE TABS — Highlight Selected Phase
When clicking Intro, Discovery, Pitch, Close, or Objections:

text
┌──────────────────────────────────────────────────────────────────────┐
│ [░░░░]  [████DISCOVERY█████]  [░░░░░░] [░░░░░░░░░░] [░░░░░░░░░░] │
│  grey       HIGHLIGHTED        grey       grey          grey       │
└──────────────────────────────────────────────────────────────────────┘
           Discovery Length: 21:11
           Started at: 02:47
           Ended at: 23:58
Same full-width bar but only selected phase is colored

All other phases are grey/neutral (bg-gray-200)

Below the bar show:

"[Phase] Length: XX:XX"

"Started at: XX:XX"

"Ended at: XX:XX"

9.6: OBJECTIONS TAB — Special Case
Objections may occur in multiple non-contiguous segments:

text
┌──────────────────────────────────────────────────────────────────────┐
│ [░░░░]  [░░░░░░░░░░░░░░░░░]  [░░░░░░] [████OBJ████] [░░OBJ░░░░] │
│  grey       grey               grey      HIGHLIGHTED    HIGHLIGHTED│
└──────────────────────────────────────────────────────────────────────┘
           Objection Handling Duration: 08:43
           Multiple objection segments occurred.
           Segment 1: 32:10 – 37:22
           Segment 2: 41:05 – 44:36
9.7: TECHNICAL IMPLEMENTATION
Phase Detection: The AI must detect phase transitions during analysis and output timestamps:

text
Add to the AI analysis prompt:

PHASE TIMING DETECTION:
Analyze the transcript and identify the start and end timestamp of each phase:
- Intro: From call start until the first substantive discovery question
- Discovery: From first "why are you here" / situational question until goal setting
- Pitch: From when the closer starts presenting the solution/program
- Objections: From first objection raised until objections are resolved
- Close: From close attempt through to end of call

Output as JSON:
{
  "phaseTimings": {
    "intro": { "start": "00:00", "end": "02:47" },
    "discovery": { "start": "02:47", "end": "23:58" },
    "pitch": { "start": "23:58", "end": "33:12" },
    "objections": { "start": "33:12", "end": "41:55" },
    "close": { "start": "41:55", "end": "47:32" }
  },
  "totalDuration": "47:32"
}

Note: Objections may have multiple segments if they occur at different points.
In that case, use an array: "objections": [{ "start": "33:12", "end": "37:22" }, { "start": "41:05", "end": "44:36" }]
Store phase timings in the analysis results (same place as other analysis data)

Create the TimelineBar component:

typescript
// components/analysis/PhaseTimelineBar.tsx
interface PhaseTimings {
  intro: { start: string; end: string };
  discovery: { start: string; end: string };
  pitch: { start: string; end: string };
  objections: { start: string; end: string } | Array<{ start: string; end: string }>;
  close: { start: string; end: string };
}

interface Props {
  phaseTimings: PhaseTimings;
  totalDuration: string;
  activePhase: 'overall' | 'intro' | 'discovery' | 'pitch' | 'objections' | 'close';
}
Phase colors:

typescript
const PHASE_COLORS = {
  intro:      'bg-blue-500',
  discovery:  'bg-green-500',
  pitch:      'bg-purple-500',
  objections: 'bg-orange-500',
  close:      'bg-teal-500',
};
const PHASE_INACTIVE = 'bg-gray-200';
Integrate into the phase analysis section:

Place the timeline bar BELOW the phase tab row (Overall / Intro / Discovery / Pitch / Close / Objections)

ABOVE the phase content/score

It should be the first thing visible when switching tabs

STEP 6: VERIFY
bash
# Build
npm run build

# Verify timeline component exists
find . -name "*Timeline*" -o -name "*timeline*" | grep -v node_modules

# Verify speaker labels
grep -rn "Closer\|Prospect" --include="*.tsx" components/ | grep -i speaker

# Verify timestamp formatting
grep -rn "formatTimestamp\|MM:SS\|padStart" --include="*.tsx" --include="*.ts" components/ lib/

# Verify phase timing in AI prompt
grep -rn "phaseTimings\|phase.*start.*end\|PHASE TIMING" --include="*.ts" lib/
OUTPUT REQUIRED:
Every file changed

Screenshot/description of the timeline bar in Overall vs individual phase view

Example transcript line showing new format: [12:43] Closer: ...

The phase timing detection prompt addition (full text)

Build status: exit code 0

text

***

# PROMPT 4 OF 5: Dashboard Overhaul — 6 Skill Clusters, Objection Insights, Pattern Aggregation, Coaching Summary

Copy everything below this line and send to agent:

***

PROMPT 4/5 — DASHBOARD & PERFORMANCE PAGE: Skill Clusters, Objection Insights, Patterns, Coaching
CONTEXT
Connor's V2.1 spec requires replacing the old 10-category scoring system on the dashboard with
6 skill clusters aligned to his Sales Philosophy. The dashboard must feel strategic, pattern-based,
and performance-oriented — not just raw data. It must provide directive coaching, not passive metrics.

The three Knowledge Documents govern all logic:

Sales Philosophy & Scoring Framework

Prospect Difficulty Model

AI Coaching Output Rules

STEP 1: AUDIT
bash
# Find dashboard / performance page
find . -path "*dashboard*" -name "*.tsx" | head -20
find . -path "*performance*" -name "*.tsx" | head -20

# Find current 10-category scoring display
grep -rn "scoring.*categ\|categoryScore\|skillScore\|SCORING_CATEGORIES" --include="*.tsx" components/ app/
grep -rn "rapport\|discovery\|pitch\|closing\|objection" --include="*.tsx" components/ app/ | grep -i score

# Find insight/action step aggregation
grep -rn "actionStep\|insight\|pattern\|aggregate" --include="*.tsx" --include="*.ts" components/ app/ lib/

# Read the current scoring categories
cat lib/training/scoring-categories.ts

# Find where scores are aggregated across calls
grep -rn "average\|aggregate\|allCalls\|callHistory\|performanceOver" --include="*.ts" --include="*.tsx" lib/ app/ components/
Read the entire dashboard page and all its sub-components.

STEP 2: IMPLEMENT 4.1 — Replace 10-Category System with 6 Skill Clusters
REMOVE: The old 10-category breakdown from the dashboard display
REPLACE WITH: 6 Connor-aligned skill clusters
Create a mapping file: lib/training/skill-clusters.ts

typescript
/**
 * Skill Clusters — Connor's Sales Philosophy Framework v2.1
 * Maps the 10 scoring categories into 6 strategic skill clusters.
 * Used on the dashboard/performance page for aggregated display.
 */

export const SKILL_CLUSTERS = [
  {
    id: 'authority_leadership',
    name: 'Authority & Leadership',
    description: 'Frame control, confidence, challenging prospects, maintaining expert position throughout the call',
    // Map from existing scoring categories that relate to authority
    sourceCategories: ['tonality_authority', 'frame_control', /* find actual IDs from scoring-categories.ts */],
    icon: 'Shield', // or whatever icon system you use
  },
  {
    id: 'discovery_gap_creation',
    name: 'Discovery & Gap Creation',
    description: 'Questioning depth, uncovering pain, goal setting, getting prospects to self-diagnose their problems',
    sourceCategories: ['discovery_depth', 'questioning', 'needs_analysis', /* actual IDs */],
    icon: 'Search',
  },
  {
    id: 'value_stabilization',
    name: 'Value Stabilization',
    description: 'Pitch effectiveness, social proof usage, program presentation, building perceived value before price reveal',
    sourceCategories: ['pitch_quality', 'value_building', 'social_proof', /* actual IDs */],
    icon: 'TrendingUp',
  },
  {
    id: 'objection_control',
    name: 'Objection Control',
    description: 'Staying calm, using prospect\'s own words, logical workarounds, deposit strategy, never arguing',
    sourceCategories: ['objection_handling', 'resistance_management', /* actual IDs */],
    icon: 'ShieldCheck',
  },
  {
    id: 'closing_decision_leadership',
    name: 'Closing & Decision Leadership',
    description: 'Trial close, assumptive close, urgency creation, deposit taking, handling silence, leading to action',
    sourceCategories: ['closing_technique', 'urgency_creation', /* actual IDs */],
    icon: 'Target',
  },
  {
    id: 'emotional_intelligence',
    name: 'Emotional Intelligence & Adaptation',
    description: 'Reading prospect type (advisee/peer/advisor), adapting tone, managing fight/flight reactions, staying calm under pressure',
    sourceCategories: ['rapport_building', 'adaptability', 'emotional_awareness', /* actual IDs */],
    icon: 'Heart',
  },
] as const;

export type SkillClusterId = typeof SKILL_CLUSTERS[number]['id'];
IMPORTANT: Read the actual SCORING_CATEGORIES from scoring-categories.ts first, then map each
of the 10 existing categories into the appropriate cluster. Every existing category MUST map to exactly
one cluster. Some clusters may have 1-2 source categories, others may have 2-3.

Dashboard display for each cluster:

Cluster name + icon

Aggregated score (average of source category scores across all calls + roleplays)

Score out of 10

Visual indicator: Strength (7+, green), Average (5-6, amber), Weakness (<5, red)

Trend arrow: Improving ↑ / Declining ↓ / Stable → (compare last 5 calls to previous 5)

On click/expand: show breakdown of individual source category scores

STEP 3: IMPLEMENT 4.2 — Objection Handling Insights (Upgrade)
CURRENT: Just counts objections.
REQUIRED: Deep objection intelligence panel.
Create a new component: components/dashboard/ObjectionInsights.tsx

This component must show:

A. Most Common Objection Types
Pull from all analyzed calls and categorize objections into the 6 types:

"I need to think about it"

"I don't have the money"

"I need to check with my partner"

"I've been burned before"

"Is the market saturated?"

"I want to explore other options"

Show frequency count and percentage for each.

B. Current Handling Quality
For each objection type, show the average score when that type appears.
Example: "Think about it" objections → Average handling score: 4.2/10

C. Pre-emption Gaps
Analyze which objections could have been PREVENTED with better discovery/pre-setting.
Logic: If an objection appeared AND the closer did NOT pre-set ammunition for it during
discovery, flag it as a pre-emption gap.
Example: "3 out of 4 'think about it' objections had NO analysis paralysis pre-set during discovery"

D. Margin Leakage Patterns
Track when discounts/concessions are given:

How often discounts are offered

At what stage (too early = before handling the real objection)

Average discount amount

Flag: "Discount given before exploring payment plan alternative" = margin leakage

E. Improvement Recommendation
Generate a specific, actionable text recommendation:
Example: "Focus on pre-setting analysis paralysis during discovery. In 4 out of 6 recent calls,
the 'I need to think about it' objection appeared without prior ammunition. Adding the question
'Would you say you're the type to overthink decisions?' would give you a callback during objections."

F. Reference the 4 Objection Pillars
Categorize each objection type by its underlying pillar:

VALUE: "Is the market saturated?", "I want to explore other options"

TRUST: "I've been burned before"

FIT: (prospect doesn't see themselves succeeding)

LOGISTICS: "I don't have the money", "I need to check with my partner", "I need to think about it"

STEP 4: IMPLEMENT 4.3 — Insights Panel (Pattern Aggregation)
Create: components/dashboard/InsightsPanel.tsx

This panel must:

Aggregate ALL action steps from every call review + roleplay

Group by theme using the 6 skill clusters as categories

Identify repeated patterns (same issue appearing in 3+ calls):

"Authority drops during objection handling (seen in 4/6 recent calls)"

"Discovery consistently too short (avg 8 min vs recommended 15-20 min)"

"Price collapse pattern: discounting before handling the real objection (3/5 calls)"

"Failing to pre-set analysis paralysis question (seen in 5/6 calls)"

"Losing frame control when prospect pushes back (4/6 calls)"

Surface top 3 recurring issues with:

Issue description

How many calls it appeared in

Which skill cluster it belongs to

Severity (how much it impacts close rate)

Implementation logic:

typescript
// Pseudo-logic for pattern detection
interface ActionStep {
  callId: string;
  phase: string;
  text: string;
  category: string; // mapped to skill cluster
}

function detectPatterns(actionSteps: ActionStep[]): Pattern[] {
  // 1. Group action steps by semantic similarity (use embeddings or keyword matching)
  // 2. Count occurrences across different calls
  // 3. If same issue appears in 3+ calls → it's a pattern
  // 4. Rank by frequency × impact
  // 5. Return top 3-5 patterns
}
If semantic matching is too complex for now, use keyword/category matching:

Group by skill cluster

Within each cluster, look for repeated action step themes

Count frequency across calls

STEP 5: IMPLEMENT 4.4 — Performance Summary (Directive Coaching)
Create: components/dashboard/PerformanceSummary.tsx

This goes at the BOTTOM of the dashboard. It must provide:

A. Top 1-3 Priorities (ranked by impact on close rate)

text
1. Stop collapsing on price before handling the real objection
2. Add pre-setting questions to discovery (analysis paralysis, commitment level)
3. Maintain authority tone through objection handling — don't become apologetic
B. What Skill to Focus On (linked to the 6 clusters)

text
Primary Focus: Objection Control (current score: 4.2/10)
Secondary Focus: Discovery & Gap Creation (current score: 5.8/10)
C. What to Train Next

text
Recommended: Complete 3 roleplays this week focused on Advisor-type prospects (hard difficulty).
Your objection handling needs practice against combative prospects who raise "I need to think
about it" — focus on staying calm and using their own words from discovery.
D. Direct Coaching Statement (written in Connor's voice — authoritative but supportive)

text
"Your discovery is getting better — you're asking deeper questions and I can see the improvement
in your last 3 calls. But here's the issue: you're still folding on price too early. When someone
says 'I need to think about it', you're jumping straight to a discount instead of staying calm,
acknowledging it, and then using what they told you earlier against them. Next 3 calls, I want
you to hold frame on the first objection for at least 2 exchanges before offering anything.
If you pre-set the analysis paralysis question in discovery, you'll have the ammunition you need."
This coaching statement MUST:

Be generated by AI based on actual performance data

Sound like a real mentor (Connor's style: direct, supportive, specific, not generic)

Reference specific patterns from recent calls

Give a concrete, actionable directive (not vague advice)

NEVER just say "keep practicing" — always say WHAT to practice and HOW

AI Prompt for generating the coaching statement:

text
You are Connor Williams, a high-ticket sales mentor. Based on this closer's performance data
across their last [N] calls, write a direct coaching statement.

Style rules:
- Speak as a mentor, not a robot
- Be direct and specific — reference actual patterns you see
- Always acknowledge what's improving (even if small)
- Then identify the ONE biggest thing holding them back
- Give a specific directive: what to do, how many times, and what to focus on
- Keep it under 100 words
- Use phrases like: "Here's the issue:", "What I want you to do:", "Next 3 calls:", 
  "The reason this matters is:", "I can see the improvement in:"
STEP 6: UPDATE EXPORTS AND INTEGRATION
Add skill-clusters.ts to training index exports

Wire dashboard page to use new components

Remove or hide old 10-category display (keep the data — just change the display layer)

Ensure skill cluster scores are calculated on page load from existing call data

STEP 7: VERIFY
bash
npm run build

# Verify skill clusters exist
grep -rn "SKILL_CLUSTERS\|skillCluster\|skill_cluster" --include="*.ts" --include="*.tsx" lib/ components/ app/

# Verify objection insights component
find . -name "*ObjectionInsight*" -o -name "*objectionInsight*" | grep -v node_modules

# Verify insights panel
find . -name "*InsightsPanel*" -o -name "*insightsPanel*" | grep -v node_modules

# Verify performance summary
find . -name "*PerformanceSummary*" -o -name "*performanceSummary*" | grep -v node_modules

# Verify coaching prompt
grep -rn "Connor Williams\|mentor.*style\|coaching.*statement" --include="*.ts" lib/
OUTPUT REQUIRED:
All files changed with descriptions

Skill cluster mapping: which old categories → which new cluster

Example of the objection insights panel data structure

Example of the coaching statement AI prompt

Build status: exit code 0




