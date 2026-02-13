Here's your full audit prompt to paste into Claude Code. It's designed to make Claude read every file in the pipeline, map the complete data flow, and report on the current state before you run a test analysis:

text
CODEBASE AUDIT: Full Pipeline State After Prompts 1-4

══════════════════════════════════════════════════════════════
PURPOSE
══════════════════════════════════════════════════════════════

We just finished implementing a 4-prompt overhaul of the call analysis
pipeline. Before we test with a real call, I need you to do a FULL
AUDIT of the current codebase state — read every relevant file, map
data flow end-to-end, and report what you find.

DO NOT MAKE ANY CHANGES. This is read-only.

══════════════════════════════════════════════════════════════
STEP 1: READ ALL KNOWLEDGE DOCS
══════════════════════════════════════════════════════════════

Read these 3 files completely (Prompt 1 output):
- lib/ai/knowledge/sales-philosophy.ts
- lib/ai/knowledge/output-rules.ts
- lib/ai/knowledge/prospect-difficulty.ts

Report for EACH file:
- Export name and type (string constant? function? object?)
- First 5 lines of actual content (the text, not the code)
- Last 5 lines of actual content
- Approximate line count
- What it covers (brief summary)

══════════════════════════════════════════════════════════════
STEP 2: READ THE AI ANALYSIS ENGINE
══════════════════════════════════════════════════════════════

Read the FULL file:
- lib/ai/analysis.ts

Report:
A) KNOWLEDGE DOC IMPORTS
   - Are all 3 knowledge docs imported?
   - Where are they injected into the system prompt? (exact line numbers)
   - How are they injected? (string interpolation? function call?)

B) SYSTEM PROMPT STRUCTURE
   - What sections does buildSystemPrompt() contain?
   - Print the EXACT output schema section (the JSON structure the AI
     must return) — every field name and type annotation
   - Are the new fields present?
     • phaseAnalysis.overall: callOutcomeAndWhy, whatLimited,
       primaryImprovementFocus, isStrongCall
     • phaseAnalysis.[phase]: whatWorked (string[]),
       whatLimitedImpact ({description, timestamp, whatShouldHaveDone}[])
     • actionPoints: label field
     • outcomeDiagnosticP1/P2 (still present for backward compat?)

C) DIFFICULTY MODEL
   - What are the EXACT dimension names in the output schema?
   - What direction is scoring? (higher = easier or harder?)
   - What are the difficulty tiers listed?
   - Does the schema include "nearimpossible"?

D) RESPONSE PROCESSING (after AI returns JSON)
   - How are dimension scores extracted? (list exact field names read)
   - What backward compat fallbacks exist? (old name → new name mappings)
   - How is totalDifficulty calculated?
   - How is difficultyTier assigned?
   - How is closerEffectiveness calculated? (list all band thresholds)
   - How are action points processed? (max count, fields extracted)
   - Is the `label` field extracted from action points?
   - How are phase details processed? (whatWorked, whatLimitedImpact)
   - Are outcomeDiagnosticP1/P2 still extracted?

E) TYPE INTERFACES
   Print the EXACT current definition of:
   - ProspectDifficultyV2
   - ProspectDifficultyJustifications
   - OverallPhaseDetail (or whatever the overall phase type is called)
   - PhaseDetail (individual phase type)
   - ActionPoint
   - CloserEffectiveness

══════════════════════════════════════════════════════════════
STEP 3: READ THE DIFFICULTY MODEL
══════════════════════════════════════════════════════════════

Read:
- lib/training/prospect-difficulty-model.ts

Report:
- V2_DIFFICULTY_DIMENSIONS: exact array values
- V2_DIFFICULTY_DIMENSION_LABELS: exact key→label map
- PROSPECT_DIFFICULTY_MODEL_V2: first 10 lines, last 10 lines
  - What direction does it state? (higher = ?)
  - What are the 5 dimension names and their 0-10 scales?
- V2_DIFFICULTY_BANDS: exact band definitions (min, max, label, color)
- getDifficultyBandV2(): exact threshold logic

══════════════════════════════════════════════════════════════
STEP 4: READ THE SCORING FRAMEWORK
══════════════════════════════════════════════════════════════

Read:
- lib/ai/scoring-framework.ts

Report:
- DIFFICULTY_TIERS: exact array
- DIFFICULTY_TIER_LABELS: exact map
- Does "nearimpossible" exist in both?
- What scoring categories exist?

══════════════════════════════════════════════════════════════
STEP 5: READ ALL UI COMPONENTS
══════════════════════════════════════════════════════════════

Read these files completely:
- components/call-review/PhaseAnalysisTabs.tsx
- components/call-review/ActionPointCards.tsx
- components/call-review/CallSnapshotBar.tsx
- components/call-review/ProspectDifficultyPanel.tsx
- components/call-review/OutcomeDiagnostic.tsx (if it exists)
- components/call-review/SalesFiguresPanel.tsx
- components/call-review/index.ts (barrel export)

Report for PhaseAnalysisTabs:
- What does the Overall tab render?
  • Does it use callOutcomeAndWhy / whatLimited / primaryImprovementFocus?
  • What fallback exists for old analyses?
  • Is isStrongCall used for dynamic heading?
- What do the phase tabs render?
  • Does it render whatWorked as a list with CheckCircle icon?
  • Does it render whatLimitedImpact as structured cards (array format)?
  • Does it handle string whatLimitedImpact (old format fallback)?
  • Does it fall back to timestampedFeedback when no array?
  • Are AlertTriangle / CheckCircle imported from lucide-react?
