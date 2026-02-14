FIX: Core Sales Principles Still Empty — Deep Diagnostic & Fix
The Problem
The Performance page still shows "No scored sessions yet" for Core Sales Principles AND "Complete more call reviews to generate action steps" for Priority Action Steps, despite the user having analyzed calls. The all_time range fix from the previous prompt did NOT resolve this.

Root Cause Investigation — Do ALL of these steps in order
Step 1: Check how the performance page constructs the API fetch URL
Read app/(dashboard)/dashboard/performance/page.tsx and find the fetch('/api/performance...') call. Check:

What URL parameters does it send? (range, month, year, days?)

Does it send a month param that might override the range param?

Log the actual fetch URL with console.log('Fetching performance:', url)

Step 2: Check the Performance API parameter routing
Read app/api/performance/route.ts around lines 375-390. The current code is:

typescript
const monthParam = searchParams.get('month');
const rangeParam = monthParam || searchParams.get('range') || searchParams.get('days') || 'this_month';
THIS IS LIKELY THE BUG: If the page sends ?month=02&year=2026&range=all_time, then monthParam = "02" takes precedence and becomes rangeParam = "02". Then getRangeDates("02") hits the default case, parses parseInt("02") = 2, and returns "last 2 days" — missing all the user's calls!

Fix: The month/year params should be handled SEPARATELY from the named range params. Add dedicated month/year handling:

typescript
const monthParam = searchParams.get('month');
const yearParam = searchParams.get('year');
const rangeParam = searchParams.get('range') || searchParams.get('days') || 'all_time';

let startDate: Date;
let endDate: Date;
let periodLabel: string;

if (monthParam && yearParam) {
  // Specific month/year selection
  const m = parseInt(monthParam, 10) - 1; // 0-indexed
  const y = parseInt(yearParam, 10);
  startDate = new Date(y, m, 1);
  endDate = new Date(y, m + 1, 0, 23, 59, 59, 999); // Last day of month
  periodLabel = `${new Date(y, m).toLocaleString('default', { month: 'long' })} ${y}`;
} else {
  const result = getRangeDates(rangeParam);
  startDate = result.start;
  endDate = result.end;
  periodLabel = result.label;
}
Step 3: Verify allAnalyses is populated
After the allAnalyses query, add AGGRESSIVE logging:

typescript
console.log('[Performance API] FULL DEBUG:', {
  rangeParam,
  monthParam,
  yearParam,
  startDate: startDate.toISOString(),
  endDate: endDate.toISOString(),
  totalAnalyses: allAnalyses.length,
  analysesSample: allAnalyses.slice(0, 2).map(a => ({
    id: a.id,
    type: a.type,
    createdAt: a.createdAt,
    hasScores: !!a.scores,
    hasCategoryScores: !!a.categoryScores,
    scoreKeys: a.scores ? Object.keys(typeof a.scores === 'string' ? JSON.parse(a.scores) : a.scores).slice(0, 5) : [],
  })),
});
Step 4: Check how allSkillCategories is computed from analyses
Find the code that builds allSkillCategories from allAnalyses. The analysis JSON might store scores under a different key than what the code expects. Common mismatches:

Code expects analysis.scores but data has analysis.categoryScores

Code expects analysis.scores.authority but data has analysis.scores.Authority (case mismatch)

Code expects a parsed object but analysis.scores is a JSON string that needs JSON.parse()

Add logging right after allSkillCategories is computed:

typescript
console.log('[Performance API] SkillCategories debug:', {
  count: allSkillCategories.length,
  categories: allSkillCategories.map(c => ({ name: c.category, avg: c.averageScore })),
});
Step 5: Check the DISPLAY_NAME_TO_ID mapping
In the principleSummaries computation, the DISPLAY_NAME_TO_ID mapping converts display names like "Authority" to IDs like "authority". But the DISPLAY_NAMES object at the top might have the mapping backwards. Check:

typescript
const DISPLAY_NAMES: Record<string, string> = {
  authority: 'Authority',
  structure: 'Structure',
  ...
};
Then DISPLAY_NAME_TO_ID is built as:

typescript
for (const [id, name] of Object.entries(DISPLAY_NAMES)) {
  DISPLAY_NAME_TO_ID[name] = id;
}
So DISPLAY_NAME_TO_ID['Authority'] = 'authority'. This is correct.

But the matchingCats filter does:

typescript
const catId = DISPLAY_NAME_TO_ID[sc.category] ?? sc.category.toLowerCase().replace(/\s/g, '')
return p.relatedCategories.includes(catId)
If sc.category doesn't match any key in DISPLAY_NAME_TO_ID, it falls back to lowercase-no-spaces. Check what sc.category actually contains — it might be something unexpected.

Step 6: Deploy and check Vercel function logs
After adding all the logging, deploy to Vercel and visit the Performance page. Check the Vercel function logs at:
https://vercel.com/[your-project]/functions → look for the /api/performance function logs.

The logs will tell you EXACTLY where the data pipeline breaks:

0 analyses → date range or query issue

analyses exist but 0 skillCategories → score extraction issue

skillCategories exist but 0 principleSummaries → mapping issue

Step 7: ALSO ensure the page default is truly all_time
Double-check the page's range state actually defaults to 'all_time' and NOT 'this_month':

typescript
const [range, setRange] = useState<string>('all_time');
And check that the page fetch uses this range in the URL (not overridden by month/year params).

CRITICAL: After diagnosing, fix whatever is broken and redeploy.