PROMPT B: 9 Core Principles + Commission Fixes + Replay Feature
CONTEXT
This is a refinement prompt. The system is nearly production-ready. This prompt addresses 5 remaining items from Connor's review. Read every module fully before starting.

Previous prompts already built:

Prompt 1: Commission on cash collected (figures/route.ts line 249), instalment dueDate filtering, instalmentNumber/status/collectedDate columns

Prompt 25: ProspectDifficultyPanel with prospectContextSummary + dimensionScores, three-column CallSnapshotBar, deeper phase analysis

Prompt 35: TranscriptView with Closer/Prospect labels + MM:SS timestamps, PhaseTimelineBar

Prompt 45: 6 skill clusters (skill-clusters.ts), ObjectionInsights, InsightsPanel, PerformanceSummary components

Prompt A: ElevenLabs TTS (lib/tts/elevenlabs-client.ts), prospect behavior rules, Zoom-style roleplay layout, Prospect Context UI restyle

AUDIT FIRST
Before implementing, read these files in full:

lib/training/skill-clusters.ts (will be replaced)

app/(dashboard)/dashboard/performance/page.tsx (imports SKILL_CLUSTERS, computeClusterScores)

app/api/performance/route.ts (returns skillCategories array)

app/api/performance/figures/route.ts (instalment loop ~line 293-314)

app/(dashboard)/dashboard/performance/figures/page.tsx (commission table UI)

app/(dashboard)/dashboard/calls/[callId]/page.tsx (call detail page)

app/api/roleplay/route.ts (roleplay session creation)

lib/ai/analysis.ts (analysis prompt — has action steps in section 7)

MODULE B1: Replace 6 Skill Clusters with 9 Core Principles
What Connor Said
"Where we done our sales philosophy document, we said there were some core principles: Authority, Structure, Communication & Listening, Gap Creation, Value Positioning, Trust Building, Adaptability, Objection Strategy, Decision Leadership. Those nine things — I would like in the performance."

"Not necessarily scored, just how are they faring in each area? What advice do we have? It should be broken down into a summary of how they're performing, what their strengths are, what their weaknesses are, and then suggested ways to improve."

Step 1: Replace lib/training/skill-clusters.ts with lib/training/core-principles.ts
Delete or rename skill-clusters.ts. Create core-principles.ts:

typescript
export interface CorePrinciple {
  id: string;
  name: string;
  description: string;
  relatedCategories: string[]; // Maps to the 10 scoring categories from analysis
}

export const CORE_PRINCIPLES: CorePrinciple[] = [
  {
    id: 'authority',
    name: 'Authority',
    description: 'Positional, conversational, and structural authority — leading the call, not following',
    relatedCategories: ['authority'],
  },
  {
    id: 'structure',
    name: 'Structure',
    description: 'Clear intro, focused discovery, logical pitch transition, controlled close, defined next steps',
    relatedCategories: ['structure'],
  },
  {
    id: 'communication_listening',
    name: 'Communication & Listening',
    description: 'Deep listening, emotional cues, referencing prospect words, strategic silence, layered follow-ups',
    relatedCategories: ['communication'],
  },
  {
    id: 'gap_creation',
    name: 'Gap Creation',
    description: 'Creating distance between current state and desired state, quantifying cost of inaction',
    relatedCategories: ['gap', 'discovery'],
  },
  {
    id: 'value_positioning',
    name: 'Value Positioning',
    description: 'Anchoring value to pain, personalizing the pitch, structuring clearly, avoiding feature dumps',
    relatedCategories: ['value'],
  },
  {
    id: 'trust_building',
    name: 'Trust Building',
    description: 'Clarity, calmness, truth-telling, not overselling, acknowledging concerns properly',
    relatedCategories: ['trust'],
  },
  {
    id: 'adaptability',
    name: 'Adaptability',
    description: 'Adjusting tone, pace, depth, energy, and question style based on prospect personality and context',
    relatedCategories: ['adaptation'],
  },
  {
    id: 'objection_strategy',
    name: 'Objection Strategy',
    description: 'Pre-handling predictable objections, handling at belief level, maintaining authority under resistance',
    relatedCategories: ['objection_handling'],
  },
  {
    id: 'decision_leadership',
    name: 'Decision Leadership',
    description: 'Assumptive language, clear investment framing, controlled silence, direct next-step clarity',
    relatedCategories: ['closing'],
  },
];

