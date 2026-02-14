Problem
March 2026 is a FUTURE month (today is Feb 15, 2026). The instalments showing in March look identical to current/past month rows — full cash amounts, normal styling, as if the money has already been collected. But it hasn't, because the month hasn't happened yet.

What Should Happen
Past/current month instalments: Show at full opacity, full amounts, assume collected ✅ (this is correct)

Future month instalments: Still show them (so the user can see upcoming payments), BUT visually distinguish them as "upcoming" — lighter styling, and label them as projected/upcoming

Fix — 2 changes
Change 1: Figures API — add isFutureInstalment flag
In app/api/performance/figures/route.ts, in the instalment processing loop where salesList.push(...) is called, add a boolean field:

typescript
// Right before salesList.push for instalments, add:
const now = new Date();
const isFuture = d > now;  // d is already `new Date(inst.dueDate)`

salesList.push({
  ...
  isFutureInstalment: isFuture,
  ...
});
Also add isFutureInstalment to the regular (non-instalment) salesRows.map() section with isFutureInstalment: false.

And add isFutureInstalment?: boolean to the SalesRow interface at the top of the file.

Change 2: Figures Page — style future rows differently
In app/(dashboard)/dashboard/performance/figures/page.tsx:

Add isFutureInstalment?: boolean to the SalesListItem interface.

On the <tr> tag, bring back opacity for FUTURE instalments only:

tsx
<tr key={...} className={`border-b border-border/50${row.isFutureInstalment ? ' opacity-50' : ''}`}>
After the instalment number label (instalment 2/4), add an "upcoming" indicator for future rows:

tsx
{row.isInstalment && row.instalmentNumber && row.totalInstalments && (
  <span className="ml-2 text-xs text-muted-foreground">
    (instalment {row.instalmentNumber}/{row.totalInstalments})
    {row.isFutureInstalment && (
      <span className="ml-1 text-amber-400">— upcoming</span>
    )}
  </span>
)}
For future rows, the Commission Earned column should show the amount but with a ~ prefix to indicate it's projected:

tsx
<td className="py-2 pr-4 text-right">
  {row.isFutureInstalment ? '~' : ''}
  £{(row.commissionAmount / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
</td>
Change 3: Total Commission header — separate confirmed vs projected
This is optional but nice: In the Total Commission display at the top, you could show:

"£120.00" (confirmed, from past/current month)

"+£33.10 projected" (from future instalments, in smaller amber text)

To do this, compute two sums in the figures page:

typescript
const confirmedCommission = figures.salesList
  .filter(r => !r.isFutureInstalment)
  .reduce((sum, r) => sum + r.commissionAmount, 0);
const projectedCommission = figures.salesList
  .filter(r => r.isFutureInstalment)
  .reduce((sum, r) => sum + r.commissionAmount, 0);
Then display:

tsx
<p className="text-3xl font-bold">
  £{(confirmedCommission / 100).toFixed(2)}
</p>
{projectedCommission > 0 && (
  <p className="text-sm text-amber-400 mt-1">
    +£{(projectedCommission / 100).toFixed(2)} projected
  </p>
)}
Build & verify after changes.