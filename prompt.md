Here's Prompt 6 — copy and paste directly to your agent:

text
# ClosePro — Roleplay Opening Behavior + Voice Reconnection Fix

## CONTEXT
Investigation found that OPENING_TEMPLATES in behaviour-rules.ts directly 
contradict system prompt rules. The system prompt says "Do NOT reveal 
skepticism immediately" but the templates open with maximum skepticism 
like "I've been burned before, so convince me" and "What makes yours 
different from everyone else?". This makes the prospect sound unnatural 
and AI-like. Additionally, the prospect dumps too much information in the 
first 2-3 turns instead of being brief and guarded like a real person.

Also: voice reconnection logic fetches a new signed URL each time, which 
could change the voice config mid-session.

## FIX 1: Rewrite OPENING_TEMPLATES

File: lib/ai/roleplay/behaviour-rules.ts

Find the OPENING_TEMPLATES object (search for "OPENING_TEMPLATES" or 
"getOpeningLine" or opening template strings like "convince me" or 
"what makes yours different").

REPLACE ALL opening templates with brief, natural, low-information greetings.
The prospect should sound like a real person who just joined a Zoom call — 
not an AI character announcing their personality.

### Rules for new openings:
- Maximum 3-8 words per opening line
- No questions asked by prospect in their first turn
- No skepticism, backstory, or context revealed
- No "convince me" or "what makes you different" energy
- The closer speaks first and sets the frame
- Difficulty/skepticism emerges LATER through responses, not in the opening

### New templates by funnel context + difficulty:

Replace with this structure (adapt to match the exact keys/categories that 
currently exist in the object — if there are more funnel types than listed 
here, create similar brief greetings following the same pattern):

