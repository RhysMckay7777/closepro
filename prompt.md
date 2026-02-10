IMPLEMENTATION PROMPT — 12 BUG FIXES (BATCH ROUND 1)
═══════════════════════════════════════════════════════════════════════════

CONTEXT:
You are working on ClosePro, a Next.js sales coaching application deployed
on Vercel. The app has: Dashboard, Performance, Figures, Calls (upload & 
analyse, manual log, no-show, follow-up), AI Roleplay, and Offers pages.

You need to fix 12 bugs found during QA testing. Fix them in the exact 
order listed. Each bug includes: what's broken, where to find the code, 
and the exact implementation required.

RULES:
- Fix ALL 12 bugs in this single session
- Do NOT break existing working features
- Do NOT change the database schema unless explicitly required
- Test each fix mentally before moving to the next
- After all fixes, ensure the build compiles without errors
- Deploy when complete

═══════════════════════════════════════════════════════════════════════════
BUG 1 (CRITICAL): PROSPECT EDIT SAVE → 404 ERROR
═══════════════════════════════════════════════════════════════════════════

PROBLEM:
When editing a prospect inside an offer and clicking Save, the browser 
navigates to /dashboard/prospect-avatars or /dashboard/prospect-[id] 
which returns 404. Console shows multiple 404 errors for these routes.

ROOT CAUSE:
The prospect edit form's save handler either:
(a) Redirects to a non-existent page route after save, OR
(b) Makes a fetch call to a non-existent API route for avatar generation

FIND THE CODE:
1. Search for "prospect-avatars" in the entire codebase
2. Search for the prospect edit/save form component — likely in:
   - /app/dashboard/offers/[id]/page.tsx (or a component it imports)
   - A modal/dialog component for editing prospects
3. Search for any router.push() or redirect() after prospect save
4. Search for any fetch() calls to prospect-related routes

IMPLEMENTATION:
1. In the prospect edit form's onSubmit/save handler:

   // WRONG — remove or fix these:
   router.push('/dashboard/prospect-avatars')  // ← DELETE THIS
   fetch('/dashboard/prospect-avatars', ...)   // ← This should be an API route
   fetch('/dashboard/prospect-' + id, ...)     // ← This should be an API route

   // CORRECT — after successful save:
   // Option A: If using API route
   const res = await fetch('/api/prospects/' + prospectId, {
     method: 'PATCH',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify(updatedProspectData)
   });
   if (res.ok) {
     // Close the edit modal and refresh the offer page data
     setEditModalOpen(false);
     router.refresh(); // refresh server components
     // OR mutate/revalidate the offer data
   }

   // Option B: If using server action
   await updateProspect(prospectId, updatedProspectData);
   setEditModalOpen(false);
   router.refresh();

2. If there's an avatar generation call that goes to a page route 
   instead of an API route, either:
   - Move it to /app/api/prospect-avatars/route.ts (create this file)
   - Or inline the avatar generation logic in the save handler

3. Make sure the API route for prospect updates EXISTS. If not, create:
   /app/api/prospects/[id]/route.ts with a PATCH handler that:
   - Validates the request body
   - Updates the prospect in the database
   - Returns the updated prospect

4. After save, the user should stay on or return to the offer detail page
   (/dashboard/offers/[offerId]) — NOT navigate away

VERIFY: Edit a prospect → Save → no 404 → modal closes → data refreshes

═══════════════════════════════════════════════════════════════════════════
BUG 2 (CRITICAL): PROSPECT IMAGES FAIL ON REGENERATE (ONLY FIRST WORKS)
═══════════════════════════════════════════════════════════════════════════

PROBLEM:
Clicking "Regenerate prospects (with bios)" generates 4 prospects with 
correct names/bios/difficulties, but only the FIRST prospect gets a 
photorealistic AI image. The other 3 show colored circle avatars with 
initials (MT, RJ, MP). This means image generation is failing silently 
for prospects 2-4.

ROOT CAUSE (likely one of these):
(a) Image generation calls are fired concurrently and the API rate-limits
(b) Only the first image generation is awaited; the rest are fire-and-forget
(c) An error in image generation for one prospect stops the entire batch
(d) The function returns/redirects after the first image completes

