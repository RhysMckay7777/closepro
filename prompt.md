ClosePro — Fix Offer Update Validation Error

## BUG
When editing an existing offer and clicking "Save Changes", the API returns:
"Invalid offer: primaryProblemsSolved (needs at least 3)"

The offer edit page has a single textarea for "Core Problems This Offer Solves" 
where the user types all problems as free text. But the API validation expects 
primaryProblemsSolved to be an array with at least 3 items.

## FIX
File: app/api/offers/[offerId]/route.ts (or wherever the offer PATCH/PUT 
validation lives)

Option A (preferred): Relax the validation for primaryProblemsSolved.
- If it's a string, accept it as-is (single textarea input)
- If it's an array, accept any length >= 1
- Remove or reduce the "needs at least 3" minimum check

Search for the validation:
```bash
grep -rn "primaryProblemsSolved\|needs at least 3\|at least 3" --include="*.ts"
Find the validation schema (likely Zod) and change the minimum from 3 to 1,
or remove the min() check entirely.

For example, if you find:
primaryProblemsSolved: z.array(z.string()).min(3)
Change to:
primaryProblemsSolved: z.union([z.string(), z.array(z.string()).min(1)])

Or if the frontend sends a single string that should be split:

Check how the frontend sends primaryProblemsSolved in the PATCH body

If it sends a string, split by newline or period before validation

Or accept both string and array formats

ALSO CHECK
The same validation may exist on offer CREATE (POST route) — fix there too

Check if any other fields have overly strict validation that would block
editing existing offers

VERIFICATION
npm run build — no errors

Test: editing an existing offer with the current "Core Problems" text
should save successfully

Report: what the validation was, what you changed it to, and which files

text

This should be a 2-minute fix — it's just a Zod schema `min(3)` that needs to be relaxed. Send it now and the offer editing will work again.