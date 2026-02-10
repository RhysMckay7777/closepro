UICK FIX: Double-Count Prevention for Top-Level Figures

You correctly filtered salesList → filteredSalesList to prevent 
double-counting commission when payment plan instalments exist.

BUT — check if totalCashCollected and revenueGenerated (the 
top-level summary numbers on the Figures page) are ALSO using 
filteredSalesList or if they're calculated from the raw rows 
separately.

In app/api/performance/figures/route.ts, search for where these 
values are calculated:
  - totalCashCollected / cashCollected
  - revenueGenerated
  - callsShown / callsQualified / salesMade

If these are calculated from the raw monthRows BEFORE the 
instalment filtering, then a "Closed" call with a £6,000 
payment plan (3 × £2,000) would show:
  - Top summary: £6,000 cash collected (from parent row)
  - Commission table: 3 × £2,000 instalments

That's inconsistent. Two options:

OPTION A (simpler — recommended):
Keep the top-level summary as-is (total deal value from parent 
row). The commission table shows instalments. This makes sense 
because:
  - "Cash collected" = total deal value
  - "Commission" = broken into monthly instalments
  → No change needed, just verify this is the intent.

OPTION B (strict no-double-count):
Replace the parent row's cashCollected with the sum of 
instalments that fall in the current month only.
  → More complex, probably not what Connor wants.

VERIFY which approach is currently happening and confirm Option A 
is correct. If the top-level figures already use monthRows 
(separate from salesList), then no fix needed — just confirm 
the numbers make sense.

Also: Run a build to make sure everything still compiles.