FIND THE CODE:
1. Search for "regenerate" or "Regenerate prospects" in the codebase
2. Find the API route or server action that handles prospect regeneration
3. Look for the image generation function — search for:
   - "dalle" or "openai" image calls
   - "replicate" API calls  
   - "generateImage" or "createImage" function
   - Any external AI image API calls
4. Look at how images are generated in a loop or batch

IMPLEMENTATION:
1. Find the regenerate function. It probably looks something like this:

   // CURRENT (BROKEN) — likely pattern:
   const prospects = await generateProspectsWithAI(offer);
   for (const prospect of prospects) {
     await saveProspect(prospect);
     const imageUrl = await generateImage(prospect); // fails silently after 1st
     await updateProspectImage(prospect.id, imageUrl);
   }

2. Replace with SERIALIZED image generation with proper error handling 
   and delays:

   const prospects = await generateProspectsWithAI(offer);

   // Save all prospects first (so they appear in UI immediately)
   const savedProspects = [];
   for (const prospect of prospects) {
     const saved = await saveProspect(prospect);
     savedProspects.push(saved);
   }

   // Then generate images ONE AT A TIME with delays
   for (let i = 0; i < savedProspects.length; i++) {
     const prospect = savedProspects[i];
     try {
       // Add delay between requests to avoid rate limiting
       if (i > 0) {
         await new Promise(resolve => setTimeout(resolve, 2000)); // 2 sec delay
       }

       const imageUrl = await generateProspectImage(prospect);

       if (imageUrl) {
         await updateProspectImage(prospect.id, imageUrl);
       } else {
         console.error(`Image generation returned null for prospect ${prospect.id}`);
       }
     } catch (error) {
       console.error(`Image generation failed for prospect ${prospect.name}:`, error);
       // Continue to next prospect — don't stop the batch
       // The prospect will show with initials fallback, which is acceptable
       // as a degraded state
     }
   }

3. If using an external API, also check:
   - Increase the timeout for image generation requests to 60 seconds
   - If the API has a rate limit header, respect it
   - If using OpenAI DALL-E: max 5 images/min on some tiers
   - If using Replicate: check for concurrent request limits

4. Make sure the image generation function has its own try/catch and 
   doesn't throw unhandled errors that would stop the loop.

5. Optional improvement: Add a loading skeleton on each prospect card 
   while its image is being generated. This gives the user feedback.
   When the page is refreshed after all images complete, they'll all show.

VERIFY: Click Regenerate → wait 30-60 seconds → ALL 4 prospects have 
photorealistic images. No colored circle fallbacks.

═══════════════════════════════════════════════════════════════════════════
BUG 3 (CRITICAL): CALL UPLOAD — NO PROGRESS INDICATOR
═══════════════════════════════════════════════════════════════════════════

PROBLEM:
When uploading a call recording (36MB+ audio), the UI shows a single 
"Uploading..." spinner with no progress. User can't tell if it's working,
how far along it is, or if it failed. For a process that takes 2-5 
minutes, this is unacceptable.

FIND THE CODE:
1. The upload form component — likely at:
   /app/dashboard/calls/new/page.tsx or a component it imports
2. The upload handler function (onSubmit or similar)
3. The API route that handles the upload + analysis pipeline

IMPLEMENTATION:
1. Create a step-based progress state in the upload form component:

   type UploadStep = 'idle' | 'uploading' | 'transcribing' | 'analysing' | 'complete' | 'error';

   const [currentStep, setCurrentStep] = useState<UploadStep>('idle');
   const [errorMessage, setErrorMessage] = useState<string>('');
   const [analysisId, setAnalysisId] = useState<string | null>(null);

2. Create a visual stepper component that shows all 4 steps:

   const steps = [
     { key: 'uploading', label: 'Uploading audio', sublabel: 'Sending file to server...' },
     { key: 'transcribing', label: 'Transcribing', sublabel: 'Converting speech to text...' },
     { key: 'analysing', label: 'Analysing call', sublabel: 'AI is reviewing your call. This may take 1-2 minutes...' },
     { key: 'complete', label: 'Complete', sublabel: 'Your analysis is ready!' },
   ];

   // Render as a vertical stepper with:
   // - Completed steps: green checkmark + green text
   // - Current step: spinning loader + bold text + sublabel
   // - Future steps: grey circle + grey text
   // - Error state: red X on failed step + error message + Retry button