```ts
// WARM INBOUND — prospect booked the call themselves
warm_inbound: {
  easy: [
    "Hey, how's it going?",
    "Hi! Yeah, I'm here.",
    "Hey, thanks for jumping on.",
  ],
  realistic: [
    "Hi, yeah I'm here.",
    "Hey. Alright, go ahead.",
    "Hi. So yeah, I booked this in.",
  ],
  hard: [
    "Hey.",
    "Hi. Yeah, go for it.",
    "Alright, I'm here.",
  ],
  expert: [
    "Hey.",
    "Hi.",
    "Yeah, I'm here. Go ahead.",
  ],
  near_impossible: [
    "Hey.",
    "Hi. Yeah.",
    "Mm, go ahead.",
  ],
},

// COLD OUTBOUND — prospect was contacted, didn't initiate
cold_outbound: {
  easy: [
    "Oh hey, yeah someone mentioned you'd call.",
    "Hi, yeah I got your message.",
    "Hey. Yeah, go ahead.",
  ],
  realistic: [
    "Hey, yeah? What's this about?",
    "Hi. Yeah, someone said to jump on this.",
    "Yeah, hi. I got a call booked in?",
  ],
  hard: [
    "Yeah?",
    "Hey. What's this about then?",
    "Hi. Go ahead.",
  ],
  expert: [
    "Yeah?",
    "Who's this?",
    "Hey. Yeah, go on.",
  ],
  near_impossible: [
    "Yeah?",
    "Mm.",
    "Hey. What is it?",
  ],
},

// REFERRAL — someone they know sent them
referral: {
  easy: [
    "Hey! Yeah, they told me to speak to you.",
    "Hi, yeah I was told to jump on this.",
    "Hey, how's it going?",
  ],
  realistic: [
    "Hi, yeah they mentioned you.",
    "Hey. Yeah, I was told to have a chat.",
    "Hi. Yeah, go ahead.",
  ],
  hard: [
    "Hey. Yeah, they said to call.",
    "Hi.",
    "Yeah, I was told to speak to you.",
  ],
  expert: [
    "Hey.",
    "Hi. Yeah.",
    "Yeah?",
  ],
  near_impossible: [
    "Hey.",
    "Yeah.",
    "Hi.",
  ],
},

// APPLICATION / FORM FILL — prospect filled out a form
application: {
  easy: [
    "Hey! Yeah, I filled that form out.",
    "Hi, yeah I applied.",
    "Hey, thanks for calling.",
  ],
  realistic: [
    "Hi, yeah I submitted something.",
    "Hey. Yeah, I filled a form in.",
    "Hi. Yeah, go ahead.",
  ],
  hard: [
    "Hey. Yeah.",
    "Hi.",
    "Yeah, I filled something in.",
  ],
  expert: [
    "Hey.",
    "Hi. Yeah.",
    "Yeah?",
  ],
  near_impossible: [
    "Hey.",
    "Yeah.",
    "Hi.",
  ],
},
IMPORTANT:

Check what funnel context keys currently exist in OPENING_TEMPLATES
and make sure ALL of them are covered with new templates

Check what difficulty tier keys are used (easy/realistic/hard/expert/
near_impossible) and match them exactly

If the current structure uses different key names (e.g., "warm" instead
of "warm_inbound"), use the EXISTING key names with the new template text

Preserve the getOpeningLine() function signature — only change the
template content

FIX 2: Strengthen System Prompt Opening Rules
File: lib/ai/roleplay/roleplay-engine.ts

Find where the system prompt is assembled — look for the section where
behavioral rules are injected (around where "Do NOT reveal skepticism"
and "Stay in character" rules exist).

ADD this as the FIRST rule block, BEFORE all other behavioral rules
(high priority = placed first):

text
CRITICAL — OPENING BEHAVIOR:
- Your FIRST response must be 3-8 words maximum.
- Do NOT ask questions in your first turn.
- Do NOT mention skepticism, past experiences, or concerns in your opening.
- Do NOT give backstory or context unprompted.
- Simply greet and let the closer set the frame.
- Examples: "Hey, what's up?", "Hi yeah, go ahead.", "Alright, I'm here."

FIRST 3 EXCHANGES RULE:
- For your FIRST 3 responses in the conversation, respond with maximum 
  1-2 sentences each.
- Do NOT volunteer problems, backstory, financial situation, or past 
  attempts until the closer specifically asks about them.
- If the closer asks an open question, give a brief surface-level answer 
  only. Go deeper only when they probe further.
- Skepticism and resistance should emerge gradually through your TONE and 
  BREVITY, not through explicit statements like "I'm skeptical" or 
  "convince me".
- After 3+ exchanges where the closer has asked substantive questions, 
  you may begin opening up more naturally based on your character profile.
Also find and REMOVE or SOFTEN any conflicting instructions that tell
the prospect to:

"Go on natural tangents" (in early turns this causes info-dumping)

"Ramble slightly" (remove for first 3 turns)

Any template that says to be confrontational in the opening

If "ramble" or "tangent" instructions exist, modify them to say:
"After the first 3-4 exchanges, you may go on brief natural tangents
when the closer asks open questions. Keep tangents to 1-2 sentences."

FIX 3: Voice Reconnection — Reuse Signed URL
File: hooks/use-voice-session.ts

Find the reconnection logic (the code that calls
/api/roleplay/[sessionId]/voice-token to get a signed URL).

Currently it fetches a NEW signed URL on every reconnect attempt.
This could change the voice if the ElevenLabs agent config was updated
between connects.

Add caching to reuse the same signed URL within its validity window:

ts
// Add a ref to store the signed URL and its creation timestamp
const signedUrlCacheRef = useRef<{ url: string; createdAt: number } | null>(null);

// Replace or wrap the existing signed URL fetch with:
const getOrFetchSignedUrl = async (sessionId: string): Promise<string> => {
  // Reuse existing URL if less than 8 minutes old 
  // (signed URLs are typically valid for ~10 minutes)
  if (
    signedUrlCacheRef.current && 
    Date.now() - signedUrlCacheRef.current.createdAt < 8 * 60 * 1000
  ) {
    return signedUrlCacheRef.current.url;
  }
  
  // Fetch new signed URL
  const response = await fetch(`/api/roleplay/${sessionId}/voice-token`);
  if (!response.ok) throw new Error('Failed to fetch voice token');
  const data = await response.json();
  
  // Cache it
  signedUrlCacheRef.current = { 
    url: data.signedUrl || data.signed_url || data.url, 
    createdAt: Date.now() 
  };
  
  return signedUrlCacheRef.current.url;
};
Then update all places where the signed URL is fetched to use
getOrFetchSignedUrl() instead of direct fetch calls.

Also add a cleanup on session end:

ts
// When session ends or component unmounts, clear the cache
const clearVoiceCache = () => {
  signedUrlCacheRef.current = null;
};
VERIFICATION
npm run build — exit code 0 (or tsc --noEmit with no new errors)

Report: total number of opening templates replaced and list 3 examples
of old vs new for different difficulty levels

Report: the exact text of the new system prompt opening rules added
to roleplay-engine.ts

Report: any conflicting "ramble"/"tangent" instructions found and
how they were modified

Report: the signed URL caching implementation in use-voice-session.ts

List ALL files changed with a summary of changes per file