Here's the complete Prompt 3. Send this to your agent now:

text
PROMPT 3: ROLEPLAY BACKEND V2 + PHASE REPLAY SUPPORT

══════════════════════════════════════════════════════════════
CONTEXT
══════════════════════════════════════════════════════════════

Call Review v2.0 is DONE: phase-based scoring (6 phases, /100), horizontal tabs, 
shared components (ProspectDifficultyPanel, OutcomeDiagnostic, PhaseAnalysisTabs, 
ActionPointCards), Replay buttons that link to /dashboard/roleplay?phase=X&callId=Y.

The roleplay results page ALREADY imports and renders the shared components — but 
isV2 is ALWAYS false because the roleplay backend doesn't persist v2 columns yet.

This prompt has 2 goals:
A) Make roleplay analyses output + persist v2 format so isV2 becomes true
B) Wire the Replay/Re-run buttons so phase-specific practice sessions actually work

BEFORE MAKING ANY CHANGES, explore the codebase to understand:
1. The roleplay analysis pipeline end-to-end:
   - How roleplay sessions are created (API route, what params)
   - How roleplay transcripts are generated/stored
   - How roleplay analysis is triggered (after session ends? manually?)
   - What AI prompt is used for roleplay analysis (same as calls? separate?)
   - Where roleplay analysis results are persisted (which table, which columns)
   - How the results page fetches analysis data (which API route)

2. The roleplay session flow:
   - How sessions start (/dashboard/roleplay page or API)
   - How the AI prospect works (system prompt, real-time or turn-based)
   - What configuration a session accepts (offer, avatar, etc.)
   - How sessions end and trigger analysis

Run these searches:
  grep -rn "roleplay" --include="*.ts" db/schema.ts
  grep -rn "analyzeRoleplay\|roleplay.*analy\|analy.*roleplay" --include="*.ts" lib/ app/api/
  grep -rn "roleplay.*session\|session.*create\|startSession" --include="*.ts" app/api/
  grep -rn "roleplay.*prompt\|system.*message.*roleplay\|prospect.*behavior" --include="*.ts" lib/
  ls -la app/api/roleplay/
  ls -la lib/roleplay/

Read the key files you find. Map the full data flow before writing any code.

══════════════════════════════════════════════════════════════
STEP 1: ADD V2 COLUMNS TO ROLEPLAY ANALYSIS TABLE
══════════════════════════════════════════════════════════════

File: db/schema.ts

Find the roleplay analysis table (might be called roleplayAnalysis, 
roleplay_analysis, roleplaySessions with analysis columns, etc.)

Add 7 new NULLABLE text columns (same as callAnalysis):
  - phaseScores (JSON: { overall, intro, discovery, pitch, close, objections })
  - phaseAnalysis (JSON: per-phase detail)
  - outcomeDiagnosticP1 (text)
  - outcomeDiagnosticP2 (text)
  - closerEffectiveness (text: above_expectation | at_expectation | below_expectation)
  - prospectDifficultyJustifications (JSON: per-dimension text)
  - actionPoints (JSON: max 2 items)

Also add 4 columns for phase replay context on the sessions table:
  - replayPhase: text (nullable) — "intro"|"discovery"|"pitch"|"close"|"objection"|"skill"|null
  - replaySourceCallId: text (nullable) — original call ID
  - replaySourceSessionId: text (nullable) — original roleplay session ID  
  - replayContext: text (nullable, JSON) — the specific feedback/objection/skill data

Keep ALL existing columns. Delete nothing.

══════════════════════════════════════════════════════════════
STEP 2: UPDATE ROLEPLAY ANALYSIS TO OUTPUT V2 FORMAT
══════════════════════════════════════════════════════════════

Based on what you found exploring the codebase:

IF roleplay uses the SAME analyzeCall() function from lib/ai/analysis.ts:
  → No prompt changes needed. V2 prompt already outputs phase-based format.
  → Just ensure the roleplay pipeline forwards the result to persistence (Step 3).