3. Modify the upload handler to update steps:

   const handleUpload = async () => {
     try {
       setCurrentStep('uploading');
       setErrorMessage('');

       // Step 1: Upload the file
       const formData = new FormData();
       formData.append('file', selectedFile);
       formData.append('addToFigures', String(addToFigures));

       const uploadRes = await fetch('/api/calls/upload', {
         method: 'POST',
         body: formData,
       });

       if (!uploadRes.ok) {
         throw new Error('Upload failed. Please check your connection and try again.');
       }

       const { callId } = await uploadRes.json();

       // Step 2: Transcription
       setCurrentStep('transcribing');

       // If transcription is part of the upload response, skip polling
       // If it's async, poll for status:
       await pollForStatus(callId, 'transcribed');

       // Step 3: Analysis
       setCurrentStep('analysing');

       await pollForStatus(callId, 'completed');

       // Step 4: Complete
       setCurrentStep('complete');
       setAnalysisId(callId);

       // Auto-redirect after 2 seconds
       setTimeout(() => {
         router.push(`/dashboard/calls/${callId}`);
       }, 2000);

     } catch (error) {
       setCurrentStep('error');
       setErrorMessage(error.message || 'Something went wrong. Please try again.');
     }
   };

4. If the backend processes everything in ONE long request (upload + 
   transcribe + analyze all happen before response), then you can't 
   show real per-step progress. In that case:

   - Show a SIMULATED progress stepper that advances on timers:
     - "Uploading..." for 10 seconds
     - "Transcribing..." for 20 seconds  
     - "Analysing..." until response returns
   - This isn't perfect but is MUCH better than a single spinner

   // Simulated progress approach:
   setCurrentStep('uploading');

   const uploadPromise = fetch('/api/calls/upload', {
     method: 'POST',
     body: formData,
   });

   // Advance steps on timer while waiting for response
   const timer1 = setTimeout(() => setCurrentStep('transcribing'), 10000);
   const timer2 = setTimeout(() => setCurrentStep('analysing'), 30000);

   const res = await uploadPromise;
   clearTimeout(timer1);
   clearTimeout(timer2);

   if (res.ok) {
     setCurrentStep('complete');
     const { callId } = await res.json();
     setTimeout(() => router.push(`/dashboard/calls/${callId}`), 2000);
   } else {
     throw new Error('Analysis failed');
   }

5. Add a Retry button in the error state:

   {currentStep === 'error' && (
     <div>
       <p className="text-red-500">{errorMessage}</p>
       <button onClick={handleUpload}>Try Again</button>
       <button onClick={() => setCurrentStep('idle')}>Cancel</button>
     </div>
   )}

6. Add a timeout warning:

   const timer3 = setTimeout(() => {
     if (currentStep !== 'complete' && currentStep !== 'error') {
       setErrorMessage('This is taking longer than expected. You can wait or try again with a shorter recording.');
     }
   }, 300000); // 5 minutes

VERIFY: Upload a file → see steps advance → on complete, redirect to 
analysis. On failure, see error + retry button.

═══════════════════════════════════════════════════════════════════════════
BUG 4 (CRITICAL): SCORE MISMATCH — OVERALL ≠ SUM OF CATEGORIES
═══════════════════════════════════════════════════════════════════════════

PROBLEM:
Call Analysis Score Breakdown shows individual scores that sum to 30, 
but the overall score displays as 42/100. These must match.

Scoring rule: "Each category scores 0-10. Total score = /100."
The overall score MUST be the sum of the 10 individual category scores.

FIND THE CODE:
1. The call analysis display component — search for "Score Breakdown" or 
   "out of 100" in the codebase
2. The data structure returned by the analysis API — look for 
   "overall_score" or "totalScore" field
3. The AI prompt that generates the analysis — look for where you ask 
   the AI to output scores

IMPLEMENTATION:
1. In the Score Breakdown display component, find where the overall score 
   is rendered. It currently reads from something like:

   // WRONG:
   <span>{analysis.overall_score}</span>  // Uses AI's separate number

   // CORRECT:
   const calculatedOverall = analysis.categories.reduce(
     (sum, cat) => sum + (cat.score || 0), 0
   );
   <span>{calculatedOverall}</span>

   // Or if categories are stored as an object:
   const calculatedOverall = Object.values(analysis.categories).reduce(
     (sum, cat) => sum + (cat.score || 0), 0
   );

