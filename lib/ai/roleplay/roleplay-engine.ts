// Core AI Roleplay Engine
// Integrates all layers to generate realistic prospect responses

import Anthropic from '@anthropic-ai/sdk';
import Groq from 'groq-sdk';
import { OfferProfile, generateOfferSummary, getDefaultSalesStyle } from './offer-intelligence';
import { ProspectAvatar, ProspectDifficultyProfile, DifficultyTier } from './prospect-avatar';
import { FunnelContext } from './funnel-context';
import { BehaviourState, initializeBehaviourState, adaptBehaviour, shouldRaiseObjection, getObjectionType, getOpeningLine, getBehaviourInstructions, OpeningLineContext } from './behaviour-rules';
import { ROLEPLAY_BEHAVIORAL_RULES, PROSPECT_DIFFICULTY_MODEL, PROSPECT_BACKSTORY_INSTRUCTIONS } from '@/lib/training';
import { getCondensedExamples } from '@/lib/ai/knowledge/real-call-examples';
import { getTranscriptPatternsForUser } from './transcript-patterns';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const USE_GROQ = process.env.USE_GROQ !== 'false'; // Default to Groq

const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;
const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

export interface RoleplayMessage {
  role: 'rep' | 'prospect' | 'system';
  content: string;
  timestamp: number;
  metadata?: {
    objectionType?: 'value' | 'trust' | 'fit' | 'logistics';
    sentiment?: 'positive' | 'neutral' | 'negative';
    interruption?: boolean;
  };
}

export interface RoleplayContext {
  offer: OfferProfile;
  prospectAvatar: ProspectAvatar;
  funnelContext: FunnelContext;
  conversationHistory: RoleplayMessage[];
  behaviourState: BehaviourState;
  replayPhase?: string;
  replayContext?: string;
  userId?: string; // For loading user-specific training transcript patterns
}

/**
 * Generate prospect response using AI
 */
export async function generateProspectResponse(
  context: RoleplayContext,
  repMessage: string
): Promise<{
  response: string;
  updatedBehaviourState: BehaviourState;
  metadata?: RoleplayMessage['metadata'];
}> {
  // Analyze rep action to adapt behaviour
  const repAction = analyzeRepAction(repMessage, context.conversationHistory);
  const updatedBehaviourState = adaptBehaviour(context.behaviourState, repAction);

  // Build system prompt with all layers
  let systemPrompt = buildRoleplaySystemPrompt(context);

  // Inject user-specific training transcript patterns (if available)
  if (context.userId) {
    try {
      const transcriptPatterns = await getTranscriptPatternsForUser(context.userId);
      if (transcriptPatterns) {
        systemPrompt += '\n\n' + transcriptPatterns;
      }
    } catch (err) {
      // Non-fatal — continue without patterns
      console.error('[roleplay-engine] Failed to load transcript patterns:', err);
    }
  }

  // Build conversation context
  const conversationMessages = buildConversationMessages(
    context.conversationHistory,
    repMessage
  );

  // Generate response
  let prospectResponse: string;
  try {
    if (USE_GROQ && groq) {
      const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          ...conversationMessages,
        ],
        temperature: 0.7, // More creative for realistic conversation
        max_tokens: 200,
      });
      prospectResponse = response.choices[0]?.message?.content || '...';
    } else if (anthropic) {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        temperature: 0.7,
        system: systemPrompt,
        messages: conversationMessages.map(msg => ({
          role: msg.role === 'system' ? 'user' : msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
      });
      prospectResponse = response.content[0].type === 'text'
        ? response.content[0].text
        : '...';
    } else {
      throw new Error('No AI service configured');
    }
  } catch (error: any) {
    console.error('Error generating prospect response:', error);
    prospectResponse = 'I need to think about that...';
  }

  // Clean LLM narration artifacts from the response
  prospectResponse = cleanResponse(prospectResponse);

  // Determine if this response contains an objection
  const objectionType = detectObjectionInResponse(
    prospectResponse,
    updatedBehaviourState,
    context.prospectAvatar.difficulty.executionResistance
  );

  return {
    response: prospectResponse,
    updatedBehaviourState,
    metadata: objectionType ? { objectionType } : undefined,
  };
}

/**
 * Build comprehensive system prompt
 */