IF roleplay has a SEPARATE analysis function/prompt:
  → Update it to output the SAME v2 JSON schema:
  
  {
    "overallScore": 72,
    "phaseScores": {
      "overall": 72,
      "intro": 80,
      "discovery": 65,
      "pitch": 70,
      "close": 60,
      "objections": 75
    },
    "phaseAnalysis": {
      "overall": {
        "summary": "...",
        "biggestImprovementTheme": "...",
        "isStrongCall": false
      },
      "intro": {
        "summary": "...",
        "whatWorked": ["...", "..."],
        "whatLimitedImpact": "...",
        "timestampedFeedback": [
          {
            "timestamp": "1:23",
            "whatHappened": "...",
            "whatShouldHaveHappened": "...",
            "whyItMatters": "..."
          }
        ]
      },
      // ... same structure for discovery, pitch, close
      "objections": {
        "blocks": [
          {
            "type": "price",
            "quote": "...",
            "timestamp": "5:30",
            "whySurfaced": "...",
            "howHandled": "...",
            "higherLeverageAlternative": "..."
          }
        ]
      }
    },
    "outcomeDiagnosticP1": "...",
    "outcomeDiagnosticP2": "...",
    "prospectDifficulty": {
      "icpAlignment": 3,
      "painAndAmbition": 5,
      "funnelWarmth": 4,
      "authorityAndCoachability": 6,
      "executionResistance": 7
    },
    "prospectDifficultyJustifications": {
      "icpAlignment": "...",
      "painAndAmbition": "...",
      "funnelWarmth": "...",
      "authorityAndCoachability": "...",
      "executionResistance": "..."
    },
    "actionPoints": [
      {
        "thePattern": "...",
        "whyItsCostingYou": "...",
        "whatToDoInstead": "...",
        "microDrill": "..."
      }
    ]
  }

  → For roleplay, inject the prospect avatar's difficulty dimensions as locked 
    context in the prompt (the AI should reference the avatar settings, not 
    invent difficulty scores).

  → Import and use calculateCloserEffectiveness() from lib/ai/analysis.ts 
    for the deterministic closer effectiveness calculation.

  → Run the result through normalizeV2Analysis() from lib/ai/analysis.ts 
    (or apply the same clamping/validation logic).

══════════════════════════════════════════════════════════════
STEP 3: PERSIST V2 COLUMNS IN ROLEPLAY ANALYSIS
══════════════════════════════════════════════════════════════

Find where roleplay analysis results are saved to the DB.

Update the INSERT/UPDATE to include:
  phaseScores: JSON.stringify(result.phaseScores)
  phaseAnalysis: JSON.stringify(result.phaseAnalysis)
  outcomeDiagnosticP1: result.outcomeDiagnosticP1
  outcomeDiagnosticP2: result.outcomeDiagnosticP2
  closerEffectiveness: calculateCloserEffectiveness(difficultyTotal, overallScore)
  prospectDifficultyJustifications: JSON.stringify(result.prospectDifficultyJustifications)
  actionPoints: JSON.stringify(result.actionPoints?.slice(0, 2))

Add auto-migration catch block (same pattern as lib/calls/analyze-call.ts):
On column-not-found error, run ALTER TABLE to add missing columns, retry INSERT.

══════════════════════════════════════════════════════════════
STEP 4: UPDATE ROLEPLAY RESULTS API RESPONSE
══════════════════════════════════════════════════════════════

Find the API route that returns roleplay analysis to the frontend results page.
(The results page fetches from somewhere — find that endpoint.)

Update the response to include v2 fields:
  phaseScores: row.phaseScores (raw text — frontend parses via safeParse)
  phaseAnalysis: row.phaseAnalysis
  outcomeDiagnosticP1: row.outcomeDiagnosticP1
  outcomeDiagnosticP2: row.outcomeDiagnosticP2
  closerEffectiveness: row.closerEffectiveness
  prospectDifficultyJustifications: row.prospectDifficultyJustifications
  actionPoints: row.actionPoints

Also include replay context if present on the session:
  replayPhase: session.replayPhase
  replaySourceCallId: session.replaySourceCallId
  replaySourceSessionId: session.replaySourceSessionId

══════════════════════════════════════════════════════════════
STEP 5: WIRE REPLAY BUTTONS — SESSION CREATION WITH PHASE CONTEXT
══════════════════════════════════════════════════════════════

Find how roleplay sessions are created. There should be:
- A page where users configure and start a roleplay (/dashboard/roleplay or similar)
- An API route that creates the session record in the DB
- A mechanism that passes config (offer, avatar) to the AI

Update the SESSION CREATION flow to accept replay parameters:

When the roleplay page loads with query params like:
  ?phase=intro&callId=abc123
  ?phase=objection&objectionIndex=0&callId=abc123
  ?phase=discovery&sessionId=xyz789
  ?skill=Pattern+Name&callId=abc123

Do this:

1. READ the query params on the roleplay page:
   const searchParams = useSearchParams()
   const replayPhase = searchParams.get('phase')
   const replayCallId = searchParams.get('callId')
   const replaySessionId = searchParams.get('sessionId')
   const replayObjectionIndex = searchParams.get('objectionIndex')
   const replaySkill = searchParams.get('skill')
   const isPhaseReplay = !!(replayPhase || replaySkill)

2. If isPhaseReplay, FETCH the original analysis to get context:
   - If replayCallId: GET /api/calls/{replayCallId}/status
   - If replaySessionId: GET the roleplay session's analysis
   
   Extract from the original analysis:
   - The specific phase's feedback (phaseAnalysis[phase])
   - The prospect difficulty profile
   - The offer details
   - For objection: the specific objection block at objectionIndex
   - For skill: the action point matching the skill name

3. Show a BANNER at the top of the roleplay page:
   - If phase: "Phase Practice: [Phase Name] — from [date] call"
   - If skill: "Skill Training: [Skill Name]"
   - "Back to Review" link → /dashboard/calls/{callId} or /dashboard/roleplay/{sessionId}/results
   - The banner should be dismissible but visible

4. When the session is CREATED (API call), pass the replay context:
   Include in the request body:
   {
     ...existingParams,
     replayPhase: replayPhase || (replaySkill ? 'skill' : null),
     replaySourceCallId: replayCallId,
     replaySourceSessionId: replaySessionId,
     replayContext: JSON.stringify({
       phase: replayPhase,
       skill: replaySkill,
       objectionIndex: replayObjectionIndex ? parseInt(replayObjectionIndex) : null,
       originalFeedback: extractedFeedbackFromOriginalAnalysis,
       originalObjection: extractedObjectionBlock,
       originalActionPoint: extractedActionPoint
     })
   }

5. The session creation API route should SAVE these 4 new columns:
   replayPhase, replaySourceCallId, replaySourceSessionId, replayContext

══════════════════════════════════════════════════════════════
STEP 6: MODIFY ROLEPLAY AI PROSPECT PROMPT FOR PHASE PRACTICE
══════════════════════════════════════════════════════════════

Find the AI system prompt that controls the roleplay prospect's behavior.
When the session has replayPhase set, APPEND phase-specific instructions.

The existing prospect prompt stays intact — these are ADDITIONS:

FOR phase = "intro":
  "PHASE PRACTICE MODE: This session focuses on the INTRODUCTION phase.
   Start as a prospect being contacted. Be slightly guarded initially.
   The closer needs to practice: establishing authority, frame control, tone.
   Their previous attempt feedback: [insert originalFeedback.summary]
   What limited their impact: [insert originalFeedback.whatLimitedImpact]
   After 2-3 minutes of intro practice, naturally signal you're ready to move on.
   Do NOT extend into deep discovery or pitch — keep it focused on intro skills."

FOR phase = "discovery":
  "PHASE PRACTICE MODE: This session focuses on the DISCOVERY phase.
   Start as if intro is done — you have surface interest but haven't shared deep pain.
   The closer needs to practice: depth of questioning, emotional leverage, gap creation.
   Their previous attempt feedback: [insert originalFeedback.summary]
   What limited their impact: [insert originalFeedback.whatLimitedImpact]
   Allow 5-7 minutes. Reward good questions with deeper answers. Stay surface-level 
   if questions are shallow. Do NOT jump to pitch."

FOR phase = "pitch":
  "PHASE PRACTICE MODE: This session focuses on the PITCH phase.
   Start as a prospect who has shared problems and is ready to hear a solution.
   Briefly summarize your situation when asked, then let them pitch.
   The closer needs to practice: structure, personalization, outcome framing.
   Their previous attempt feedback: [insert originalFeedback.summary]
   What limited their impact: [insert originalFeedback.whatLimitedImpact]
   Allow 3-5 minutes. React authentically to the pitch."

FOR phase = "close":
  "PHASE PRACTICE MODE: This session focuses on the CLOSE phase.
   Start as a prospect who has heard the pitch and sees value but hasn't committed.
   You're interested but have natural hesitation about making a decision.
   The closer needs to practice: assumptive close, leadership, handling silence.
   Their previous attempt feedback: [insert originalFeedback.summary]
   What limited their impact: [insert originalFeedback.whatLimitedImpact]
   Allow 3-5 minutes. Commit if they handle the close well."

FOR phase = "objection":
  "PHASE PRACTICE MODE: This session focuses on handling a specific objection.
   After 1-2 exchanges of rapport, raise this objection: '[originalObjection.quote]'
   Objection type: [originalObjection.type].
   Why this surfaces: [originalObjection.whySurfaced]
   How they previously handled it: [originalObjection.howHandled]
   Be realistic — maintain the objection if they fumble, yield if they handle it well.
   After the objection is resolved (or failed), you may raise it once more with 
   a different angle to test consistency."

