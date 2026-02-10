═══════════════════════════════════════════════════════════════════════════
TWO FIXES — Manual Call Log 400 Error + Roleplay Results Accordion
═══════════════════════════════════════════════════════════════════════════


FIX 1 (CRITICAL): MANUAL CALL LOG — 400 "Missing required fields"
═══════════════════════════════════════════════════════════════════════════

PROBLEM:
When submitting a manual call log at /dashboard/calls/new, the API 
returns 400 with error: "Missing required fields: offerId, result, 
reasonForOutcome"

The form DOES have these fields filled in (Offer dropdown shows 
"Mixed Wealth Closing Mastery", Revenue/Payment fields are filled), 
but the frontend is NOT sending them correctly to the API.

CONSOLE ERROR (exact):
  Failed to load resource: the server responded with a status of 400 ()
  /api/calls/manual
  Error logging call: Error: Missing required fields: offerId, result, 
  reasonForOutcome

ALSO IN CONSOLE:
  [Performance] Response period: Last Month → totalAnalyses: 0
  [Performance] Response period: This Month → totalAnalyses: 22
  (This confirms the date range IS working — Last Month returns 0, 
  This Month returns 22. Date range bug is FIXED.)

DEBUG STEPS — DO THESE IN ORDER:

STEP 1: Find the Manual Call Log form component.
Search for the file that handles /dashboard/calls/new — likely:
  app/(dashboard)/dashboard/calls/new/page.tsx

STEP 2: Find the submit handler for the manual log form.
Search for: "manual", "logCall", "handleSubmit", "/api/calls/manual"

STEP 3: Check what the form sends vs what the API expects.
Log the request body BEFORE sending:

  const handleSubmit = async () => {
    const body = {
      // ... whatever is currently here
    };
    console.log('[MANUAL LOG] Sending body:', JSON.stringify(body, null, 2));
    
    const response = await fetch('/api/calls/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  };

STEP 4: Find the API route handler.
Search for: app/api/calls/manual/route.ts

Check what fields it requires:
  const { offerId, result, reasonForOutcome, ... } = await request.json();
  
  if (!offerId || !result || !reasonForOutcome) {
    return NextResponse.json({ error: 'Missing required fields...' }, { status: 400 });
  }

STEP 5: Fix the mismatch. Common causes:

  A) Form sends "offer" but API expects "offerId"
  B) Form sends "outcome" but API expects "result"  
  C) Form doesn't send "reasonForOutcome" at all — for "Closed" result 
     there may not be a text reason, but the API still requires it
  D) The result value format doesn't match — form sends "Closed" but 
     API expects "closed" (lowercase)

LIKELY FIX:
The API requires "reasonForOutcome" but when result is "Closed", 
there IS no reason textarea — only payment fields. The fix is:

  OPTION A (RECOMMENDED): Make reasonForOutcome optional when result 
  is "closed" or "deposit":
  
  // In the API route:
  if (!offerId || !result) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  
  // Only require reasonForOutcome for results that have a textarea:
  if (['lost', 'follow-up', 'unqualified'].includes(result.toLowerCase()) && !reasonForOutcome) {
    return NextResponse.json({ error: 'Reason is required for this result type' }, { status: 400 });
  }

  OPTION B: Send an empty string for reasonForOutcome when Closed:
  
  // In the frontend form:
  const body = {
    offerId: selectedOffer,        // NOT "offer"
    result: selectedResult,         // Must match API expectation
    reasonForOutcome: reasonText || '',  // Default to empty string
    prospectName: prospectName,
    callDate: callDate,
    // ... payment fields when result is Closed
    cashCollected: cashCollected,
    revenueGenerated: revenueGenerated,
    commissionRate: commissionRate,
    paymentType: paymentType,
    instalments: instalments,
    monthlyAmount: monthlyAmount,
  };

STEP 6: Also check the field name mapping. Print both sides:

  // Frontend — log what's being sent:
  console.log('[MANUAL LOG] offerId:', selectedOffer);
  console.log('[MANUAL LOG] result:', selectedResult);
  console.log('[MANUAL LOG] reasonForOutcome:', reasonText);

  // API — log what's being received:
  const body = await request.json();
  console.log('[MANUAL API] Received body keys:', Object.keys(body));
  console.log('[MANUAL API] offerId:', body.offerId);
  console.log('[MANUAL API] result:', body.result);
  console.log('[MANUAL API] reasonForOutcome:', body.reasonForOutcome);

VERIFY:
1. Fill out Manual Call Log with result "Closed", offer selected, 
   all payment fields filled → click "Log Call" → saves successfully
2. Fill out with result "Lost", type reason → saves successfully
3. Check Figures page → new call appears in commission table
4. No 400 errors in console


═══════════════════════════════════════════════════════════════════════════
FIX 2 (IMPORTANT): ROLEPLAY RESULTS — SKILL BREAKDOWN ACCORDION
═══════════════════════════════════════════════════════════════════════════