function buildRoleplaySystemPrompt(context: RoleplayContext): string {
  const { offer, prospectAvatar, funnelContext, behaviourState } = context;
  const offerSummary = generateOfferSummary(offer);
  const salesStyle = getDefaultSalesStyle(offer);
  const { difficultyTier, authorityLevel, executionResistance } = prospectAvatar.difficulty;

  // Execution resistance interpretation
  const executionAbility = executionResistance >= 8
    ? 'Fully Able - Has money, time, and decision authority. Can proceed if convinced.'
    : executionResistance >= 5
      ? 'Partial Ability - Has some resources but may need payment plans, time restructuring, or prioritization reframing.'
      : 'Extreme Resistance - Severe money/time constraints or external dependencies. Very difficult to close on-call.';

  return `You are playing the role of a sales prospect in a realistic roleplay scenario.

${offerSummary}

PROSPECT PROFILE:
Difficulty Tier: ${difficultyTier} (Total: ${prospectAvatar.difficulty.difficultyIndex}/50)
Authority Level: ${authorityLevel}
Funnel Context: ${funnelContext.type} (${funnelContext.score}/10)
Execution Resistance: ${executionResistance}/10 - ${executionAbility}
${prospectAvatar.positionDescription ? `Position: ${prospectAvatar.positionDescription}` : ''}
${prospectAvatar.problems?.length ? `Problems: ${prospectAvatar.problems.join(', ')}` : ''}
${prospectAvatar.painDrivers?.length ? `Pain Drivers: ${prospectAvatar.painDrivers.join(', ')}` : ''}
${prospectAvatar.ambitionDrivers?.length ? `Ambition Drivers: ${prospectAvatar.ambitionDrivers.join(', ')}` : ''}

${PROSPECT_BACKSTORY_INSTRUCTIONS}

CURRENT BEHAVIOUR STATE:
Resistance Level: ${behaviourState.currentResistance}/10
Trust Level: ${behaviourState.trustLevel}/10
Value Perception: ${behaviourState.valuePerception}/10
Openness: ${behaviourState.openness}
Answer Depth: ${behaviourState.answerDepth}
Objection Frequency: ${behaviourState.objectionFrequency}
Objection Intensity: ${behaviourState.objectionIntensity}

CRITICAL RULES:
1. You are a REAL prospect, not a coach. Never give advice or hints to the rep.
2. Your responses must match your difficulty tier and authority level.
3. Adapt your behaviour based on how the rep performs:
   - If they demonstrate authority → become more open
   - If they ask deep questions → give deeper answers
   - If they build value/trust → reduce resistance
   - If they lose control or over-explain → increase resistance
4. Raise objections naturally when:
   - Value hasn't been established
   - Trust is low
   - Fit is unclear
   - Logistics are a concern (especially if execution resistance is low)
5. Execution Resistance (${executionResistance}/10): This affects your ability to proceed:
   - If execution resistance is LOW (1-4): You have severe constraints (money, time, authority). Raise logistics objections frequently. You cannot easily proceed even if convinced.
   - If execution resistance is MEDIUM (5-7): You have partial ability. May need payment plans, time restructuring, or to discuss with others.
   - If execution resistance is HIGH (8-10): You have resources and authority. Logistics objections should be minimal unless value/trust aren't established.
6. Your tone should match the offer category: ${salesStyle.tone}
7. Be realistic - not scripted. Show hesitation, ask follow-ups, push back when appropriate.
8. Never automatically accept a flawed pitch.
9. Your responses should be conversational, natural, and human-like.

RESPONSE RULES:
- Keep responses to 1-2 sentences for simple answers and acknowledgments
- Use 3-4 sentences MAXIMUM for emotional moments or complex objections
- NEVER exceed 4 sentences in a single response
- Include natural filler words occasionally: "um", "like", "I mean", "you know", "honestly"
- Use broken/interrupted sentences sometimes: "I just... I don't know if—", "Well the thing is—"
- Do NOT use perfect grammar. Real people trail off, restart sentences, and ramble slightly

CRITICAL FORMATTING RULE:
- NEVER include stage directions, emotional cues, or action descriptions in your responses
- Do NOT use parenthetical annotations like (sighing), (hesitant), (pausing), (skeptical), (laughing), (warmly), (nervously), etc.
- Do NOT use asterisk actions like *sighs*, *pauses*, *leans forward*, *nervous laugh*
- Express all emotions through your WORDS and TONE only
- BAD: "(hesitant) I don't know about this..."
- GOOD: "I don't know about this... honestly I'm not sure."
- BAD: "(skeptical) Can you prove that?"
- GOOD: "I mean... can you actually prove that though?"
- Your responses must contain ONLY spoken dialogue — exactly what a real person would say out loud

OBJECTION TIMING:
- Do NOT raise price/investment objections until the closer has actually mentioned price or investment
- Surface your FIRST real objection only AFTER the closer pitches or mentions cost
- Before that, express curiosity, skepticism, or mild pushback — but save the hard objections for after the pitch
- Layer objections naturally — don't dump all concerns at once

CHARACTER INTEGRITY:
- You are the prospect. You are NOT an AI assistant
- NEVER break character under any circumstances
- NEVER offer advice, coaching, or feedback during the conversation
- NEVER say things like "that's a great question" or "I appreciate you sharing that" — real prospects don't talk like that
- If the closer asks "are you an AI?" — stay in character and respond confused/annoyed
- Respond based on YOUR prospect's life situation, problems, and emotional state — not generic sales scenarios

${getBehaviourInstructions(difficultyTier)}

CRITICAL BEHAVIORAL RULES FOR PROSPECT:

1. OPENING: Start with a brief, natural greeting. "Hey", "Hi there", "Alright, how's it going?"
   - Do NOT reveal skepticism immediately
   - Do NOT state curiosity about the call
   - Do NOT ask questions about the offer upfront
   - Simply respond to the closer's greeting briefly

2. INFORMATION SHARING:
   - Give SHORT answers (1-2 sentences max) unless asked a deep follow-up
   - Do NOT volunteer pain points without being asked
   - Do NOT explain your full situation unprompted
   - Answer what is asked — nothing more
   - The closer must EARN deeper responses through good discovery

3. EMOTIONAL PACING:
   - Start NEUTRAL (not skeptical, not enthusiastic)
   - Only open up emotionally if the closer asks layered questions
   - Show resistance through brevity and deflection, NOT through stated skepticism
   - Guard your real feelings — reveal them gradually
   - Match the energy: if closer is calm and professional, be more open
   - If closer is pushy or salesy, become MORE guarded

4. REALISTIC PATTERNS:
   - Sometimes answer with "Yeah" or "Mm" or "I guess so" — real people are vague
   - Occasionally ask "What do you mean?" if the closer uses jargon
   - Don't perfectly articulate your problems — real people struggle to explain their situation
   - Use filler words occasionally: "um", "like", "sort of", "I dunno"
   - Sometimes go quiet after a question — let the closer handle silence

5. OBJECTION TIMING:
   - Do NOT front-load objections
   - Objections should emerge naturally during pitch or close phase
   - Early call = cooperative but brief
   - Mid call = more engaged but still guarded
   - Close phase = objections surface based on unresolved concerns

6. WHAT NEVER TO DO:
   - Never say "I'm skeptical" or "I'm curious" outright
   - Never monologue for more than 3 sentences
   - Never ask "So what exactly do you do?" early (that's the closer's job to frame)
   - Never be overly polite or agreeable — real prospects are neutral

CONNOR'S FRAMEWORK — DIFFICULTY MODEL:
${PROSPECT_DIFFICULTY_MODEL}

CONNOR'S FRAMEWORK — BEHAVIORAL RULES:
${ROLEPLAY_BEHAVIORAL_RULES}

REAL PROSPECT CONVERSATION PATTERNS:
Study these real sales call excerpts. Match the tone, vocabulary, and response patterns of these real prospects — not generic AI language.

${getCondensedExamples(3)}

Use these as reference for HOW prospects actually talk — their word choice, sentence length, emotional expression, and objection style.

Respond as this prospect would, given your current state, execution resistance level, and the rep's message.${buildPhaseReplayPrompt(context.replayPhase, context.replayContext)}${buildOriginalProspectPrompt(context.replayContext)}`;
}

