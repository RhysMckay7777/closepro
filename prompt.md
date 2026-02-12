PROMPT 5: UPLOAD PAGE CLEANUP + REMOVE STALE REFERENCES + FINAL AUDIT

══════════════════════════════════════════════════════════════
CONTEXT
══════════════════════════════════════════════════════════════

Prompts 1-4 implemented all the changes. This final prompt cleans up 
stale references and audits everything end-to-end.

══════════════════════════════════════════════════════════════
STEP 1: REMOVE "ADD TO SALES FIGURES" FROM UPLOAD PAGE
══════════════════════════════════════════════════════════════

Find the upload page (where users first upload transcript/audio).
Search for: grep -rn "figure\|sales.*figure\|addTo" --include="*.tsx" app/

If there is ANY "Add to Sales Figures" toggle, dropdown, checkbox, 
or option on the upload page → REMOVE IT completely.

The sales figures decision now happens ONLY on the Confirm Call 
Details page (added in Prompt 1).

══════════════════════════════════════════════════════════════
STEP 2: REMOVE ALL STALE REASON TAG REFERENCES
══════════════════════════════════════════════════════════════

Search everywhere for reasonTag references:
  grep -rn "reasonTag\|reason_tag\|reason-tag\|ReasonTag" --include="*.ts" --include="*.tsx" app/ lib/ components/

For each file found:
- If it's the DB schema → KEEP (backward compat)
- If it's the confirm page → should already be removed (Prompt 1)
- If it's the confirm API route → should already be removed (Prompt 2)
- If it's the status API → stop returning it (or leave as null)
- If it's the call detail page or SalesFiguresPanel → REMOVE display
- If it's the AI analysis prompt → REMOVE from ConfirmFormContext 
  (the analysis prompt may reference reasonTag for context)

Make sure NO UI anywhere displays "Reason Tag" anymore.

══════════════════════════════════════════════════════════════
STEP 3: VERIFY NEW RESULT TYPES DISPLAY CORRECTLY
══════════════════════════════════════════════════════════════

Check all places where call results are displayed:
  grep -rn "result.*badge\|result.*color\|resultLabel\|resultColor\|getResultColor" --include="*.tsx" --include="*.ts" app/ components/

Ensure these handle the new result types:
- 'follow_up_result' → label: "Follow-up", color: amber/yellow badge
- 'unqualified' → label: "Unqualified", color: gray badge

Check:
A) Call log page — result column/badge
B) Call detail page — CallSnapshotBar result badge
C) SalesFiguresPanel — result display
D) Performance page — any result breakdowns

For CallSnapshotBar (components/call-review/CallSnapshotBar.tsx):
  Update resultLabels and resultColors to include:
  'follow_up_result': { label: 'Follow-up', color: 'amber' }
  'unqualified': { label: 'Unqualified', color: 'gray' }

══════════════════════════════════════════════════════════════
STEP 4: VERIFY PAYMENT PLAN RESULT BACKWARD COMPAT
══════════════════════════════════════════════════════════════

Old calls may have result = 'payment_plan'. Ensure:
- They still display correctly on the call log page
- They still display on the call detail page
- The badge shows "Payment Plan" with appropriate color
- They are NOT broken by removing payment_plan from the dropdown

Check: Are there any calls in the DB with result = 'payment_plan'?
If the app is new (few calls), there may be none. Either way, the 
display logic should handle it gracefully.

══════════════════════════════════════════════════════════════
STEP 5: VERIFY THE FULL UPLOAD → CONFIRM → ANALYSIS FLOW
══════════════════════════════════════════════════════════════

Trace the entire flow and verify:

1. Upload page:
   - No "Add to Sales Figures" option ✓
   - Upload audio or text transcript ✓
   - Redirects to confirm page ✓

2. Transcription step:
   - If audio → transcribe
   - After transcription → extractCallDetails runs ✓
   - Extracted details saved to DB ✓

3. Confirm page:
   - Form pre-populated from extracted details ✓
   - Info banner shows "Fields auto-populated..." ✓
   - Result dropdown has 5 options (not payment_plan) ✓
   - Conditional fields work per result type ✓
   - No Reason Tag dropdown ✓
   - "Add to Sales Figures" toggle visible for closing/follow-up ✓
   - Toggle hidden for roleplay ✓
   - Cancel and Log Call buttons work ✓

4. After logging:
   - Call analysis page appears ✓
   - Figures updated (if toggle was ON) ✓
   - Performance page reflects addToSalesFigures filter ✓

5. Call log page:
   - Delete button on each row ✓
   - Confirmation dialog ✓
   - Deletion removes from figures ✓
   - New result types display correctly ✓

══════════════════════════════════════════════════════════════
STEP 6: FINAL BUILD
══════════════════════════════════════════════════════════════

npm run build — zero errors.

Output:
1. All files modified in this prompt
2. Stale references found and removed
3. Any issues discovered and fixed
4. Confirmation of full flow working
5. Build result
6. Complete test checklist for manual verification

══════════════════════════════════════════════════════════════
DO NOT CHANGE
══════════════════════════════════════════════════════════════

- Call review detail page v2 layout
- Call analysis AI prompt (phase-based scoring)
- Shared components (call-review/*)
- Roleplay system
- Phase replay system
