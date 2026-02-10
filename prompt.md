Thanks for testing — now I have the full picture. There are 4 remaining issues to fix. Here's exactly what's happening and the prompt to fix all of them.

What You Confirmed
From the accordion screenshot:
​

✅ Accordion does expand (chevrons flip, trend line visible)

❌ Every expanded section says "Not enough data yet for a detailed breakdown" — no strengths, weaknesses, or action points text

❌ Still showing old snake_case IDs and 12 categories instead of 10

From your testing:

❌ P10 still broken — changing the date dropdown doesn't change the data

4 Remaining Issues
#	Issue	Root Cause
1	12 categories with old IDs instead of 10 with display names	API returns raw skillScores keys without mapping through scoring-categories.ts alias map
2	Accordion content empty ("Not enough data yet")	categoryFeedback column is likely null for all 19 existing sessions — old analyses didn't generate this field
3	Objection sub-fields missing (P9)	Same DB column issue — priorityFixes column likely null. Frontend may also not render the fields
4	Date range doesn't update data (P10)	Frontend doesn't re-fetch when dropdown changes — useEffect likely missing month/year in its dependency array, or fetch URL doesn't include params
Fix Prompt
Paste this into the agent:

text
# Performance Page — 4 Remaining Issues (Round 3)
# All confirmed by live testing on Vercel deployment.

# ============================================================
# ISSUE 1 [CRITICAL]: Map Category IDs to Display Names
# Files: route.ts, possibly page.tsx
# ============================================================

# CURRENT STATE: The API returns raw skillScores keys as category names:
#   "trust_safety_ethics", "communication_storytelling", 
#   "emotional_intelligence", "tonality_delivery", etc.
# Shows 12 categories instead of Connor's agreed 10.

# The scoring-categories.ts file already has:
# - SCORING_CATEGORIES array with { id, name } for the 10 new categories
# - ID_ALIAS_MAP that maps old IDs → new IDs

# FIX in route.ts — computeSkillBreakdown() or wherever skillScores 
# keys are iterated:

# Step 1: Import from scoring-categories.ts:
#   import { SCORING_CATEGORIES, ID_ALIAS_MAP } from '@/lib/scoring-categories'
#   (adjust path as needed)

# Step 2: Create a lookup of valid new IDs:
#   const VALID_CATEGORY_IDS = new Set(SCORING_CATEGORIES.map(c => c.id));
#   const CATEGORY_DISPLAY_NAMES = Object.fromEntries(
#     SCORING_CATEGORIES.map(c => [c.id, c.name])
#   );

# Step 3: When iterating skillScores keys from each analysis:
#   for (const [rawKey, score] of Object.entries(skillScores)) {
#     // Resolve through alias map first
#     const resolvedId = ID_ALIAS_MAP[rawKey] || rawKey;
#     // Skip if not one of the 10 valid categories
#     if (!VALID_CATEGORY_IDS.has(resolvedId)) continue;
#     // Accumulate score under the resolved ID
#     categoryAccumulator[resolvedId] = categoryAccumulator[resolvedId] || { sum: 0, count: 0 };
#     categoryAccumulator[resolvedId].sum += score;
#     categoryAccumulator[resolvedId].count += 1;
#   }

# Step 4: When building the response, use display names:
#   categories.push({
#     id: resolvedId,
#     name: CATEGORY_DISPLAY_NAMES[resolvedId], // "Trust" not "trust_safety_ethics"
#     avgScore: Math.round(acc.sum / acc.count),
#     ...otherFields
#   });

# Step 5: Apply the SAME mapping to:
#   - bestCategory / biggestImprovement in salesCallsSummary and roleplaysSummary
#   - The Insight text generation
#   - The Summaries text generation
#   - Anywhere else category IDs appear in the API response

# After this fix: Box 3 should show EXACTLY 10 rows with names like
# "Authority", "Trust", "Communication" etc. — NOT snake_case IDs.

# ============================================================
# ISSUE 2 [IMPORTANT]: Accordion Shows "Not enough data yet"
# Files: route.ts, page.tsx
# ============================================================

# CURRENT STATE: Every expanded accordion row shows 
# "Not enough data yet for a detailed breakdown" despite having 
# 19 sessions with scores.

# ROOT CAUSE: The text content (strengths/weaknesses/actionPoints) 
# comes from the categoryFeedback column, which is likely NULL for 
# all existing analysis records. These sessions were analysed BEFORE 
# the column existed.

# TWO-PART FIX:

# Part A — Generate fallback text from numeric data:
# In route.ts, when building category response, if no text feedback 
# exists (strengths/weaknesses/actionPoints are all empty), generate 
# a basic summary from the numbers:
#
#   if (!strengths.length && !weaknesses.length) {
#     const avgScore = Math.round(acc.sum / acc.count);
#     const sessionCount = acc.count;
#     const trend = trendData.length >= 2 
#       ? (trendData[trendData.length-1] > trendData[0] ? 'improving' : 'declining')
#       : 'stable';
#     
#     return {
#       ...category,
#       strengths: avgScore >= 7 
#         ? [`Averaging ${avgScore}/10 across ${sessionCount} sessions — above target`]
#         : [],
#       weaknesses: avgScore < 5
#         ? [`Averaging ${avgScore}/10 across ${sessionCount} sessions — needs focused practice`]
#         : avgScore < 7
#         ? [`Averaging ${avgScore}/10 — room for improvement`]
#         : [],
#       actionPoints: [`Review ${CATEGORY_DISPLAY_NAMES[id]} techniques in your lowest-scoring calls`],
#       hasFeedback: false  // flag so frontend knows this is generated
#     };
#   }