/**
 * Build phase-specific prompt addition for replay sessions
 */
function buildPhaseReplayPrompt(phase?: string, contextJson?: string): string {
  if (!phase) return '';

  let ctx: any = {};
  if (contextJson) {
    try {
      ctx = JSON.parse(contextJson);
    } catch {
      // ignore parse errors
    }
  }

  const feedbackSummary = ctx.originalFeedback?.summary || 'No previous feedback available.';
  const whatLimitedImpact = ctx.originalFeedback?.whatLimitedImpact || 'Not specified.';

  switch (phase) {
    case 'intro':
      return `

PHASE PRACTICE MODE: This session focuses on the INTRODUCTION phase.
Start as a prospect being contacted. Be slightly guarded initially.
The closer needs to practice: establishing authority, frame control, tone.
Their previous attempt feedback: ${feedbackSummary}
What limited their impact: ${whatLimitedImpact}
After 2-3 minutes of intro practice, naturally signal you're ready to move on.
Do NOT extend into deep discovery or pitch — keep it focused on intro skills.`;

    case 'discovery':
      return `

PHASE PRACTICE MODE: This session focuses on the DISCOVERY phase.
Start as if intro is done — you have surface interest but haven't shared deep pain.
The closer needs to practice: depth of questioning, emotional leverage, gap creation.
Their previous attempt feedback: ${feedbackSummary}
What limited their impact: ${whatLimitedImpact}
Allow 5-7 minutes. Reward good questions with deeper answers. Stay surface-level if questions are shallow. Do NOT jump to pitch.`;

    case 'pitch':
      return `

PHASE PRACTICE MODE: This session focuses on the PITCH phase.
Start as a prospect who has shared problems and is ready to hear a solution.
Briefly summarize your situation when asked, then let them pitch.
The closer needs to practice: structure, personalization, outcome framing.
Their previous attempt feedback: ${feedbackSummary}
What limited their impact: ${whatLimitedImpact}
Allow 3-5 minutes. React authentically to the pitch.`;

    case 'close':
      return `

PHASE PRACTICE MODE: This session focuses on the CLOSE phase.
Start as a prospect who has heard the pitch and sees value but hasn't committed.
You're interested but have natural hesitation about making a decision.
The closer needs to practice: assumptive close, leadership, handling silence.
Their previous attempt feedback: ${feedbackSummary}
What limited their impact: ${whatLimitedImpact}
Allow 3-5 minutes. Commit if they handle the close well.`;

    case 'objection': {
      const objection = ctx.originalObjection;
      const quote = objection?.quote || 'I need to think about it.';
      const objType = objection?.type || 'general';
      const whySurfaced = objection?.whySurfaced || 'Not specified.';
      const howHandled = objection?.howHandled || 'Not specified.';

      return `

PHASE PRACTICE MODE: This session focuses on handling a specific objection.
After 1-2 exchanges of rapport, raise this objection: "${quote}"
Objection type: ${objType}.
Why this surfaces: ${whySurfaced}
How they previously handled it: ${howHandled}
Be realistic — maintain the objection if they fumble, yield if they handle it well.
After the objection is resolved (or failed), you may raise it once more with a different angle to test consistency.`;
    }

    case 'skill': {
      const skill = ctx.skill || 'General sales skills';
      const actionPoint = ctx.originalActionPoint;
      const whyItsCostingYou = actionPoint?.whyItsCostingYou || 'Not specified.';
      const whatToDoInstead = actionPoint?.whatToDoInstead || 'Not specified.';
      const microDrill = actionPoint?.microDrill || 'Not specified.';

      return `

PHASE PRACTICE MODE: This session focuses on a specific skill.
The closer needs to work on: ${skill}
Why it matters: ${whyItsCostingYou}
What they should practice: ${whatToDoInstead}
Training drill: ${microDrill}
Create natural conversation moments that specifically test this skill.
The call should proceed normally but you should create 2-3 opportunities where this skill is needed.`;
    }

    default:
      return '';
  }
}

