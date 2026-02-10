BUG FIX: Confirm page shows "Call not found" for already-confirmed calls

PROBLEM:
When user clicks "Edit details" on the call analysis page, it 
goes to /dashboard/calls/[callId]/confirm — but the page shows 
"Call not found." and redirects back.

This is because the confirm page (or its API) only loads calls 
with status='pending_confirmation'. Once a call is confirmed 
and analysed (status='completed'), the confirm page can't find it.

Connor's doc says Section 7 should have an "Edit details" link 
that takes you back to confirm to edit the figures. This must 
work for ALREADY CONFIRMED calls too.

FIX — TWO CHANGES:

1. Confirm page API: Allow loading calls with ANY status
   (not just pending_confirmation)

   In app/api/calls/[callId]/confirm/route.ts (GET handler),
   find where it filters by status and REMOVE that filter:

   // BEFORE (broken):
   where: and(
     eq(salesCalls.id, callId),
     eq(salesCalls.status, 'pending_confirmation'),
     eq(salesCalls.userId, session.user.id)
   )

   // AFTER (fixed):
   where: and(
     eq(salesCalls.id, callId),
     eq(salesCalls.userId, session.user.id)
   )

2. Confirm page frontend: When loading an already-confirmed call,
   pre-fill the form with the EXISTING confirmed data (not just 
   AI-detected data).

   In app/(dashboard)/dashboard/calls/[callId]/confirm/page.tsx,
   when fetching call data, check if the call already has confirmed 
   fields and use them:

   // When loading call data:
   setForm({
     callDate: call.callDate || today,
     offerId: call.offerId || '',
     prospectName: call.prospectName || '',
     result: call.result || '',
     cashCollected: call.cashCollected ? (call.cashCollected / 100).toString() : '',
     revenueGenerated: call.revenueGenerated ? (call.revenueGenerated / 100).toString() : '',
     commissionRatePct: call.commissionRatePct?.toString() || '',
     paymentType: call.paymentType || 'paid_in_full',
     numberOfInstalments: call.numberOfInstalments?.toString() || '',
     monthlyAmount: call.monthlyAmount ? (call.monthlyAmount / 100).toString() : '',
     reason: call.reasonForOutcome || '',
   });

3. Confirm page submit: When re-confirming an already-analysed call,
   the API should:
   - Update the call metadata (offer, prospect, result, figures)
   - Re-run analysis with the updated context
   - OR just update the metadata without re-scoring (simpler)
   
   Recommended: Update metadata only, don't re-score. 
   Change the button text to "Update Details" when the call 
   is already confirmed (vs "Log Call & Analyse" for new calls).

4. Detail page redirect: Remove the redirect that sends 
   already-confirmed calls away from the confirm page.
   
   In the confirm page.tsx, if there's logic like:
     if (call.status !== 'pending_confirmation') {
       router.replace(`/dashboard/calls/${callId}`);
       return;
     }
   
   REMOVE IT. The confirm page should work for all call statuses.

VERIFY:
1. Go to any analysed call → click "Edit details" 
2. Confirm page loads with existing data pre-filled
3. Change the result or prospect name → click "Update Details"
4. Redirected back to analysis page with updated metadata
5. Calls list also shows updated data