2. Apply this EVERYWHERE the overall score is displayed:
   - Call analysis page (Section 3)
   - Calls list view (if it shows scores)
   - Any summary cards
   - The roleplay review page (same logic applies there)

3. Also fix the AI prompt to prevent future confusion. In the prompt 
   where you ask for analysis output, add:

   "IMPORTANT: Do NOT include an overall_score field. The total score 
   is always calculated as the sum of all 10 category scores. Each 
   category is scored 0-10, making the maximum possible score 100."

4. If the AI response JSON includes an "overall_score" field, IGNORE it.
   Always calculate from individual scores on the frontend.

5. In the data model / database: if you store overall_score, either:
   - Stop storing it (calculate on read), OR
   - Calculate it correctly before storing:
     record.overall_score = categories.reduce((s, c) => s + c.score, 0);

VERIFY: View any call analysis → add up the 10 category scores manually 
→ they must equal the displayed overall score.

═══════════════════════════════════════════════════════════════════════════
BUG 5 (IMPORTANT): ROLEPLAY PROSPECT NAME NOT POPULATING IN LIST
═══════════════════════════════════════════════════════════════════════════

PROBLEM:
AI Roleplay list shows "—" for Prospect Name on all sessions, even though
prospects have names like "Jessica Harris" in the prospect data.

FIND THE CODE:
1. The roleplay session creation function — triggered when user clicks 
   "Start Roleplay" (currently "Start Discovery")
2. The roleplay sessions table/collection schema
3. The roleplay list page query and display component

IMPLEMENTATION:
1. Find where a roleplay session is created. Add the prospect name:

   // When creating a new roleplay session:
   const newSession = {
     userId: user.id,
     offerId: offer.id,
     prospectId: prospect.id,
     prospectName: prospect.name,       // ← ADD THIS
     offerName: offer.name,             // ensure this exists too
     offerType: offer.type,             // ensure this exists too  
     prospectDifficulty: prospect.difficulty, // ensure this exists too
     status: 'in_progress',
     createdAt: new Date(),
   };

   await db.roleplaySessions.create(newSession);

2. If the database schema doesn't have a prospect_name column:
   - Add it to the schema (nullable string, for backwards compatibility)
   - Run any necessary migration

3. In the roleplay list query, ensure prospect_name is selected:

   const sessions = await db.roleplaySessions.findMany({
     where: { userId: user.id },
     select: {
       id: true,
       createdAt: true,
       offerName: true,
       prospectName: true,    // ← INCLUDE THIS
       offerType: true,
       prospectDifficulty: true,
       score: true,
     },
     orderBy: { createdAt: 'desc' },
   });

4. In the list view component, display it:

   <td>{session.prospectName || '—'}</td>

VERIFY: Start a new roleplay → complete or abandon it → go to roleplay 
list → the new session should show the prospect's name.

═══════════════════════════════════════════════════════════════════════════
BUG 6 (IMPORTANT): "NEAR_IMPOSSIBLE" DIFFICULTY + WRONG MIX
═══════════════════════════════════════════════════════════════════════════

PROBLEM:
Prospect generation creates "Near_impossible" difficulty which is forbidden.
Must always create exactly 4 prospects: 1 Easy, 1 Realistic, 1 Hard, 
1 Expert. No other difficulties allowed.

FIND THE CODE:
1. The prospect generation AI prompt — search for "difficulty" in prompts
2. The prospect generation function/API route
3. Any difficulty enum, type, or constant definitions
4. UI badge color mappings for difficulty

IMPLEMENTATION:
1. In the AI prompt for prospect generation, replace the difficulty 
   instruction with:

   "Generate exactly 4 prospects. Each prospect MUST have one of these 
   difficulty levels — assign exactly one prospect to each level:

   1. Easy — prospect is warm, motivated, has budget, minimal objections
   2. Realistic — prospect is interested but has normal concerns and questions
   3. Hard — prospect is skeptical, price-sensitive, has strong objections
   4. Expert — prospect is highly resistant, challenges everything, requires 
      exceptional selling skill

   The ONLY valid difficulty values are: Easy, Realistic, Hard, Expert.
   Do NOT use any other value like 'Near_impossible', 'Medium', 'Impossible', etc."