PROBLEM:
The "10-Category Skill Breakdown" section on the roleplay results page 
(/dashboard/roleplay/[sessionId]/results) currently shows a flat 2×5 
grid of category name cards with no scores and no expand functionality.

This must be changed to match the SAME accordion pattern used on:
1. The Performance page (Box 3) — which already works correctly
2. The Call Analysis page (Section 3) — per Connor's doc

FIND THE CODE:
1. app/(dashboard)/dashboard/roleplay/[sessionId]/results/page.tsx
2. Find the section that renders the 10 category grid
3. Find the Performance page's Box 3 accordion component for reference

CURRENT CODE (approximately):
  <div className="grid grid-cols-2 gap-4">
    {categories.map(cat => (
      <div className="border rounded p-4">
        <h3>{cat.name}</h3>
      </div>
    ))}
  </div>

CHANGE TO:
Each of the 10 categories must be rendered as an expandable accordion 
row, NOT a flat grid card.

REQUIREMENTS:
- Show each category as a ROW (full width, not 2-column grid)
- Each row displays: Category name + Score out of 10
- Each row is CLICKABLE — expands accordion-style
- When expanded, show 4 sub-sections:
  1. "Why this score was given" — from categoryFeedback.reason or 
     skillScores[category].feedback
  2. "What was done well" — from categoryFeedback.strengths or 
     skillScores[category].strengths
  3. "What was missing or misaligned" — from categoryFeedback.weaknesses 
     or skillScores[category].weaknesses
  4. "How this affected the call outcome" — from 
     categoryFeedback.impact or skillScores[category].impact

DATA MAPPING:
The roleplay scoring API already returns category-level feedback. 
Check the analysis object structure:

  // If analysis.categoryScores is an array:
  analysis.categoryScores.forEach(cat => {
    cat.name    // "Authority"
    cat.score   // 3
    cat.reason  // "Why this score..."
    cat.strengths // "What was done well..."
    cat.weaknesses // "What was missing..."
    cat.impact  // "How this affected..."
  });

  // OR if analysis.skillScores is an object:
  Object.entries(analysis.skillScores).forEach(([key, value]) => {
    key         // "authority"
    value.score // 3
    value.feedback // May contain all sub-fields
  });

IMPLEMENTATION:
Use the same accordion pattern as the call analysis page. Here's the 
structure:

  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  <div className="space-y-2">
    {categories.map(cat => (
      <div key={cat.name} className="border rounded-lg">
        {/* Collapsed row — always visible */}
        <button 
          onClick={() => setExpandedCategory(
            expandedCategory === cat.name ? null : cat.name
          )}
          className="w-full flex items-center justify-between p-4"
        >
          <span className="font-medium">{cat.name}</span>
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold">{cat.score}</span>
            <span className="text-muted-foreground">/10</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${
              expandedCategory === cat.name ? 'rotate-180' : ''
            }`} />
          </div>
        </button>
        
        {/* Expanded content */}
        {expandedCategory === cat.name && (
          <div className="px-4 pb-4 space-y-3 border-t">
            {cat.reason && (
              <div>
                <h4 className="text-sm font-semibold text-muted-foreground">
                  Why this score was given
                </h4>
                <p className="text-sm">{cat.reason}</p>
              </div>
            )}
            {cat.strengths && (
              <div>
                <h4 className="text-sm font-semibold text-green-500">
                  What was done well
                </h4>
                <p className="text-sm">{cat.strengths}</p>
              </div>
            )}
            {cat.weaknesses && (
              <div>
                <h4 className="text-sm font-semibold text-red-500">
                  What was missing or misaligned
                </h4>
                <p className="text-sm">{cat.weaknesses}</p>
              </div>
            )}
            {cat.impact && (
              <div>
                <h4 className="text-sm font-semibold text-amber-500">
                  How this affected the outcome
                </h4>
                <p className="text-sm">{cat.impact}</p>
              </div>
            )}
          </div>
        )}
      </div>
    ))}
  </div>

If the sub-field data doesn't exist in the current scoring output, 
update the roleplay scoring prompt to include these 4 fields per 
category in the JSON response format.

VERIFY:
1. Open a completed roleplay results page
2. See 10 category ROWS (not 2×5 grid) with name + score/10
3. Click any category → accordion expands with 4 sub-sections
4. Click again → collapses


═══════════════════════════════════════════════════════════════════════════
BONUS CONFIRMATION: DATE RANGE IS WORKING
═══════════════════════════════════════════════════════════════════════════

The console logs confirm the Performance date range IS functioning:
  [Performance] Response period: Last Month → totalAnalyses: 0
  [Performance] Response period: This Month → totalAnalyses: 22

This means when switching to "Last Month", the API correctly returns 
0 analyses (no data last month), and "This Month" returns 22. 
The date range bug from earlier rounds is FIXED. No action needed.


═══════════════════════════════════════════════════════════════════════════
DEPLOY AND VERIFY BOTH FIXES
═══════════════════════════════════════════════════════════════════════════