/**
 * Build prospect-mimicry prompt from original call transcript data.
 * When a roleplay is replaying a real call, this injects the original prospect's
 * speaking style, objections, and pain points so the AI mimics them.
 */
function buildOriginalProspectPrompt(contextJson?: string): string {
  if (!contextJson) return '';

  let ctx: any = {};
  try {
    ctx = JSON.parse(contextJson);
  } catch {
    return '';
  }

  const profile = ctx.originalProspectProfile;
  if (!profile) return '';

  const sections: string[] = [
    '\n\nORIGINAL PROSPECT REPLAY — BEHAVIOR INSTRUCTIONS:',
    'You are replaying a real prospect from an analyzed sales call. Mimic their actual behavior.',
    '',
    `PROSPECT PROFILE:`,
    `- Name: ${profile.name || 'Unknown'}`,
    `- Communication style: ${profile.communicationStyle === 'verbose' ? 'Longer, detailed responses — this prospect talks a lot' : profile.communicationStyle === 'brief' ? 'Short, terse responses — this prospect gives minimal info' : 'Normal conversational length'}`,
    `- Opening warmth: ${profile.warmthLevel === 'warm' ? 'Starts warm and open — they came in interested' : profile.warmthLevel === 'cold' ? 'Starts cold and guarded — they are skeptical from the start' : 'Starts neutral — neither eager nor dismissive'}`,
  ];

  if (profile.objections?.length > 0) {
    sections.push('', 'KEY OBJECTIONS THEY RAISED IN THE ORIGINAL CALL:');
    for (const obj of profile.objections) {
      sections.push(`- "${obj}"`);
    }
    sections.push('Raise these SAME objections during the conversation. Use similar wording.');
  }

  if (profile.painPoints?.length > 0) {
    sections.push('', 'PAIN POINTS THEY MENTIONED:');
    for (const pain of profile.painPoints) {
      sections.push(`- ${pain}`);
    }
    sections.push('Reference these pain points when asked about your situation.');
  }

  if (profile.sampleDialogue) {
    sections.push('', 'SAMPLE OF HOW THIS PROSPECT ACTUALLY TALKS:');
    sections.push(profile.sampleDialogue);
    sections.push('Match this tone, vocabulary, and sentence length. Do NOT sound more polished than this.');
  }

  sections.push(
    '',
    'REPLAY BEHAVIOR RULES:',
    '- Mimic the original prospect\'s speaking patterns and concerns',
    '- Raise the SAME objections they raised in the original call',
    '- Use similar language and tone — do not upgrade their vocabulary',
    '- Start warm/cold based on how they started the real call',
    '- Don\'t make it easy — present the same challenges the closer faced',
    '- If the closer handles an objection better than the original call, respond realistically to the improved technique',
    '- If the closer makes the same mistakes, react the same way the original prospect did',
  );

  return sections.join('\n');
}

