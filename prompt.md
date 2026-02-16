COMBINED FIX: Dynamic Variables + maxDuration + Scoring Timeout. Do NOT change any scoring logic, dashboard, or analysis components. Read this entire prompt before starting.

Context
Voice connection is now STABLE (confirmed working for 3+ minutes). But:

The prospect uses dashboard defaults instead of per-session personality/offer/voice

The prospect reads bracketed stage directions aloud like "[trailing off]"

Scoring times out on first attempt (Vercel default 15s, we're on Pro plan = 300s max)

The ElevenLabs dashboard system prompt has been updated to use dynamic variables: {{prospect_context}}, {{offer_info}}, {{first_message}}. The first message field is now {{first_message}}.

Task 1: Add maxDuration to all heavy LLM routes
Add this line at the very top of each file (before imports):

typescript
export const maxDuration = 300;
Add it to these files:

app/api/roleplay/[sessionId]/score/route.ts

app/api/roleplay/[sessionId]/voice-token/route.ts

app/api/calls/[callId]/analyze/route.ts (or wherever call analysis POST handler lives)

Any other API route file that calls Groq or OpenAI for analysis/scoring (search for GROQ_API_KEY or OPENAI_API_KEY usage in route files)

This prevents Vercel from killing scoring requests at 15 seconds. On Pro plan, 300s is the maximum.

Task 2: Return dynamic variables from voice-token route
In app/api/roleplay/[sessionId]/voice-token/route.ts:

The route already builds systemPrompt (the full roleplay system prompt), initialMessage, and voiceId. Currently it returns them as separate fields. Change the response to also include dynamicVariables.

The systemPrompt that buildRoleplaySystemPrompt / buildVoiceSystemPrompt returns contains multiple sections. We need to split it into two parts for the dynamic variables:

prospect_context: Everything about the prospect — their name, age, background, personality, objections, pain points, communication style, difficulty, authority level. This is the bulk of the system prompt that describes WHO the prospect is.

offer_info: Everything about what the closer is selling — the offer name, category, price, description, value proposition.

Approach: Don't try to regex-parse the systemPrompt. Instead, build prospect_context and offer_info directly from the data you already have:

typescript
// You already have these variables in the route:
// - prospectAvatar (name, description, objections, pain points, etc.)
// - offerData (name, category, price, etc.)
// - behaviourState (resistance, trust, openness)
// - replayContext (if replay mode)

const prospect_context = [
  `Name: ${prospectName}`,
  prospectAvatar.description ? `Background: ${prospectAvatar.description}` : '',
  prospectAvatar.positionDescription ? `Context: ${prospectAvatar.positionDescription}` : '',
  prospectAvatar.objections?.length ? `Key objections: ${prospectAvatar.objections.join(', ')}` : '',
  prospectAvatar.painPoints?.length ? `Pain points: ${prospectAvatar.painPoints.join(', ')}` : '',
  prospectAvatar.communicationStyle ? `Communication style: ${prospectAvatar.communicationStyle}` : '',
  prospectAvatar.difficultyTier ? `Difficulty: ${prospectAvatar.difficultyTier}` : '',
  prospectAvatar.authorityLevel ? `Authority: ${prospectAvatar.authorityLevel}` : '',
  prospectAvatar.motivationIntensity ? `Motivation: ${prospectAvatar.motivationIntensity}/10` : '',
].filter(Boolean).join('\n');

const offer_info = [
  offerData?.?.offerName ? `Offer: ${offerData[0].offerName}` : '',
  offerData?.?.offerCategory ? `Category: ${offerData[0].offerCategory}` : '',
  offerData?.?.price ? `Price: ${offerData[0].price}` : '',
  offerData?.?.description ? `Description: ${offerData[0].description}` : '',
].filter(Boolean).join('\n');
Then update the return to include dynamicVariables:

typescript
return NextResponse.json({
  signedUrl,
  dynamicVariables: {
    prospect_context,
    offer_info,
    first_message: initialMessage.content,
  },
  voiceId,
  // Keep systemPrompt and firstMessage in response for text-mode fallback
  systemPrompt,
  firstMessage: initialMessage.content,
  prospectName,
});
Task 3: Pass dynamic variables in startSession
In hooks/use-voice-session.ts:

In startVoice() — update to destructure and pass dynamicVariables:

typescript
const { signedUrl, dynamicVariables } = await tokenRes.json();

await conversation.startSession({
  signedUrl,
  dynamicVariables,  // ElevenLabs SDK injects these into {{prospect_context}}, {{offer_info}}, {{first_message}}
});
In attemptReconnect() — same pattern:

typescript
const { signedUrl, dynamicVariables } = await tokenRes.json();

if (!conv) throw new Error('Conversation instance not available');

await conv.startSession({
  signedUrl,
  dynamicVariables,
});
Keep useConversation() bare — NO overrides object, exactly as it is now. Only onConnect, onDisconnect, onMessage, onError, onStatusChange callbacks.

Remove any leftover refs that were added for the override approach (systemPromptRef, firstMessageRef, voiceIdRef) — they're no longer needed.

Task 4: Verify and clean up
Remove unused imports (voiceSettings destructuring, etc.) from both the voice-token route and use-voice-session.ts

Run npx tsc --noEmit and confirm no new errors in the modified files

Confirm the existing text-mode roleplay path is NOT affected — systemPrompt and firstMessage still returned in the response for the message route to use

Summary of what this achieves
Each voice session sends the real prospect personality, offer details, and first message via dynamic variables

ElevenLabs injects them into the dashboard template prompt at connection time

The no-brackets rule is in the dashboard prompt, so the LLM won't generate [trailing off] etc.

Scoring routes get 300 seconds instead of 15, preventing first-attempt timeouts

Voice connection stays stable (no overrides = no rejection)