- Props interface: what fields does it expect?

Report for ActionPointCards:
- Does the ActionPoint interface include `label?: string`?
- Is `label` rendered as a heading?
- Max items displayed? (slice count)
- Does "Suggested Optimization" only show when no label?
- Is the title "Action Steps"?

Report for CallSnapshotBar:
- Result badge colors: what color for deposit, paymentplan, unqualified?
- Difficulty tier colors: does nearimpossible exist?
- Is "Closer Performance" label present above effectiveness badge?
- How is nearimpossible displayed in the tier badge text?

Report for ProspectDifficultyPanel:
- DIMENSION_ORDER: exact array
- dimensionLabels: exact key→label map
- Backward compat: does it fall back to old dimension keys?
- Title text?

Report for OutcomeDiagnostic:
- Does the file still exist?
- Is it still exported from index.ts?
- Is it imported/rendered ANYWHERE in app/ pages? (should be NO)

Report for SalesFiguresPanel:
- Result badge colors for deposit, paymentplan, unqualified?

══════════════════════════════════════════════════════════════
STEP 6: READ PARENT PAGES (DATA FLOW)
══════════════════════════════════════════════════════════════

Read:
- app/(dashboard)/dashboard/calls/[callId]/page.tsx
- app/(dashboard)/dashboard/roleplay/[sessionId]/results/page.tsx

Report for EACH page:
- What components are imported from call-review?
- Is OutcomeDiagnostic imported? (should be NO)
- Section numbers: what number is each component given?
  Expected: 1=CallSnapshotBar, 2=ProspectDifficultyPanel,
  3=PhaseAnalysisTabs, 4=ActionPointCards
- How does analysis data flow from DB → component props?
- Are phaseAnalysis, actionPoints passed as raw JSON objects?

══════════════════════════════════════════════════════════════
STEP 7: READ DB PERSISTENCE
══════════════════════════════════════════════════════════════

Read:
- app/api/calls/[callId]/analyze/route.ts (or wherever analyze-call logic lives)
- app/api/roleplay/[sessionId]/score/route.ts (roleplay scoring route)

Report:
- What fields are persisted to the database?
- Are phaseAnalysis, actionPoints stored as JSON strings?
- Is actionPoints.slice(0, 3) used? (not slice(0, 2))
- What happens to outcomeDiagnosticP1/P2 — are they still persisted?

══════════════════════════════════════════════════════════════
STEP 8: CONSISTENCY CHECKS (GREP)
══════════════════════════════════════════════════════════════

Run these greps and report results:

# OLD dimension names should NOT appear in display code
grep -rn "Pain & Ambition\|Funnel Warmth\|Execution Resistance" components/ --include="*.tsx"
grep -rn "painAndAmbition\|funnelWarmth\|executionResistance" components/ --include="*.tsx"
# ^ The second grep MAY match in fallback logic — that's OK. Report context.

# OLD difficulty bands should NOT exist
grep -rn "0.*20.*Easy\|21.*35.*Realistic\|36.*45.*Hard\|46.*50.*Expert" lib/ --include="*.ts"

# Old section title
grep -rn "Priority Improvements" components/ --include="*.tsx"

# OutcomeDiagnostic should NOT render on any page
grep -rn "OutcomeDiagnostic" app/ --include="*.tsx"
grep -rn "<OutcomeDiagnostic" components/ app/ --include="*.tsx"

# New fields should be present in PhaseAnalysisTabs
grep -n "callOutcomeAndWhy\|whatLimited\|primaryImprovementFocus" components/call-review/PhaseAnalysisTabs.tsx

# Action point label
grep -n "ap\.label\|label\?" components/call-review/ActionPointCards.tsx

# nearimpossible everywhere it should be
grep -rn "nearimpossible\|near.impossible\|Near Impossible" lib/ components/ types/ --include="*.ts" --include="*.tsx"

# Slice(0, 3) for action points
grep -rn "slice(0,\s*[23])" lib/ai/analysis.ts app/api/ --include="*.ts"

# Knowledge doc imports in analysis.ts
grep -n "knowledge\|SALES_PHILOSOPHY\|OUTPUT_RULES\|PROSPECT_DIFFICULTY" lib/ai/analysis.ts

══════════════════════════════════════════════════════════════
STEP 9: OUTPUT FORMAT
══════════════════════════════════════════════════════════════

Structure your output as:

## 1. Knowledge Docs
(findings)

## 2. AI Analysis Engine
(findings with exact code snippets)

## 3. Difficulty Model
(findings)

## 4. Scoring Framework
(findings)

## 5. UI Components
(findings per component)

## 6. Parent Pages
(findings)

## 7. DB Persistence
(findings)

## 8. Consistency Checks
(grep results with PASS/FAIL per check)

## 9. Data Flow Diagram
Draw the complete pipeline as ASCII:
  Transcript → analysis.ts (with knowledge docs) → JSON output →
  DB persistence → page.tsx data fetch → component props → UI render

## 10. Issues Found
List ANY inconsistencies, missing fields, orphaned references,
or potential bugs. If everything is clean, say "No issues found."

## 11. Ready for Testing?
YES or NO with reasoning.

══════════════════════════════════════════════════════════════
CRITICAL
══════════════════════════════════════════════════════════════

- DO NOT modify any files
- READ everything — don't skim
- Report EXACT code, not paraphrased
- If you find inconsistencies, flag them clearly
- This audit determines if we can safely test the pipeline