// Maps scoring category IDs to principle IDs
export function getPrincipleForCategory(categoryId: string): string | null {
  for (const p of CORE_PRINCIPLES) {
    if (p.relatedCategories.includes(categoryId)) return p.id;
  }
  return null;
}

// Compute principle scores from category scores
export interface PrincipleScore {
  principle: CorePrinciple;
  score: number;
  categoryBreakdown: { id: string; score: number }[];
}

export function computePrincipleScores(
  catScores: Record<string, number>
): PrincipleScore[] {
  return CORE_PRINCIPLES.map((p) => {
    const breakdown = p.relatedCategories
      .filter((c) => catScores[c] !== undefined)
      .map((c) => ({ id: c, score: catScores[c] }));
    const avg = breakdown.length > 0
      ? Math.round(breakdown.reduce((sum, b) => sum + b.score, 0) / breakdown.length)
      : 0;
    return { principle: p, score: avg, categoryBreakdown: breakdown };
  });
}
Step 2: Update barrel export lib/training/index.ts
Replace the skill-clusters exports:

typescript
// REMOVE these:
// export { SKILL_CLUSTERS, getClusterForCategory, computeClusterScores } from './skill-clusters';
// export type { SkillCluster, SkillClusterId } from './skill-clusters';

// ADD these:
export { CORE_PRINCIPLES, getPrincipleForCategory, computePrincipleScores } from './core-principles';
export type { CorePrinciple, PrincipleScore } from './core-principles';
Step 3: Update Performance API — Add Principle Summaries
In app/api/performance/route.ts, after computing skillCategories, add a new field principleSummaries to the response.

For each of the 9 principles:

Find matching skillCategories by checking relatedCategories

Aggregate strengths, weaknesses, actionPoints from those categories

Compute average score

Generate a 2-3 sentence summary by combining the category-level data

The response should include:

typescript
principleSummaries: {
  id: string;
  name: string;
  description: string;
  score: number;
  trend: number;
  summary: string;        // 2-3 sentence performance summary synthesized from category data
  strengths: string[];     // Aggregated from related categories (max 3)
  weaknesses: string[];    // Aggregated from related categories (max 3)
  improvements: string[];  // Aggregated from related categories (max 3)
}[]
For the summary field: Don't make an extra AI call. Construct it from the available data:

If score >= 80: "Strong performance in {name}. {first strength}."

If score >= 60: "Developing competency in {name}. {first strength}, but {first weakness}."

If score < 60: "Needs focus on {name}. {first weakness}. Priority: {first improvement}."

If score === 0: "No data yet for {name}. Complete more calls or roleplays to see insights."

Step 4: Update Performance Page UI
In app/(dashboard)/dashboard/performance/page.tsx:

Replace import:

typescript
// REMOVE: import { SKILL_CLUSTERS, computeClusterScores } from '@/lib/training/skill-clusters';
// ADD:
import { CORE_PRINCIPLES, computePrincipleScores } from '@/lib/training/core-principles';
Replace the entire "Skill Clusters" card (currently renders 6 clusters) with a "Sales Principles" card that renders 9 principles.

Each principle row shows:

Principle name (bold) + description (small, muted)

Score bar + score number (secondary — Connor said "not necessarily scored")

Trend indicator

Expandable section with:

Summary paragraph (normal text)

Strengths (green bullets, max 3)

Weaknesses (red bullets, max 3)

How to Improve (blue bullets, max 3)

Card title: "Core Sales Principles"
Card description: "Performance insights across 9 core principles from the sales philosophy"

Use performance.principleSummaries if available from API; otherwise fall back to computing from performance.skillCategories using computePrincipleScores on the client side (backward compat).

Color scheme for 9 principles:

text
authority:              blue
structure:              indigo
communication_listening: emerald
gap_creation:           green
value_positioning:      purple
trust_building:         amber
adaptability:           pink
objection_strategy:     orange
decision_leadership:    teal
MODULE B2: Performance Action Steps (Aggregated)
What Connor Said
"Underneath here there needs to be 'Action Steps' — their biggest three things they should be working on RIGHT NOW. We should get this from all the suggested action steps in all the call analysis and the roleplay analysis. They should all feed into this performance action steps."

Step 1: Update Performance API
In app/api/performance/route.ts, after computing skill categories:

You already have access to all call analyses in the date range (they're fetched to compute skillCategories).

Extract ALL actionSteps arrays from every call analysis and roleplay analysis in the range.

Flatten into a single list.

Group by similarity — use simple keyword matching (check if action steps share 3+ common words after removing stop words).

Count frequency of each theme.

Return top 3 as:

typescript
priorityActionSteps: {
  action: string;       // The most representative phrasing of this action step
  reason: string;       // Why this matters (from the action step context)
  frequency: number;    // How many sessions flagged this
  sources: string[];    // e.g., ["Call: John Smith 02/10", "Roleplay: 02/12"] (max 3)
}[]
If there are fewer than 3 themes, return whatever is available. If no action steps exist, return empty array.

Step 2: Add UI Section on Performance Page
Below the "Core Sales Principles" card, add a new card:

Card title: "Priority Action Steps"

Card description: "Your top development focuses based on all analysed calls and roleplays"

If priorityActionSteps is empty, show: "Complete more call reviews to generate action steps."

Otherwise, show 3 numbered items, each with:

Number badge (1, 2, 3) in a circle

Action (bold, normal text)

Why it matters (muted text, smaller)

Frequency badge: "Flagged in {n} sessions" (small badge)

Style: Use a distinct card background (e.g., bg-gradient-to-br from-amber-500/5 to-card/40 with border-amber-500/20) so it stands out as the "what to work on" section.

MODULE B3: Payment Plan Revenue Allocation Fix
What Connor Said
"The first month the payment plan is taken, the full revenue should be put in Revenue Generated. Then in the next month, zero revenue generated, but cash collected of 12.50."

Current Bug
In app/api/performance/figures/route.ts, the instalment loop (~line 301-314) sets:

typescript
revenueGenerated: inst.amountCents,  // BUG: every instalment shows its own amount
Required Fix
In the instalment processing loop, change revenueGenerated logic:

typescript
// Calculate full deal revenue = instalment amount × total instalments
const totalInstalments = totalsByCall.get(inst.salesCallId) ?? 1;
const fullDealRevenueCents = inst.amountCents * totalInstalments;
const isFirstInstalment = (inst.instalmentNumber ?? 0) === 1;

salesList.push({
  callId: inst.salesCallId,
  date: d.toISOString().slice(0, 10),
  offerName: inst.offerName ?? '',
  prospectName: inst.prospectName ?? 'Unknown',
  cashCollected: instStatus === 'collected' ? inst.amountCents : 0,
  revenueGenerated: isFirstInstalment ? fullDealRevenueCents : 0,  // ← KEY FIX
  commissionPct: pct,
  commissionAmount: commAmt,
  isInstalment: true,
  instalmentNumber: inst.instalmentNumber ?? 0,
  totalInstalments,
  instalmentStatus: instStatus,
});
This means:

Month 1 (instalment 1): Revenue Generated = full deal value, Cash Collected = 1 instalment

Month 2+ (instalment 2, 3, 4): Revenue Generated = £0, Cash Collected = 1 instalment each

Commission always = rate × cash collected (already correct from Prompt 1)

Also fix the totals row
Make sure the totals at bottom of figures page correctly sum:

Total Revenue Generated = sum of all revenueGenerated values (won't double-count because only instalment 1 has the value)

Total Cash Collected = sum of all cashCollected values

Total Commission = sum of all commissionAmount values

MODULE B4: Payment Type Column
What Connor Said
"We need to add one to the commission sheet where it says Type — Payment Type — and it either says Pay in Full, or Payment Plan, or Deposit."

Step 1: Add paymentType to figures API response
In app/api/performance/figures/route.ts:

For regular sales rows (non-instalment):

typescript
paymentType: row.result === 'deposit' ? 'Deposit' : 'Pay in Full',
For instalment rows:

typescript
paymentType: 'Payment Plan',
Add paymentType to the SalesRow interface:

typescript
paymentType?: 'Pay in Full' | 'Payment Plan' | 'Deposit';
Step 2: Add column to figures page UI
In app/(dashboard)/dashboard/performance/figures/page.tsx:

Add paymentType to the SalesRow type definition (around line 21-24).

In the table header row, add a new <th> between "Prospect" and "Cash Collected":

tsx
<th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">Type</th>
In the table body row, add a new <td> in the same position:

tsx
<td className="py-2 pr-4">
  <Badge 
    variant="outline" 
    className={cn(
      'text-xs',
      row.paymentType === 'Pay in Full' && 'border-green-500/30 text-green-400 bg-green-500/10',
      row.paymentType === 'Payment Plan' && 'border-blue-500/30 text-blue-400 bg-blue-500/10',
      row.paymentType === 'Deposit' && 'border-amber-500/30 text-amber-400 bg-amber-500/10',
    )}
  >
    {row.paymentType ?? 'Pay in Full'}
  </Badge>
</td>
MODULE B5: Replay Call in Roleplay (New Feature)
What Connor Said
"When we click any of these, it should have an option to 'Replay Call in Roleplay.' It needs to create a prospect based on the prospect we're reviewing — same name, same prospect difficulty, same prospect context. All it has to do is take all the details from what we've summarised on prospect difficulty."

Step 1: Add "Replay in Roleplay" Button on Call Detail Page
In app/(dashboard)/dashboard/calls/[callId]/page.tsx:

Add imports:

typescript
import { Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
After the PhaseAnalysisTabs section (or below ActionPointCards), add:

tsx
{/* Replay in Roleplay */}
{analysis?.prospectDifficultyJustifications && (
  <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
    <CardContent className="py-4">
      <Button 
        onClick={handleReplayInRoleplay}
        disabled={replayLoading}
        className="w-full"
        variant="outline"
      >
        {replayLoading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Play className="h-4 w-4 mr-2" />
        )}
        Replay This Call in Roleplay
      </Button>
    </CardContent>
  </Card>
)}
Add state and handler:

typescript
const [replayLoading, setReplayLoading] = useState(false);
const router = useRouter();

const handleReplayInRoleplay = async () => {
  setReplayLoading(true);
  try {
    const res = await fetch('/api/roleplay/replay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callId: call.id }),
    });
    if (!res.ok) throw new Error('Failed to create replay session');
    const data = await res.json();
    router.push(`/dashboard/roleplay/${data.sessionId}`);
  } catch (err: any) {
    toastError(err.message || 'Failed to start replay');
  } finally {
    setReplayLoading(false);
  }
};
Step 2: Create Replay API Endpoint
Create app/api/roleplay/replay/route.ts:

typescript
// POST /api/roleplay/replay
// Body: { callId: string }
// Creates a new roleplay session using prospect data from an analyzed call
This endpoint must:

Authenticate user (same pattern as other roleplay routes).

Fetch the call by callId, including its analysis JSON.

Extract from the analysis:

prospectName from the call

prospectDifficultyJustifications (has icpAlignment, motivationIntensity, funnelContext, authorityAndCoachability, abilityToProceed, prospectContextSummary, dimensionScores)

prospectDifficultyTier (easy/realistic/hard/expert)

prospectDifficulty (total score /50)

offerId from the call

Check if a prospect avatar already exists with that name for this user. If yes, use it. If not, create a temporary one using the call data:

name: prospectName from the call

positionDescription: Extract from prospectContextSummary

backstory: prospectContextSummary

Set dimension scores: icpAlignment, motivationIntensity, funnelContext, authorityAndCoachability, abilityToProceed from dimensionScores

Create a new roleplay session (same pattern as app/api/roleplay/route.ts):

userId: authenticated user

prospectAvatarId: the prospect found/created above

offerId: from the original call

inputMode: 'voice' (default)

status: 'active'

metadata: { replayFromCallId: callId, difficultyTier: tier }

Return { sessionId: newSession.id }.

Step 3: Roleplay Engine — Accept Replay Context
In lib/ai/roleplay/roleplay-engine.ts, the system prompt already uses prospect data from the session's prospect avatar. Since we're creating a proper prospect avatar with the call's data in Step 2, the roleplay engine should work WITHOUT changes — it will read the prospect avatar's backstory, dimension scores, etc. naturally.

However, verify that the roleplay engine reads prospectAvatar.backstory and includes it in the system prompt. If it doesn't, add it to the prospect context section of the prompt.

BUILD VERIFICATION
After all modules:

npm run build must exit code 0

Grep verification:

grep -r "SKILL_CLUSTERS\|skill-clusters" --include="*.ts" --include="*.tsx" should return NO results (fully replaced)

grep -r "CORE_PRINCIPLES\|core-principles" --include="*.ts" --include="*.tsx" should show imports in performance page + barrel

grep -r "paymentType" --include="*.ts" --include="*.tsx" should show figures route + figures page

grep -r "replay" app/api/roleplay/ --include="*.ts" should show the new replay route

grep -r "priorityActionSteps" --include="*.ts" --include="*.tsx" should show performance route + page

grep "revenueGenerated.*isFirstInstalment\|isFirstInstalment.*fullDealRevenue" --include="*.ts" should confirm the revenue fixPROMPT B: 9 Core Principles + Commission Fixes + Replay Feature
CONTEXT
This is a refinement prompt. The system is nearly production-ready. This prompt addresses 5 remaining items from Connor's review. Read every module fully before starting.

Previous prompts already built:

Prompt 1: Commission on cash collected (figures/route.ts line 249), instalment dueDate filtering, instalmentNumber/status/collectedDate columns

Prompt 25: ProspectDifficultyPanel with prospectContextSummary + dimensionScores, three-column CallSnapshotBar, deeper phase analysis

Prompt 35: TranscriptView with Closer/Prospect labels + MM:SS timestamps, PhaseTimelineBar

Prompt 45: 6 skill clusters (skill-clusters.ts), ObjectionInsights, InsightsPanel, PerformanceSummary components

Prompt A: ElevenLabs TTS (lib/tts/elevenlabs-client.ts), prospect behavior rules, Zoom-style roleplay layout, Prospect Context UI restyle

AUDIT FIRST
Before implementing, read these files in full:

lib/training/skill-clusters.ts (will be replaced)

app/(dashboard)/dashboard/performance/page.tsx (imports SKILL_CLUSTERS, computeClusterScores)

app/api/performance/route.ts (returns skillCategories array)

app/api/performance/figures/route.ts (instalment loop ~line 293-314)

app/(dashboard)/dashboard/performance/figures/page.tsx (commission table UI)

app/(dashboard)/dashboard/calls/[callId]/page.tsx (call detail page)

app/api/roleplay/route.ts (roleplay session creation)

lib/ai/analysis.ts (analysis prompt — has action steps in section 7)

MODULE B1: Replace 6 Skill Clusters with 9 Core Principles
What Connor Said
"Where we done our sales philosophy document, we said there were some core principles: Authority, Structure, Communication & Listening, Gap Creation, Value Positioning, Trust Building, Adaptability, Objection Strategy, Decision Leadership. Those nine things — I would like in the performance."

"Not necessarily scored, just how are they faring in each area? What advice do we have? It should be broken down into a summary of how they're performing, what their strengths are, what their weaknesses are, and then suggested ways to improve."

Step 1: Replace lib/training/skill-clusters.ts with lib/training/core-principles.ts
Delete or rename skill-clusters.ts. Create core-principles.ts:

typescript
export interface CorePrinciple {
  id: string;
  name: string;
  description: string;
  relatedCategories: string[]; // Maps to the 10 scoring categories from analysis
}

export const CORE_PRINCIPLES: CorePrinciple[] = [
  {
    id: 'authority',
    name: 'Authority',
    description: 'Positional, conversational, and structural authority — leading the call, not following',
    relatedCategories: ['authority'],
  },
  {
    id: 'structure',
    name: 'Structure',
    description: 'Clear intro, focused discovery, logical pitch transition, controlled close, defined next steps',
    relatedCategories: ['structure'],
  },
  {
    id: 'communication_listening',
    name: 'Communication & Listening',
    description: 'Deep listening, emotional cues, referencing prospect words, strategic silence, layered follow-ups',
    relatedCategories: ['communication'],
  },
  {
    id: 'gap_creation',
    name: 'Gap Creation',
    description: 'Creating distance between current state and desired state, quantifying cost of inaction',
    relatedCategories: ['gap', 'discovery'],
  },
  {
    id: 'value_positioning',
    name: 'Value Positioning',
    description: 'Anchoring value to pain, personalizing the pitch, structuring clearly, avoiding feature dumps',
    relatedCategories: ['value'],
  },
  {
    id: 'trust_building',
    name: 'Trust Building',
    description: 'Clarity, calmness, truth-telling, not overselling, acknowledging concerns properly',
    relatedCategories: ['trust'],
  },
  {
    id: 'adaptability',
    name: 'Adaptability',
    description: 'Adjusting tone, pace, depth, energy, and question style based on prospect personality and context',
    relatedCategories: ['adaptation'],
  },
  {
    id: 'objection_strategy',
    name: 'Objection Strategy',
    description: 'Pre-handling predictable objections, handling at belief level, maintaining authority under resistance',
    relatedCategories: ['objection_handling'],
  },
  {
    id: 'decision_leadership',
    name: 'Decision Leadership',
    description: 'Assumptive language, clear investment framing, controlled silence, direct next-step clarity',
    relatedCategories: ['closing'],
  },
];

// Maps scoring category IDs to principle IDs
export function getPrincipleForCategory(categoryId: string): string | null {
  for (const p of CORE_PRINCIPLES) {
    if (p.relatedCategories.includes(categoryId)) return p.id;
  }
  return null;
}

// Compute principle scores from category scores
export interface PrincipleScore {
  principle: CorePrinciple;
  score: number;
  categoryBreakdown: { id: string; score: number }[];
}

export function computePrincipleScores(
  catScores: Record<string, number>
): PrincipleScore[] {
  return CORE_PRINCIPLES.map((p) => {
    const breakdown = p.relatedCategories
      .filter((c) => catScores[c] !== undefined)
      .map((c) => ({ id: c, score: catScores[c] }));
    const avg = breakdown.length > 0
      ? Math.round(breakdown.reduce((sum, b) => sum + b.score, 0) / breakdown.length)
      : 0;
    return { principle: p, score: avg, categoryBreakdown: breakdown };
  });
}
Step 2: Update barrel export lib/training/index.ts
Replace the skill-clusters exports:

typescript
// REMOVE these:
// export { SKILL_CLUSTERS, getClusterForCategory, computeClusterScores } from './skill-clusters';
// export type { SkillCluster, SkillClusterId } from './skill-clusters';

// ADD these:
export { CORE_PRINCIPLES, getPrincipleForCategory, computePrincipleScores } from './core-principles';
export type { CorePrinciple, PrincipleScore } from './core-principles';
Step 3: Update Performance API — Add Principle Summaries
In app/api/performance/route.ts, after computing skillCategories, add a new field principleSummaries to the response.

For each of the 9 principles:

Find matching skillCategories by checking relatedCategories

Aggregate strengths, weaknesses, actionPoints from those categories

Compute average score

Generate a 2-3 sentence summary by combining the category-level data

The response should include:

typescript
principleSummaries: {
  id: string;
  name: string;
  description: string;
  score: number;
  trend: number;
  summary: string;        // 2-3 sentence performance summary synthesized from category data
  strengths: string[];     // Aggregated from related categories (max 3)
  weaknesses: string[];    // Aggregated from related categories (max 3)
  improvements: string[];  // Aggregated from related categories (max 3)
}[]
For the summary field: Don't make an extra AI call. Construct it from the available data:

If score >= 80: "Strong performance in {name}. {first strength}."

If score >= 60: "Developing competency in {name}. {first strength}, but {first weakness}."

If score < 60: "Needs focus on {name}. {first weakness}. Priority: {first improvement}."

If score === 0: "No data yet for {name}. Complete more calls or roleplays to see insights."

Step 4: Update Performance Page UI
In app/(dashboard)/dashboard/performance/page.tsx:

Replace import:

typescript
// REMOVE: import { SKILL_CLUSTERS, computeClusterScores } from '@/lib/training/skill-clusters';
// ADD:
import { CORE_PRINCIPLES, computePrincipleScores } from '@/lib/training/core-principles';
Replace the entire "Skill Clusters" card (currently renders 6 clusters) with a "Sales Principles" card that renders 9 principles.

Each principle row shows:

Principle name (bold) + description (small, muted)

Score bar + score number (secondary — Connor said "not necessarily scored")

Trend indicator

Expandable section with:

Summary paragraph (normal text)

Strengths (green bullets, max 3)

Weaknesses (red bullets, max 3)

How to Improve (blue bullets, max 3)

Card title: "Core Sales Principles"
Card description: "Performance insights across 9 core principles from the sales philosophy"

Use performance.principleSummaries if available from API; otherwise fall back to computing from performance.skillCategories using computePrincipleScores on the client side (backward compat).

Color scheme for 9 principles:

text
authority:              blue
structure:              indigo
communication_listening: emerald
gap_creation:           green
value_positioning:      purple
trust_building:         amber
adaptability:           pink
objection_strategy:     orange
decision_leadership:    teal
MODULE B2: Performance Action Steps (Aggregated)
What Connor Said
"Underneath here there needs to be 'Action Steps' — their biggest three things they should be working on RIGHT NOW. We should get this from all the suggested action steps in all the call analysis and the roleplay analysis. They should all feed into this performance action steps."

Step 1: Update Performance API
In app/api/performance/route.ts, after computing skill categories:

You already have access to all call analyses in the date range (they're fetched to compute skillCategories).

Extract ALL actionSteps arrays from every call analysis and roleplay analysis in the range.

Flatten into a single list.

Group by similarity — use simple keyword matching (check if action steps share 3+ common words after removing stop words).

Count frequency of each theme.

Return top 3 as:

typescript
priorityActionSteps: {
  action: string;       // The most representative phrasing of this action step
  reason: string;       // Why this matters (from the action step context)
  frequency: number;    // How many sessions flagged this
  sources: string[];    // e.g., ["Call: John Smith 02/10", "Roleplay: 02/12"] (max 3)
}[]
If there are fewer than 3 themes, return whatever is available. If no action steps exist, return empty array.

Step 2: Add UI Section on Performance Page
Below the "Core Sales Principles" card, add a new card:

Card title: "Priority Action Steps"

Card description: "Your top development focuses based on all analysed calls and roleplays"

If priorityActionSteps is empty, show: "Complete more call reviews to generate action steps."

Otherwise, show 3 numbered items, each with:

Number badge (1, 2, 3) in a circle

Action (bold, normal text)

Why it matters (muted text, smaller)

Frequency badge: "Flagged in {n} sessions" (small badge)

Style: Use a distinct card background (e.g., bg-gradient-to-br from-amber-500/5 to-card/40 with border-amber-500/20) so it stands out as the "what to work on" section.

MODULE B3: Payment Plan Revenue Allocation Fix
What Connor Said
"The first month the payment plan is taken, the full revenue should be put in Revenue Generated. Then in the next month, zero revenue generated, but cash collected of 12.50."

Current Bug
In app/api/performance/figures/route.ts, the instalment loop (~line 301-314) sets:

typescript
revenueGenerated: inst.amountCents,  // BUG: every instalment shows its own amount
Required Fix
In the instalment processing loop, change revenueGenerated logic:

typescript
// Calculate full deal revenue = instalment amount × total instalments
const totalInstalments = totalsByCall.get(inst.salesCallId) ?? 1;
const fullDealRevenueCents = inst.amountCents * totalInstalments;
const isFirstInstalment = (inst.instalmentNumber ?? 0) === 1;

salesList.push({
  callId: inst.salesCallId,
  date: d.toISOString().slice(0, 10),
  offerName: inst.offerName ?? '',
  prospectName: inst.prospectName ?? 'Unknown',
  cashCollected: instStatus === 'collected' ? inst.amountCents : 0,
  revenueGenerated: isFirstInstalment ? fullDealRevenueCents : 0,  // ← KEY FIX
  commissionPct: pct,
  commissionAmount: commAmt,
  isInstalment: true,
  instalmentNumber: inst.instalmentNumber ?? 0,
  totalInstalments,
  instalmentStatus: instStatus,
});
This means:

Month 1 (instalment 1): Revenue Generated = full deal value, Cash Collected = 1 instalment

Month 2+ (instalment 2, 3, 4): Revenue Generated = £0, Cash Collected = 1 instalment each

Commission always = rate × cash collected (already correct from Prompt 1)

Also fix the totals row
Make sure the totals at bottom of figures page correctly sum:

Total Revenue Generated = sum of all revenueGenerated values (won't double-count because only instalment 1 has the value)

Total Cash Collected = sum of all cashCollected values

Total Commission = sum of all commissionAmount values

MODULE B4: Payment Type Column
What Connor Said
"We need to add one to the commission sheet where it says Type — Payment Type — and it either says Pay in Full, or Payment Plan, or Deposit."

Step 1: Add paymentType to figures API response
In app/api/performance/figures/route.ts:

For regular sales rows (non-instalment):

typescript
paymentType: row.result === 'deposit' ? 'Deposit' : 'Pay in Full',
For instalment rows:

typescript
paymentType: 'Payment Plan',
Add paymentType to the SalesRow interface:

typescript
paymentType?: 'Pay in Full' | 'Payment Plan' | 'Deposit';
Step 2: Add column to figures page UI
In app/(dashboard)/dashboard/performance/figures/page.tsx:

Add paymentType to the SalesRow type definition (around line 21-24).

In the table header row, add a new <th> between "Prospect" and "Cash Collected":

tsx
<th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground">Type</th>
In the table body row, add a new <td> in the same position:

tsx
<td className="py-2 pr-4">
  <Badge 
    variant="outline" 
    className={cn(
      'text-xs',
      row.paymentType === 'Pay in Full' && 'border-green-500/30 text-green-400 bg-green-500/10',
      row.paymentType === 'Payment Plan' && 'border-blue-500/30 text-blue-400 bg-blue-500/10',
      row.paymentType === 'Deposit' && 'border-amber-500/30 text-amber-400 bg-amber-500/10',
    )}
  >
    {row.paymentType ?? 'Pay in Full'}
  </Badge>
</td>
MODULE B5: Replay Call in Roleplay (New Feature)
What Connor Said
"When we click any of these, it should have an option to 'Replay Call in Roleplay.' It needs to create a prospect based on the prospect we're reviewing — same name, same prospect difficulty, same prospect context. All it has to do is take all the details from what we've summarised on prospect difficulty."

Step 1: Add "Replay in Roleplay" Button on Call Detail Page
In app/(dashboard)/dashboard/calls/[callId]/page.tsx:

Add imports:

typescript
import { Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
After the PhaseAnalysisTabs section (or below ActionPointCards), add:

tsx
{/* Replay in Roleplay */}
{analysis?.prospectDifficultyJustifications && (
  <Card className="border border-white/10 bg-linear-to-br from-card/80 to-card/40 backdrop-blur-xl shadow-xl">
    <CardContent className="py-4">
      <Button 
        onClick={handleReplayInRoleplay}
        disabled={replayLoading}
        className="w-full"
        variant="outline"
      >
        {replayLoading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Play className="h-4 w-4 mr-2" />
        )}
        Replay This Call in Roleplay
      </Button>
    </CardContent>
  </Card>
)}
Add state and handler:

typescript
const [replayLoading, setReplayLoading] = useState(false);
const router = useRouter();

const handleReplayInRoleplay = async () => {
  setReplayLoading(true);
  try {
    const res = await fetch('/api/roleplay/replay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callId: call.id }),
    });
    if (!res.ok) throw new Error('Failed to create replay session');
    const data = await res.json();
    router.push(`/dashboard/roleplay/${data.sessionId}`);
  } catch (err: any) {
    toastError(err.message || 'Failed to start replay');
  } finally {
    setReplayLoading(false);
  }
};
Step 2: Create Replay API Endpoint
Create app/api/roleplay/replay/route.ts:

typescript
// POST /api/roleplay/replay
// Body: { callId: string }
// Creates a new roleplay session using prospect data from an analyzed call
This endpoint must:

Authenticate user (same pattern as other roleplay routes).

Fetch the call by callId, including its analysis JSON.

Extract from the analysis:

prospectName from the call

prospectDifficultyJustifications (has icpAlignment, motivationIntensity, funnelContext, authorityAndCoachability, abilityToProceed, prospectContextSummary, dimensionScores)

prospectDifficultyTier (easy/realistic/hard/expert)

prospectDifficulty (total score /50)

offerId from the call

Check if a prospect avatar already exists with that name for this user. If yes, use it. If not, create a temporary one using the call data:

name: prospectName from the call

positionDescription: Extract from prospectContextSummary

backstory: prospectContextSummary

Set dimension scores: icpAlignment, motivationIntensity, funnelContext, authorityAndCoachability, abilityToProceed from dimensionScores

Create a new roleplay session (same pattern as app/api/roleplay/route.ts):

userId: authenticated user

prospectAvatarId: the prospect found/created above

offerId: from the original call

inputMode: 'voice' (default)

status: 'active'

metadata: { replayFromCallId: callId, difficultyTier: tier }

Return { sessionId: newSession.id }.

Step 3: Roleplay Engine — Accept Replay Context
In lib/ai/roleplay/roleplay-engine.ts, the system prompt already uses prospect data from the session's prospect avatar. Since we're creating a proper prospect avatar with the call's data in Step 2, the roleplay engine should work WITHOUT changes — it will read the prospect avatar's backstory, dimension scores, etc. naturally.

However, verify that the roleplay engine reads prospectAvatar.backstory and includes it in the system prompt. If it doesn't, add it to the prospect context section of the prompt.

BUILD VERIFICATION
After all modules:

npm run build must exit code 0

Grep verification:

grep -r "SKILL_CLUSTERS\|skill-clusters" --include="*.ts" --include="*.tsx" should return NO results (fully replaced)

grep -r "CORE_PRINCIPLES\|core-principles" --include="*.ts" --include="*.tsx" should show imports in performance page + barrel

grep -r "paymentType" --include="*.ts" --include="*.tsx" should show figures route + figures page

grep -r "replay" app/api/roleplay/ --include="*.ts" should show the new replay route

grep -r "priorityActionSteps" --include="*.ts" --include="*.tsx" should show performance route + page

grep "revenueGenerated.*isFirstInstalment\|isFirstInstalment.*fullDealRevenue" --include="*.ts" should confirm the revenue fix