# Part B — In page.tsx, update the empty-state check:
# Currently the accordion checks if there's content and shows 
# "Not enough data yet" when empty. With Part A generating fallback 
# text, this should now show content. But also update the check to 
# consider the numeric data as sufficient:
#
# Instead of checking for text content, check if avgScore > 0.
# If score exists but no text, show score-based summary.
# Only show "Not enough data" if there are truly 0 sessions.

# ============================================================
# ISSUE 3 [CRITICAL]: Objection Sub-Fields Not Showing (P9)
# Files: route.ts, page.tsx
# ============================================================

# DEBUG FIRST — Run these checks:

# 1. In route.ts, find where topObjections is built.
#    console.log(JSON.stringify(topObjections[0], null, 2))
#    Does each objection have rootCause, preventionOpportunity, 
#    handlingQuality fields? Or are they undefined/null?

# 2. Check the DB: What does the objections data look like in 
#    call_analysis records? Run:
#    SELECT objections FROM call_analysis LIMIT 1;
#    Does the JSON contain rootCause per objection?

# 3. In page.tsx, find the objection card JSX render.
#    Is there conditional rendering for rootCause/prevention/quality?
#    e.g., {obj.rootCause && <p>Root cause: {obj.rootCause}</p>}
#    If this JSX doesn't exist, ADD IT.

# FIX (Frontend — page.tsx):
# Find the objection card render block. Currently it shows:
#   - Objection text in quotes
#   - Type badge (logistics/trust)  
#   - Frequency (1×)
#
# ADD below each objection card (only if field exists):
#   {obj.rootCause && (
#     <p className="text-sm text-zinc-400 mt-1">
#       <span className="text-zinc-300 font-medium">Root cause:</span> {obj.rootCause}
#     </p>
#   )}
#   {obj.preventionOpportunity && (
#     <p className="text-sm text-zinc-400 mt-1">
#       <span className="text-zinc-300 font-medium">Prevention:</span> {obj.preventionOpportunity}
#     </p>
#   )}
#   {obj.handlingQuality != null && (
#     <p className="text-sm text-zinc-400 mt-1">
#       <span className="text-zinc-300 font-medium">Handling quality:</span> {obj.handlingQuality}/10
#     </p>
#   )}

# ADD after the objection list, the improvement actions section:
#   {improvementActions?.length > 0 && (
#     <div className="mt-6 pt-4 border-t border-white/10">
#       <h4 className="font-semibold mb-3">Prioritised Improvement Actions</h4>
#       {improvementActions.map((action, i) => (
#         <div key={i} className="mb-3 p-3 rounded-lg bg-white/5">
#           <p className="font-medium">{i+1}. {action.problem}</p>
#           <p className="text-sm text-zinc-400">Do: {action.whatToDo}</p>
#           <p className="text-sm text-zinc-400">When: {action.whenToApply}</p>
#           <p className="text-sm text-zinc-400">Why: {action.whyItMatters}</p>
#         </div>
#       ))}
#     </div>
#   )}

# If the API doesn't return these fields at all, check route.ts 
# parseObjections and carry them through. If the raw DB data doesn't 
# have them, the fields will be null — that's OK, they just won't 
# render (conditional display).

# ============================================================
# ISSUE 4 [BUG]: Date Range Doesn't Re-fetch Data (P10)
# File: page.tsx
# ============================================================

# CURRENT STATE: Changing the month/year dropdown doesn't update 
# the displayed data. The chart and metrics stay the same.

# LIKELY ROOT CAUSE: The useEffect that fetches performance data 
# does not include the month/year state in its dependency array.

# FIX:
# 1. Find the useState for month and year (e.g., selectedMonth, 
#    selectedYear or similar)
# 2. Find the useEffect that calls the performance API
# 3. Verify the fetch URL includes month and year params:
#    `/api/performance?month=${month}&year=${year}&source=${dataSource}`
# 4. Verify the dependency array includes [month, year, dataSource]:
#    useEffect(() => { fetchData(); }, [month, year, dataSource]);
# 5. If month/year are NOT in the dependency array, ADD THEM
# 6. If the fetch URL doesn't include month/year params, ADD THEM

# Also check: When the dropdown changes, does it call a setState?
# Find the <select> or dropdown component for month/year.
# Verify its onChange handler updates the state:
#   onChange={(e) => setMonth(e.target.value)}
# If it updates state but useEffect doesn't re-run, it's the 
# dependency array. If it doesn't update state, it's the onChange.

# After fix: Changing from February to January should show different 
# (or empty) data. Changing to December 2025 should show no data.

# ============================================================
# VERIFICATION: After all 4 fixes, npm run build must pass.
# Then deploy and verify:
# 1. Box 3 shows exactly 10 categories with display names
# 2. Expanded accordion shows text content (not "Not enough data")
# 3. Date range change updates all metrics
# 4. Objection cards show sub-fields (if data exists in DB)