2. After AI generates prospects, add server-side validation:

   const VALID_DIFFICULTIES = ['Easy', 'Realistic', 'Hard', 'Expert'];
   const REQUIRED_DIFFICULTIES = ['Easy', 'Realistic', 'Hard', 'Expert'];

   // Validate and fix difficulties
   generatedProspects.forEach((prospect, index) => {
     if (!VALID_DIFFICULTIES.includes(prospect.difficulty)) {
       // Force correct difficulty based on index
       prospect.difficulty = REQUIRED_DIFFICULTIES[index];
     }
   });

   // Ensure we have exactly 4 with correct distribution
   if (generatedProspects.length !== 4) {
     // Trim to 4 or pad with defaults
     while (generatedProspects.length > 4) generatedProspects.pop();
     // ... handle less than 4 if needed
   }

   // Ensure each difficulty appears exactly once
   const usedDifficulties = new Set();
   generatedProspects.forEach((prospect, index) => {
     if (usedDifficulties.has(prospect.difficulty)) {
       // Assign an unused difficulty
       const unused = REQUIRED_DIFFICULTIES.find(d => !usedDifficulties.has(d));
       if (unused) prospect.difficulty = unused;
     }
     usedDifficulties.add(prospect.difficulty);
   });

3. Update any TypeScript type definitions:

   type ProspectDifficulty = 'Easy' | 'Realistic' | 'Hard' | 'Expert';

   // Remove any references to 'Near_impossible', 'near_impossible', etc.

4. Update UI badge color mapping:

   const difficultyColors = {
     'Easy': 'green',
     'Realistic': 'blue',
     'Hard': 'orange', 
     'Expert': 'red',
   };

   // Remove any 'Near_impossible' entries from color maps

VERIFY: Regenerate prospects → exactly 4 → difficulties are Easy, 
Realistic, Hard, Expert (one each). No Near_impossible.

═══════════════════════════════════════════════════════════════════════════
BUG 7 (IMPORTANT): "START DISCOVERY" → "START ROLEPLAY"
═══════════════════════════════════════════════════════════════════════════

PROBLEM:
The prospect detail modal has a "Start Discovery" button. All roleplays 
are full sales calls — no Discovery/Objection Handling/Full Call modes.

FIND THE CODE:
1. Search entire codebase for "Start Discovery"
2. Search for "discovery" in roleplay-related files
3. Search for "objection handling" and "full call" as roleplay types
4. The prospect detail modal/dialog component

IMPLEMENTATION:
1. Find and replace the button text:

   // WRONG:
   <button>Start Discovery</button>

   // CORRECT:
   <button>Start Roleplay</button>

2. Search the ENTIRE codebase for these strings and remove/replace:
   - "Start Discovery" → "Start Roleplay"
   - "Start Objection Handling" → remove entirely
   - "Full Call" as a roleplay type label → remove
   - Any roleplay type selector/dropdown → remove
   - "discovery" as a roleplay mode/type value → remove or replace with "full_call"

3. If there's a roleplay type field in the session creation:

   // Either remove the type field entirely:
   const newSession = {
     // ... other fields
     // type: 'discovery',  ← DELETE THIS LINE
   };

   // Or always set to full_call:
   const newSession = {
     // ... other fields
     type: 'full_call',  // always full call, no other options
   };

4. Remove any UI that lets users choose between roleplay types 
   (buttons, tabs, dropdown, radio buttons, etc.)

VERIFY: Open prospect modal → button says "Start Roleplay". No roleplay 
type selection exists anywhere in the UI.

═══════════════════════════════════════════════════════════════════════════
BUG 8 (IMPORTANT): REMOVE "QUALIFIED" FIELD FROM UI
═══════════════════════════════════════════════════════════════════════════

PROBLEM:
"Qualified: Yes" appears in Call Analysis Section 7 (Sales Figures 
Outcome). The product spec says to remove Qualified entirely from the UI.

FIND THE CODE:
1. The figures outcome section in the call analysis page
2. The "Edit outcome" modal component
3. The manual call log form component
4. Search for "qualified" (case-insensitive) across the codebase

IMPLEMENTATION:
1. In the call analysis figures outcome display, remove the Qualified row:

   // REMOVE this entire block:
   <div>
     <span>Qualified:</span>
     <span>{outcome.qualified ? 'Yes' : 'No'}</span>
   </div>

