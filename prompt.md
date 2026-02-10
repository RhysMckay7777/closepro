CALL ANALYSIS — MAJOR FLOW RESTRUCTURE
Connor has specified a new mandatory flow for call analysis.
This is the highest priority change before launch.

Read this ENTIRE prompt before making any changes.

═══════════════════════════════════════════════════════════════
CHANGE 1: NEW "CONFIRM CALL DETAILS" STEP (CRITICAL)
═══════════════════════════════════════════════════════════════

CURRENT FLOW (BROKEN):
  Upload → AI immediately analyses → Results page 
  (figures buried at bottom, often skipped)

NEW FLOW (REQUIRED):
  Upload → AI pre-processes → "Confirm Call Details" page 
  → User confirms → "Log Call & Analyse" button 
  → THEN full analysis runs → Results page

IMPLEMENTATION:

STEP 1: AI Pre-Processing (modify existing upload handler)

When user uploads audio/transcript, the AI should ONLY do 
lightweight detection — NOT full analysis:

  // In the upload API route:
  const preProcess = await detectCallMetadata(transcript);
  // Returns: { 
  //   likelyOffer: string | null,
  //   prospectName: string | null,
  //   likelyResult: 'closed' | 'lost' | 'follow-up' | 'deposit' | 'unqualified' | null,
  //   prospectDifficulty: string | null 
  // }

  // Save the call record with status: 'pending_confirmation'
  // Do NOT run scoring yet
  await db.insert(calls).values({
    ...callData,
    status: 'pending_confirmation',
    transcript: transcriptText,
    audioUrl: audioUrl,
    // Pre-detected metadata (draft, not final):
    offerName: preProcess.likelyOffer,
    prospectName: preProcess.prospectName,
    result: preProcess.likelyResult,
    prospectDifficulty: preProcess.prospectDifficulty,
    // Score is NULL until confirmed and analysed
    overallScore: null,
  });

  // Redirect to: /dashboard/calls/[callId]/confirm
  // NOT to the analysis page

STEP 2: "Confirm Call Details" Page (NEW PAGE)

Create: app/dashboard/calls/[callId]/confirm/page.tsx

This page title: "Confirm Call Details"

Layout: Clean form with these fields, pre-filled by AI detection 
but EDITABLE by user:

  - Call date (date picker, default: today)
  - Offer name (dropdown from user's offers list — REQUIRED)
  - Prospect name (text input — REQUIRED)
  - Call result (dropdown — REQUIRED):
    - Closed
    - Lost
    - Deposit
    - Follow-up
    - Unqualified

CONDITIONAL FIELDS based on result (same logic as Manual Call Log):

  If result === 'closed':
    - Cash collected (£ number input)
    - Revenue generated (£ number input)
    - Commission rate (% number input)
    - Payment type (radio: "Paid in full" / "Payment plan")
    - If payment plan:
      - Number of instalments (number input)
      - Monthly amount (£ number input)

  If result === 'lost':
    - Textarea: "Why did this deal not close? 
      What objections were raised and how were they handled?"

  If result === 'deposit':
    - Textarea: "Deposit details"

  If result === 'follow-up':
    - Textarea: "Why was this not closed yet? 
      What objections remain?"

  If result === 'unqualified':
    - Textarea: "Why was this call unqualified?"

ACTION BUTTON at bottom:
  "Log Call & Analyse" (primary button, prominent)

When clicked:
  1. Validate all required fields
  2. Save confirmed metadata to the call record
  3. Update status: 'pending_confirmation' → 'analysing'
  4. THEN trigger full AI analysis (the scoring)
  5. Redirect to /dashboard/calls/[callId] (analysis results)

⚠️ The call must NOT appear in the calls list until status 
is 'analysed' (after scoring completes).

⚠️ The call must NOT be scored until the user clicks 
"Log Call & Analyse".

STEP 3: Modify upload redirect

Currently, after upload, the user is probably redirected to the 
analysis page. Change this to redirect to the confirm page:

  // After upload completes:
  router.push(`/dashboard/calls/${callId}/confirm`);
  // NOT: router.push(`/dashboard/calls/${callId}`);

STEP 4: Handle the "buried figures" section

The current call analysis page probably has a "Sales Figures 
Outcome" section at the bottom where users can edit figures.
This is now REPLACED by the Confirm page (which comes BEFORE 
analysis). 

On the analysis results page (/dashboard/calls/[callId]):
- Section 7 (Figures Outcome) becomes READ-ONLY
- It shows the data the user confirmed, but cannot be edited
- If user needs to change figures, add a small "Edit details" 
  link that goes back to /dashboard/calls/[callId]/confirm

VERIFY:
1. Upload call → redirected to "Confirm Call Details" page
2. AI pre-fills offer/name/result (editable)
3. Select "Closed" → cash/revenue/commission fields appear
4. Click "Log Call & Analyse" → redirected to analysis page
5. Analysis page shows score
6. Same score appears in calls list


═══════════════════════════════════════════════════════════════
CHANGE 2: FIX SCORE MISMATCH (CRITICAL)
═══════════════════════════════════════════════════════════════

PROBLEM:
The calls list page shows score 42 for a call, but the call 
detail/analysis page shows 34 for the SAME call. This is a 
data integrity violation.

ROOT CAUSE (likely one of these):
A) The calls list recalculates the score differently than the 
   analysis page