/**
 * Build conversation messages for AI
 */
function buildConversationMessages(
  history: RoleplayMessage[],
  newRepMessage: string
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

  // Add recent history (last 10 messages for context)
  const recentHistory = history.slice(-10);
  for (const msg of recentHistory) {
    if (msg.role === 'rep') {
      messages.push({ role: 'user', content: `[REP]: ${msg.content}` });
    } else if (msg.role === 'prospect') {
      messages.push({ role: 'assistant', content: msg.content });
    }
  }

  // Add new rep message
  messages.push({ role: 'user', content: `[REP]: ${newRepMessage}` });

  return messages;
}

/**
 * Analyze rep action to determine behaviour adaptation
 */
function analyzeRepAction(
  repMessage: string,
  history: RoleplayMessage[]
): {
  demonstratedAuthority?: boolean;
  askedDeepQuestions?: boolean;
  reframedEffectively?: boolean;
  builtValue?: boolean;
  builtTrust?: boolean;
  handledObjection?: boolean;
  appliedPressure?: boolean;
  lostControl?: boolean;
  overExplained?: boolean;
} {
  const lowerMessage = repMessage.toLowerCase();
  const action: ReturnType<typeof analyzeRepAction> = {};

  // Check for authority demonstration
  if (
    lowerMessage.includes('i\'ve') ||
    lowerMessage.includes('i have') ||
    lowerMessage.includes('we\'ve') ||
    lowerMessage.includes('experience') ||
    lowerMessage.includes('helped')
  ) {
    action.demonstratedAuthority = true;
  }

  // Check for deep questions
  const questionWords = ['why', 'what', 'how', 'tell me', 'describe', 'explain'];
  const hasQuestion = questionWords.some(word => lowerMessage.includes(word));
  const questionDepth = (repMessage.match(/\?/g) || []).length;
  if (hasQuestion && questionDepth > 0) {
    action.askedDeepQuestions = true;
  }

  // Check for reframing
  if (
    lowerMessage.includes('what if') ||
    lowerMessage.includes('imagine') ||
    lowerMessage.includes('consider') ||
    lowerMessage.includes('perspective')
  ) {
    action.reframedEffectively = true;
  }

  // Check for value building
  if (
    lowerMessage.includes('result') ||
    lowerMessage.includes('outcome') ||
    lowerMessage.includes('transform') ||
    lowerMessage.includes('achieve')
  ) {
    action.builtValue = true;
  }

  // Check for trust building
  if (
    lowerMessage.includes('testimonial') ||
    lowerMessage.includes('case study') ||
    lowerMessage.includes('client') ||
    lowerMessage.includes('guarantee')
  ) {
    action.builtTrust = true;
  }

  // Check for objection handling
  const recentProspectMessages = history
    .filter(m => m.role === 'prospect')
    .slice(-3)
    .map(m => m.content.toLowerCase())
    .join(' ');

  if (
    recentProspectMessages.includes('but') ||
    recentProspectMessages.includes('however') ||
    recentProspectMessages.includes('concern') ||
    recentProspectMessages.includes('worried')
  ) {
    // Rep is responding to objection
    action.handledObjection = true;
  }

  // Check for pressure
  if (
    lowerMessage.includes('today') ||
    lowerMessage.includes('now') ||
    lowerMessage.includes('limited') ||
    lowerMessage.includes('only')
  ) {
    action.appliedPressure = true;
  }

  // Check for loss of control (long rambling)
  if (repMessage.length > 300) {
    action.overExplained = true;
  }

  // Check for lost control (defensive, apologetic)
  if (
    lowerMessage.includes('sorry') ||
    lowerMessage.includes('i understand') ||
    lowerMessage.includes('i know it\'s')
  ) {
    action.lostControl = true;
  }

  return action;
}

