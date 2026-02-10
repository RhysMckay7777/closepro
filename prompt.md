# CRITICAL: 3 Bugs Remaining — DO NOT say "already implemented"

# ============================================================
# BUG 1 [CRITICAL REGRESSION]: Only 4 of 10 categories showing
# ============================================================

# BEFORE your regex fix: 12 categories visible (too many, but data was there)
# AFTER your regex fix:  4 categories visible (Trust, Communication, 
#   Adaptation, Objection Handling) — 6 MISSING

# Your regex change from /[\s-]+/g to /[^a-z0-9]+/g is TOO AGGRESSIVE.
# It strips underscores, so:
#   "authority_leadership" → "authorityleadership" → NO MATCH → DROPPED
#   "structure_framework" → "structureframework" → NO MATCH → DROPPED
#   "closing_commitment" → "closingcommitment" → NO MATCH → DROPPED

# The 4 that DO work are likely matching through a different code path
# or have exact entries in the alias map.

# FIX: The alias map (OLD_TO_NEW) must have EXACT entries for every 
# old key format that exists in the database. Do this:

# 1. READ the actual skillScores JSON from one DB record:
#    SELECT skill_scores FROM call_analysis LIMIT 1;
#    or
#    console.log the raw skillScores keys before normalization

# 2. Add EVERY key you find as an explicit entry in OLD_TO_NEW:
#    const OLD_TO_NEW: Record<string, string> = {
#      // Exact DB keys → new canonical IDs
#      'authority_leadership': 'authority',
#      'authority': 'authority',
#      'structure_framework': 'structure',
#      'structure': 'structure',
#      'communication_storytelling': 'communication',
#      'communication': 'communication',
#      'discovery_diagnosis': 'discovery',
#      'discovery': 'discovery',
#      'gap_urgency': 'gap',
#      'gap': 'gap',
#      'value_offer_positioning': 'value',
#      'value': 'value',
#      'trust_safety_ethics': 'trust',
#      'trust': 'trust',
#      'adaptation_calibration': 'adaptation',
#      'adaptation': 'adaptation',
#      'objection_handling': 'objection_handling',
#      'closing_commitment': 'closing',
#      'closing': 'closing',
#      // Old categories that don't exist in new framework → map to nearest
#      'emotional_intelligence': 'trust',
#      'tonality_delivery': 'communication',
#    };

# 3. In resolveCategory(), do a DIRECT lookup first (no normalization):
#    function resolveCategory(rawKey: string): string | null {
#      // Try exact match first
#      if (OLD_TO_NEW[rawKey]) return OLD_TO_NEW[rawKey];
#      // Try lowercase
#      const lower = rawKey.toLowerCase().trim();
#      if (OLD_TO_NEW[lower]) return OLD_TO_NEW[lower];
#      // Try with underscores preserved but lowered
#      const normalized = lower.replace(/\s+/g, '_');
#      if (OLD_TO_NEW[normalized]) return OLD_TO_NEW[normalized];
#      // Unknown → skip
#      return null;
#    }

# 4. VERIFY: After this fix, add a temporary console.log:
#    console.log('Category mapping:', rawKeys, '→', resolvedCategories);
#    Confirm all 10 categories appear.

# 5. REVERT the aggressive regex. Keep underscores in normalization.

# ============================================================
# BUG 2 [BUG]: Date range selector doesn't update data
# ============================================================

# I changed the month dropdown on the live site. Nothing changed.
# The charts and metrics stayed identical.

# You said "Already fully implemented, no changes needed" but it 
# DOES NOT WORK on the deployed site.

# DEBUG STEPS (do all of these, show me the output):

# 1. In page.tsx, find the useEffect that calls fetchPerformance().
#    PRINT the entire useEffect including dependency array.
#    Show me the exact code.

# 2. In that useEffect, add at the top:
#    console.log('Fetching performance with:', { range, selectedMonth, selectedYear, dataSource });
#    console.log('Fetch URL:', url);

# 3. Find the month/year dropdown onChange handler.
#    Does it call setState? Show me the code.

# 4. Check: When the dropdown changes month from February to January,
#    does the URL change from month=2026-02 to month=2026-01?

# 5. In route.ts, find getRangeDates() or wherever the date params 
#    are parsed. Add console.log:
#    console.log('Date params received:', { month, range, startDate, endDate });

# 6. Check: Do the SQL queries in route.ts actually use startDate/endDate 
#    in their WHERE clauses? Show me the WHERE clause of the main query.

# If the URL doesn't change → frontend bug (onChange or useEffect deps)
# If URL changes but data doesn't → backend bug (SQL not filtering)

# ============================================================
# BUG 3 [FEATURE]: Objection sub-fields not rendering (P9)
# ============================================================

# The objection cards show text + type + frequency only.
# rootCause, preventionOpportunity, handlingQuality are not visible.
# No "Prioritised Improvement Actions" section.

# You said "Already fully implemented, no changes needed."
# The LIVE SITE shows NONE of these fields.

# The most likely explanation: the data doesn't exist in the DB.
# The conditional rendering ({obj.rootCause && ...}) hides null fields.
# So the code "works" but there's nothing to display.

# THIS IS STILL A BUG FROM THE USER'S PERSPECTIVE.

# FIX:
# 1. Check the DB: Do any objection records have rootCause?
#    SELECT objections FROM call_analysis WHERE objections IS NOT NULL LIMIT 3;
#    Parse the JSON — does it contain rootCause per objection?

# 2. If NO rootCause in DB data:
#    The AI analysis prompt generates these fields but they're being 
#    discarded during save. Find where analysis results are saved to 
#    call_analysis table and ensure rootCause/preventionOpportunity/
#    handlingQuality are preserved in the objections JSON.
#    
#    For EXISTING data: We can't retroactively add rootCause.
#    Instead, generate it from context:
#    - If objection type is "logistics" → rootCause: "Price/payment concerns 
#      not adequately addressed during value presentation"
#    - Show a note: "Run a new analysis to see detailed objection insights"

# 3. If rootCause EXISTS in DB but not in API response:
#    Fix the parseObjections() function in route.ts to carry it through.

# 4. If rootCause EXISTS in API response but not rendering:
#    Show me the exact JSX that should render it. Something is wrong 
#    with the conditional or the field name doesn't match.

# ============================================================
# VERIFICATION: After fixes, I need to see on the live site:
# - 10 category rows in Box 3 (not 4, not 12)
# - Date range change → different data
# - Objection cards with sub-fields (or clear empty-state message)
# 
# npm run build must pass.
# ============================================================
The category regression is the most urgent — you went from too many categories to far too few. The alias map fix is straightforward and should take the agent 5 minutes. The date range and objection issues need actual debugging, not reassurance.