2. In the "Edit outcome" modal, remove the Qualified checkbox:

   // REMOVE:
   <label>
     <input type="checkbox" checked={qualified} onChange={...} />
     Qualified
   </label>
   // Also remove any helper text about what "qualified" means

3. In the Manual Call Log form, remove the Qualified checkbox:

   // REMOVE any qualified checkbox and its label/helper text

4. Do NOT remove the qualified field from the database — keep it for 
   backwards compatibility. Just never display it in the UI.

5. Check if "Total Calls Qualified" on the Figures page depends on this 
   field. If it does, it should now be calculated based on call result 
   type instead (e.g., any result except "Unqualified" counts as qualified).

VERIFY: View call analysis → Section 7 has no "Qualified" field. Edit 
outcome modal has no Qualified checkbox. Manual Log has no Qualified checkbox.

═══════════════════════════════════════════════════════════════════════════
BUG 9 (IMPORTANT): ADD OFFER + PROSPECT NAME TO CALL OVERVIEW
═══════════════════════════════════════════════════════════════════════════

PROBLEM:
Call Analysis Section 1 (Call Overview) shows Call Date and Result but 
is missing Offer name and Prospect name. Both are required.

FIND THE CODE:
1. The call analysis page component — Section 1 area
2. The data structure for call analysis — check what fields are available
3. The API that returns analysis data

IMPLEMENTATION:
1. First, check what data is available in the analysis object. The offer 
   name and prospect name might come from:
   - analysis.outcome.offer_name or analysis.offer_name
   - analysis.outcome.prospect_name or analysis.prospect_name
   - The AI analysis itself (it may extract these from the transcript)
   - The linked offer record (if analysis has offer_id)

2. Add to the Section 1 metadata grid:

   <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
     <div>
       <span className="text-muted-foreground text-sm">Call Date</span>
       <p className="font-semibold">{formatDate(analysis.callDate)}</p>
     </div>
     <div>
       <span className="text-muted-foreground text-sm">Result</span>
       <Badge variant={resultVariant}>{analysis.outcome?.result || '—'}</Badge>
     </div>
     {/* ADD THESE TWO: */}
     <div>
       <span className="text-muted-foreground text-sm">Offer</span>
       <p className="font-semibold">{analysis.outcome?.offerName || analysis.offerName || '—'}</p>
     </div>
     <div>
       <span className="text-muted-foreground text-sm">Prospect</span>
       <p className="font-semibold">{analysis.outcome?.prospectName || analysis.prospectName || '—'}</p>
     </div>
   </div>

3. If the AI analysis extracts the prospect's name from the transcript,
   check if it's stored in the analysis data (e.g., analysis.prospect_name
   or analysis.call_overview.prospect_name). Use whatever is available.

4. If neither the outcome nor the analysis has these fields, check if 
   the AI prompt asks for them. If not, add to the AI prompt:

   "In the call overview section, include:
   - prospect_name: the name of the prospect (extract from transcript)
   - offer_name: the product/service being sold (extract from context)"

VERIFY: View call analysis → Section 1 shows Call Date, Result, Offer 
name, and Prospect name in a 4-column grid.

═══════════════════════════════════════════════════════════════════════════
BUG 10 (MINOR): REMOVE DUPLICATE AUDIO PLAYER
═══════════════════════════════════════════════════════════════════════════

PROBLEM:
The call analysis page has TWO audio players:
1. A "Call Recording" card with player at the very top (above Section 1)
2. A "Recording" subsection with player inside Section 1: Call Overview

Only the one inside Section 1 should exist.

FIND THE CODE:
The call analysis page component — search for <audio or any audio player 
component. There will be two instances.

IMPLEMENTATION:
1. Find the top-level "Call Recording" card/section. It's rendered BEFORE 
   Section 1 and looks something like:

   {/* REMOVE THIS ENTIRE BLOCK: */}
   <Card>
     <CardHeader>
       <h3>Call Recording</h3>
     </CardHeader>
     <CardContent>
       <audio controls src={audioUrl} />
     </CardContent>
   </Card>

2. Keep the audio player that's INSIDE the "1. Call Overview" section.