FOR replaySkill (phase = "skill"):
  "PHASE PRACTICE MODE: This session focuses on a specific skill.
   The closer needs to work on: [replayContext.skill]
   Why it matters: [originalActionPoint.whyItsCostingYou]
   What they should practice: [originalActionPoint.whatToDoInstead]
   Training drill: [originalActionPoint.microDrill]
   Create natural conversation moments that specifically test this skill.
   The call should proceed normally but you should create 2-3 opportunities 
   where this skill is needed."

Implementation:
  - Read replayPhase and replayContext from the session record
  - Parse replayContext JSON
  - Build the phase-specific addition string
  - Append to the existing system prompt (after all other instructions)
  - If replayPhase is null/undefined, add nothing (normal session)

══════════════════════════════════════════════════════════════
STEP 7: PHASE REPLAY RESULTS COMPARISON
══════════════════════════════════════════════════════════════

File: app/(dashboard)/dashboard/roleplay/[sessionId]/results/page.tsx

The results page already has v2 rendering via shared components.
Add phase replay awareness:

1. Check if the session has replay context:
   - The API response (Step 4) now includes replayPhase, replaySourceCallId, 
     replaySourceSessionId

2. If replayPhase exists:

   a. Fetch the ORIGINAL analysis for comparison:
      - If replaySourceCallId: GET /api/calls/{id}/status → extract phase score
      - If replaySourceSessionId: GET roleplay analysis → extract phase score
      Store as originalPhaseScore

   b. Show a comparison banner at the top:
      Card with:
      - Title: "Phase Practice: [Phase Name]" (or "Skill Training: [Skill Name]")
      - "Original Score: XX/100 → Practice Score: YY/100"
      - Arrow icon colored: green if improved by 5+, red if dropped by 5+, gray otherwise
      - "Practice Again" button → same replay URL
      - "Back to Original" link → call detail or roleplay results page

   c. Pass defaultTab to PhaseAnalysisTabs:
      <PhaseAnalysisTabs 
        ...existingProps
        defaultTab={session.replayPhase === 'skill' ? 'overall' : session.replayPhase}
      />

3. If NO replayPhase → render normally (no banner, default tab = 'overall')

══════════════════════════════════════════════════════════════
STEP 8: PUSH SCHEMA CHANGES
══════════════════════════════════════════════════════════════

Run: npx drizzle-kit push --config=drizzle.config.ts

If DNS fails, add new Neon hostname to hosts file (same pattern as before)
or run ALTER TABLE statements via a Node.js script.

The new columns needed:
  - roleplay analysis table: 7 v2 columns
  - roleplay sessions table: 4 replay context columns

══════════════════════════════════════════════════════════════
STEP 9: BUILD AND VERIFY
══════════════════════════════════════════════════════════════

npm run build — zero errors.

══════════════════════════════════════════════════════════════
OUTPUT REQUIRED
══════════════════════════════════════════════════════════════

1. All files created and modified (with summary of changes per file)
2. Whether roleplay uses same or separate AI analysis prompt from calls
3. The full phase-specific AI prompt additions (exact text)
4. The roleplay session creation data flow:
   Replay button click → page load → context fetch → session create → AI prompt → analysis → results
5. Migration SQL or drizzle-kit push result
6. How the comparison banner fetches original scores
7. Assumptions made and any limitations
8. Build result

══════════════════════════════════════════════════════════════
DO NOT CHANGE
══════════════════════════════════════════════════════════════

- lib/ai/analysis.ts — call analysis prompt is DONE, don't touch
- lib/calls/analyze-call.ts — call persistence is DONE, don't touch  
- app/(dashboard)/dashboard/calls/[callId]/page.tsx — call review page is DONE
- app/components/call-review/* — shared components are DONE (except adding 
  defaultTab which was already done in the audit)
- V1 backward compat on any page — keep as-is
- Performance page — don't touch
This is the biggest prompt of the 4. It touches:

DB schema (11 new columns across 2 tables)

Roleplay AI analysis (v2 output format)

Roleplay persistence (7 new columns saved)

Roleplay results API (expose v2 + replay fields)

Roleplay page (query param handling, context fetch, banner)

Roleplay AI prospect (6 phase-specific prompt additions)

Roleplay results (comparison banner, defaultTab)

Schema push (migration)