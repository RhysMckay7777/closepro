BUG: PAYMENT PLAN SHOWS 1 ROW INSTEAD OF 3 ON FIGURES PAGE

The user created a Closed call for "bob" with "Mixed Wealth Closing Mastery" 
and set Payment Plan with 3 instalments. But the Commission Schedule on the 
Figures page only shows 1 row with "(instalment)" instead of 3 separate rows.

EXPECTED: 3 rows — one per instalment, each with its own date, cash collected, 
revenue generated, and commission earned.

DEBUG STEPS:

1. Check the database first:
   - Query the instalments/commission table for this call
   - Are 3 instalment records actually stored? Or did only 1 get saved?
   - Print the actual DB rows

2. If 3 records exist in DB but only 1 shows:
   - The Figures page query is grouping/deduplicating by callId
   - Fix: query should return individual instalment rows, not group by callId
   - Each instalment row should show its own instalment date (not the call date)
   - Each row should show its own cash collected and revenue amount

3. If only 1 record exists in DB:
   - The confirm/save endpoint is only saving 1 instalment instead of all 3
   - Fix: loop through ALL instalments from the form and insert each one
   - Check app/api/calls/[callId]/confirm/route.ts or wherever payment plans 
     are saved

4. The date column should show the instalment due date, not the call date
   Label each row with "(instalment 1 of 3)", "(instalment 2 of 3)", etc.

VERIFY:
- Create a Closed call with 3 payment plan instalments of £1,000 each
- Figures page shows 3 separate rows for that call
- Each row has its own date, cash, revenue, commission
- Total commission across 3 rows = correct total

npm run build must pass.