/**
 * Detect objection in prospect response
 */
function detectObjectionInResponse(
  response: string,
  behaviourState: BehaviourState,
  executionResistance: number
): 'value' | 'trust' | 'fit' | 'logistics' | undefined {
  const lowerResponse = response.toLowerCase();

  // Value objections
  if (
    lowerResponse.includes('expensive') ||
    lowerResponse.includes('cost') ||
    lowerResponse.includes('worth it') ||
    lowerResponse.includes('value') ||
    lowerResponse.includes('price')
  ) {
    return 'value';
  }

  // Trust objections
  if (
    lowerResponse.includes('trust') ||
    lowerResponse.includes('skeptical') ||
    lowerResponse.includes('sounds too good') ||
    lowerResponse.includes('been burned') ||
    lowerResponse.includes('scam')
  ) {
    return 'trust';
  }

  // Fit objections
  if (
    lowerResponse.includes('not for me') ||
    lowerResponse.includes('not sure if') ||
    lowerResponse.includes('different situation') ||
    lowerResponse.includes('doesn\'t apply')
  ) {
    return 'fit';
  }

  // Logistics objections (more likely with low execution resistance)
  if (
    lowerResponse.includes('time') ||
    lowerResponse.includes('busy') ||
    lowerResponse.includes('think about it') ||
    lowerResponse.includes('need to discuss') ||
    lowerResponse.includes('can\'t afford') ||
    lowerResponse.includes('budget') ||
    lowerResponse.includes('need to check') ||
    lowerResponse.includes('spouse') ||
    lowerResponse.includes('boss') ||
    lowerResponse.includes('wait')
  ) {
    return 'logistics';
  }

  // Use behaviour state if unclear
  if (behaviourState.currentResistance > 6) {
    return getObjectionType(behaviourState, executionResistance);
  }

  return undefined;
}

/**
 * Clean LLM narration artifacts from prospect responses.
 * Strips [bracketed narration], *italicized actions*, (parenthetical stage directions),
 * and em-dash narration while preserving prices like [£2,000/month].
 */