3. The page structure should be:
   - Page header: "Call Analysis" + Completed badge + file name
   - Section 1: Call Overview (contains Recording player + Transcript + metadata)
   - Section 2: Outcome Diagnostic
   - ... etc.

VERIFY: Only one audio player visible on the page, inside Section 1.

═══════════════════════════════════════════════════════════════════════════
BUG 11 (MINOR): PROSPECT NAME IN FIGURES COMMISSION TABLE
═══════════════════════════════════════════════════════════════════════════

PROBLEM:
Figures page commission table shows "—" for Prospect Name even when the 
call outcome has a prospect name.

FIND THE CODE:
1. The Figures page API/data fetching logic
2. The query that builds commission table data
3. The call outcomes table/data structure

IMPLEMENTATION:
1. In the query that fetches commission data, include the prospect_name 
   from the call outcome:

   // If using Supabase:
   const { data } = await supabase
     .from('call_outcomes')
     .select('date, offer_name, prospect_name, cash_collected, revenue_generated, commission_rate, commission_earned')
     .eq('user_id', userId)
     .gte('date', startOfMonth)
     .lte('date', endOfMonth);

   // If the prospect_name column doesn't exist on call_outcomes,
   // it might be on a related table — join appropriately

2. If prospect_name isn't stored in the outcome data at all, add it:
   - When saving/updating a call outcome (manual log or AI analysis),
     include the prospect_name field
   - Update the Manual Call Log form to save prospect_name to the outcome

3. Display in the table:

   <td>{entry.prospect_name || entry.prospectName || '—'}</td>

VERIFY: Log a manual call with a prospect name and close it → check 
Figures commission table shows the prospect name.

═══════════════════════════════════════════════════════════════════════════
BUG 12 (MINOR): REGENERATE REPLACES ALL PROSPECTS + CONFIRMATION
═══════════════════════════════════════════════════════════════════════════

PROBLEM:
One prospect is named "sbn" (the user's account name) — likely manually 
created. The regenerate function should replace ALL prospects including 
manually created ones, and should ask for confirmation first.

FIND THE CODE:
1. The "Regenerate prospects (with bios)" button handler
2. The regenerate API/function

IMPLEMENTATION:
1. Add a confirmation dialog before regenerating:

   const handleRegenerate = async () => {
     const confirmed = window.confirm(
       'This will replace all current prospects with 4 new AI-generated prospects. Continue?'
     );
     // Or use a proper modal/dialog component:
     // setShowRegenerateConfirm(true);

     if (!confirmed) return;

     // Proceed with regeneration...
   };

2. In the regenerate function, delete ALL existing prospects for the offer 
   before creating new ones:

   // Delete ALL existing prospects (including manually created)
   await db.prospects.deleteMany({
     where: { offerId: offerId }
   });

   // Generate 4 new prospects with AI
   const newProspects = await generateProspectsWithAI(offer);

   // Save them (with image generation per BUG 2 fix)
   for (const prospect of newProspects) {
     await saveProspect({ ...prospect, offerId });
   }

VERIFY: Click Regenerate → see confirmation dialog → confirm → "sbn" 
prospect is gone → 4 new properly named prospects appear.

═══════════════════════════════════════════════════════════════════════════
FINAL CHECKLIST — VERIFY ALL 12 FIXES
═══════════════════════════════════════════════════════════════════════════

After implementing all fixes, test each one:

□ BUG 1:  Edit prospect → Save → no 404, returns to offer page
□ BUG 2:  Regenerate prospects → ALL 4 get photorealistic images
□ BUG 3:  Upload call → see step-by-step progress (upload → transcribe → analyse → complete)
□ BUG 4:  Call analysis overall score = sum of 10 category scores
□ BUG 5:  Start new roleplay → roleplay list shows prospect name
□ BUG 6:  Regenerate → 4 prospects: Easy, Realistic, Hard, Expert only
□ BUG 7:  Prospect modal button says "Start Roleplay"
□ BUG 8:  Call analysis Section 7 → no "Qualified" field anywhere
□ BUG 9:  Call analysis Section 1 → shows Offer name + Prospect name
□ BUG 10: Call analysis page → single audio player (inside Section 1)
□ BUG 11: Figures commission table → shows prospect name from outcome
□ BUG 12: Regenerate → confirmation dialog → replaces all including manual

Ensure build compiles. Deploy. Confirm deployment succeeds.