B) The calls list reads from a different DB field than the 
   analysis page
C) There are two scoring runs — one on upload, one on analysis
D) The score in the list is rounded/weighted differently

FIX — SINGLE SOURCE OF TRUTH:

1. There must be ONE score field in the database: overallScore
2. This score is written ONCE by the scoring engine after 
   the user confirms call details
3. Every page reads from this SAME field:
   - Call analysis page: reads call.overallScore
   - Calls list page: reads call.overallScore  
   - Performance dashboard: reads call.overallScore
   - Figures calculations: reads call.overallScore

FIND THE MISMATCH:

Search the codebase for ALL places that calculate or display 
"score" or "overallScore" for calls:

  grep -r "overallScore\|overall_score\|totalScore\|total_score" 
    --include="*.ts" --include="*.tsx"

Check:
- Does the calls list page compute score differently?
  (e.g. averaging category scores vs using stored total)
- Does the analysis page use a different field?
- Is there a scoring function called in two different places?

THE FIX:
- Ensure the scoring engine saves ONE overallScore to the DB
- Ensure the calls list page reads call.overallScore directly
  (NOT recalculating from categories)
- Ensure the analysis detail page reads the SAME call.overallScore
- Remove any secondary score calculation

Add a console.log to verify:
  console.log('[SCORE CHECK] Call', callId, 
    'DB overallScore:', call.overallScore,
    'Category sum:', categories.reduce((s,c) => s + c.score, 0));

If they differ, the DB field is correct — fix wherever the 
category sum is being used as the display score.


═══════════════════════════════════════════════════════════════
CHANGE 3: CALLS LIST — REMOVE OFFER TYPE COLUMN
═══════════════════════════════════════════════════════════════

Current columns: Date | Offer Name | Prospect Name | Offer Type | 
  Call Result | Prospect Difficulty | Overall Score

Change to: Date | Offer Name | Prospect Name | Call Result | 
  Prospect Difficulty | Overall Score

Simply remove the "Offer Type" column from the calls list table.

Also: calls must NOT appear in the list until status is 
'analysed'. Add a WHERE filter:

  const calls = await db.query.calls.findMany({
    where: eq(calls.status, 'analysed'),
    // or: where: not(eq(calls.status, 'pending_confirmation')),
    orderBy: desc(calls.createdAt),
  });


═══════════════════════════════════════════════════════════════
CHANGE 4: ENSURE DATA POPULATES CORRECTLY
═══════════════════════════════════════════════════════════════

After the user confirms call details, these fields must be 
populated (not "Unknown" or "—"):

  - Offer name: from the dropdown selection on confirm page
  - Prospect name: from the text input on confirm page
  - Call result: from the dropdown on confirm page
  - Prospect difficulty: from AI detection (or user override)

When saving confirmed details:
  await db.update(calls)
    .set({
      offerName: confirmedOffer,
      prospectName: confirmedProspectName,
      result: confirmedResult,
      prospectDifficulty: confirmedDifficulty,
      status: 'analysing',
      // Plus result-specific fields:
      cashCollected: resultData.cashCollected || null,
      revenueGenerated: resultData.revenueGenerated || null,
      commissionRate: resultData.commissionRate || null,
      paymentType: resultData.paymentType || null,
      // etc.
    })
    .where(eq(calls.id, callId));

Then trigger analysis. After analysis completes:
  await db.update(calls)
    .set({
      status: 'analysed',
      overallScore: analysisResult.overallScore,
      analysis: JSON.stringify(analysisResult),
    })
    .where(eq(calls.id, callId));


BUILD AND DEPLOY AFTER IMPLEMENTING ALL 4 CHANGES.
These must all ship together — they're interdependent.