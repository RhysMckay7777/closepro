// Core AI Roleplay Engine
// Integrates all layers to generate realistic prospect responses

import Anthropic from '@anthropic-ai/sdk';
import Groq from 'groq-sdk';
import { OfferProfile, generateOfferSummary, getDefaultSalesStyle } from './offer-intelligence';
import { ProspectAvatar, ProspectDifficultyProfile, DifficultyTier } from './prospect-avatar';
import { FunnelContext } from './funnel-context';
import { BehaviourState, initializeBehaviourState, adaptBehaviour, shouldRaiseObjection, getObjectionType } from './behaviour-rules';

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
  const systemPrompt = buildRoleplaySystemPrompt(context);

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
        max_tokens: 500,
      });
      prospectResponse = response.choices[0]?.message?.content || '...';
    } else if (anthropic) {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
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

  // Determine if this response contains an objection
  const objectionType = detectObjectionInResponse(prospectResponse, updatedBehaviourState);

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
  const { difficultyTier, authorityLevel } = prospectAvatar.difficulty;

  return `You are playing the role of a sales prospect in a realistic roleplay scenario.

${offerSummary}

PROSPECT PROFILE:
Difficulty Tier: ${difficultyTier}
Authority Level: ${authorityLevel}
Funnel Context: ${funnelContext.type} (${funnelContext.score}/10)
${prospectAvatar.positionDescription ? `Position: ${prospectAvatar.positionDescription}` : ''}
${prospectAvatar.problems?.length ? `Problems: ${prospectAvatar.problems.join(', ')}` : ''}
${prospectAvatar.painDrivers?.length ? `Pain Drivers: ${prospectAvatar.painDrivers.join(', ')}` : ''}
${prospectAvatar.ambitionDrivers?.length ? `Ambition Drivers: ${prospectAvatar.ambitionDrivers.join(', ')}` : ''}

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
   - Logistics are a concern
5. Your tone should match the offer category: ${salesStyle.tone}
6. Be realistic - not scripted. Show hesitation, ask follow-ups, push back when appropriate.
7. Never automatically accept a flawed pitch.
8. Your responses should be conversational, natural, and human-like.

Respond as this prospect would, given your current state and the rep's message.`;
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
  behaviourState: BehaviourState
): 'value' | 'trust' | 'fit' | 'logistics' | undefined {
  const lowerResponse = response.toLowerCase();

  // Value objections
  if (
    lowerResponse.includes('expensive') ||
    lowerResponse.includes('cost') ||
    lowerResponse.includes('worth it') ||
    lowerResponse.includes('value')
  ) {
    return 'value';
  }

  // Trust objections
  if (
    lowerResponse.includes('trust') ||
    lowerResponse.includes('skeptical') ||
    lowerResponse.includes('sounds too good') ||
    lowerResponse.includes('been burned')
  ) {
    return 'trust';
  }

  // Fit objections
  if (
    lowerResponse.includes('not for me') ||
    lowerResponse.includes('not sure if') ||
    lowerResponse.includes('different situation')
  ) {
    return 'fit';
  }

  // Logistics objections
  if (
    lowerResponse.includes('time') ||
    lowerResponse.includes('busy') ||
    lowerResponse.includes('think about it') ||
    lowerResponse.includes('need to discuss')
  ) {
    return 'logistics';
  }

  // Use behaviour state if unclear
  if (behaviourState.currentResistance > 6) {
    return getObjectionType(behaviourState);
  }

  return undefined;
}