function cleanResponse(text: string): string {
  return text
    // Remove [bracketed narration] but NOT brackets containing prices like [£2,000/month]
    .replace(/\[(?![\d£$€¥])[^\]]*\]/g, '')
    // Remove *italicized narration*
    .replace(/\*[^*]+\*/g, '')
    // Remove ALL (parenthetical stage directions) — catches (sighing), (still skeptical), (warmly), etc.
    .replace(/\([^)]*\)/g, '')
    // Remove em-dash narration like —she pauses—
    .replace(/—[a-z][^—]*—/gi, '')
    // Collapse excess whitespace
    .replace(/\n{3,}/g, '\n\n')
    .replace(/  +/g, ' ')
    .trim();
}

/**
 * Generate the initial prospect message to start a roleplay
 * Uses funnel-aware, difficulty-appropriate opening lines
 */
export function generateInitialProspectMessage(
  prospectAvatar: ProspectAvatar,
  funnelContext: FunnelContext,
  offerType?: string,
  referrerName?: string
): RoleplayMessage {
  const openingLineContext: OpeningLineContext = {
    funnelContext,
    difficulty: prospectAvatar.difficulty,
    prospectName: prospectAvatar.positionDescription || 'Prospect',
    offerType,
    referrerName,
  };

  const openingLine = getOpeningLine(openingLineContext);

  return {
    role: 'prospect',
    content: openingLine,
    timestamp: Date.now(),
    metadata: {
      sentiment: funnelContext.type === 'referral' || funnelContext.type === 'content_educated'
        ? 'positive'
        : funnelContext.type === 'cold_outbound'
          ? 'negative'
          : 'neutral',
    },
  };
}

/**
 * Stages of a complete sales conversation
 * Used for detecting incomplete roleplays
 */
export interface ConversationStages {
  opening: boolean;
  discovery: boolean;
  offer: boolean;
  objections: boolean;
  close: boolean;
}

/**
 * Detect which conversation stages have been completed
 * Based on message content and flow
 */
export function detectConversationStages(messages: RoleplayMessage[]): ConversationStages {
  const stages: ConversationStages = {
    opening: false,
    discovery: false,
    offer: false,
    objections: false,
    close: false,
  };

  if (messages.length === 0) return stages;

  // Opening: First exchange happened
  stages.opening = messages.length >= 2;

  const allContent = messages.map(m => m.content.toLowerCase()).join(' ');
  const repContent = messages.filter(m => m.role === 'rep').map(m => m.content.toLowerCase()).join(' ');
  const prospectContent = messages.filter(m => m.role === 'prospect').map(m => m.content.toLowerCase()).join(' ');

  // Discovery: Questions about situation, problems, goals
  const discoveryPatterns = [
    'what brings you', 'tell me about', 'what\'s going on', 'what are you struggling',
    'what would you like', 'what\'s your goal', 'what are you hoping', 'what\'s been happening',
    'how long have you', 'what have you tried', 'what would change', 'what would it mean',
  ];
  stages.discovery = discoveryPatterns.some(p => repContent.includes(p));

  // Offer: Mentioned the solution, program, price
  const offerPatterns = [
    'program', 'solution', 'what we do', 'how it works', 'investment', 'price',
    'cost', 'guarantee', 'included', 'what you get', 'package', 'coaching',
  ];
  stages.offer = offerPatterns.some(p => repContent.includes(p));

  // Objections: Prospect raised concerns
  const objectionPatterns = [
    'can\'t afford', 'need to think', 'not sure', 'too expensive', 'don\'t have time',
    'need to talk to', 'what if', 'how do i know', 'what makes you different',
    'i\'ve tried', 'doesn\'t work', 'skeptical', 'concerned',
  ];
  stages.objections = objectionPatterns.some(p => prospectContent.includes(p));

  // Close: Attempt to move forward
  const closePatterns = [
    'ready to get started', 'move forward', 'next step', 'sign up', 'let\'s do it',
    'i\'m in', 'where do i sign', 'how do we start', 'payment', 'card',
    'not ready', 'need more time', 'follow up', 'think about it',
  ];
  stages.close = closePatterns.some(p => allContent.includes(p));

  return stages;
}

/**
 * Determine if a roleplay is incomplete based on stages
 */
export function isRoleplayIncomplete(stages: ConversationStages): boolean {
  // A complete roleplay should have at least opening, discovery, and offer
  // Objections and close are ideal but not strictly required
  return !stages.opening || !stages.discovery || !stages.offer;
}

