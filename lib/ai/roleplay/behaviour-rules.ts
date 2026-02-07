// Layer 4: Difficulty → Behaviour Rules & Dynamic Adaptation

import { ProspectDifficultyProfile, DifficultyTier, AuthorityLevel } from './prospect-avatar';
import { FunnelContext, getFunnelBehaviourImpact } from './funnel-context';

export interface BehaviourState {
  // Resistance
  objectionFrequency: 'low' | 'medium' | 'high';
  objectionIntensity: 'low' | 'medium' | 'high';
  currentResistance: number; // 0-10, dynamic

  // Engagement
  answerDepth: 'shallow' | 'medium' | 'deep';
  openness: 'closed' | 'cautious' | 'open';
  engagement: number; // 0-10, dynamic

  // Interaction
  willingnessToBeChallenged: 'low' | 'medium' | 'high';
  responseSpeed: 'slow' | 'normal' | 'fast';
  talkTimeRatio: number; // 0-1, prospect talk time vs rep

  // Trust & Value
  trustLevel: number; // 0-10, dynamic
  valuePerception: number; // 0-10, dynamic
}

/**
 * Initialize behaviour state from difficulty profile
 */
export function initializeBehaviourState(
  difficulty: ProspectDifficultyProfile,
  funnelContext: FunnelContext
): BehaviourState {
  const { difficultyTier, authorityLevel, executionResistance } = difficulty;
  const funnelImpact = getFunnelBehaviourImpact(funnelContext);

  // Base state from difficulty tier
  let baseState: Partial<BehaviourState>;

  switch (difficultyTier) {
    case 'easy':
      baseState = {
        objectionFrequency: 'low',
        objectionIntensity: 'low',
        answerDepth: 'deep',
        openness: 'open',
        willingnessToBeChallenged: 'high',
        responseSpeed: 'fast',
        currentResistance: 2,
        engagement: 8,
        trustLevel: 7,
        valuePerception: 6,
      };
      break;

    case 'realistic':
      baseState = {
        objectionFrequency: 'medium',
        objectionIntensity: 'medium',
        answerDepth: 'medium',
        openness: 'cautious',
        willingnessToBeChallenged: 'medium',
        responseSpeed: 'normal',
        currentResistance: 5,
        engagement: 6,
        trustLevel: 5,
        valuePerception: 5,
      };
      break;

    case 'hard':
      baseState = {
        objectionFrequency: 'high',
        objectionIntensity: 'medium',
        answerDepth: 'shallow',
        openness: 'cautious',
        willingnessToBeChallenged: 'low',
        responseSpeed: 'slow',
        currentResistance: 7,
        engagement: 4,
        trustLevel: 3,
        valuePerception: 3,
      };
      break;

    case 'elite':
      baseState = {
        objectionFrequency: 'medium',
        objectionIntensity: 'high',
        answerDepth: 'shallow',
        openness: 'closed',
        willingnessToBeChallenged: authorityLevel === 'advisor' ? 'low' : 'medium',
        responseSpeed: 'normal',
        currentResistance: 8,
        engagement: 3,
        trustLevel: 2,
        valuePerception: 2,
      };
      break;

    case 'near_impossible':
      baseState = {
        objectionFrequency: 'high',
        objectionIntensity: 'high',
        answerDepth: 'shallow',
        openness: 'closed',
        willingnessToBeChallenged: 'low',
        responseSpeed: 'slow',
        currentResistance: 9,
        engagement: 2,
        trustLevel: 1,
        valuePerception: 1,
      };
      break;

    default:
      baseState = {
        objectionFrequency: 'medium',
        objectionIntensity: 'medium',
        answerDepth: 'medium',
        openness: 'cautious',
        willingnessToBeChallenged: 'medium',
        responseSpeed: 'normal',
        currentResistance: 5,
        engagement: 5,
        trustLevel: 5,
        valuePerception: 5,
      };
  }

  // Adjust based on funnel context (funnelImpact already defined at top of function)
  baseState.trustLevel = Math.max(0, Math.min(10, baseState.trustLevel! + funnelImpact.startingTrust - 5));
  baseState.currentResistance = Math.max(0, Math.min(10,
    baseState.currentResistance! +
    (funnelImpact.earlyResistance === 'high' ? 2 : funnelImpact.earlyResistance === 'low' ? -2 : 0)
  ));

  // Adjust based on execution resistance
  // Low execution resistance increases logistics objections and resistance
  if (executionResistance <= 4) {
    // Extreme resistance - more logistics objections, higher resistance
    baseState.objectionFrequency = baseState.objectionFrequency === 'low' ? 'medium' : 'high';
    baseState.currentResistance = Math.min(10, baseState.currentResistance! + 1);
  } else if (executionResistance <= 7) {
    // Partial ability - moderate logistics concerns
    // No major adjustment, but logistics objections more likely
  }
  // High execution resistance (8-10) - no adjustment needed

  return baseState as BehaviourState;
}

/**
 * Adapt behaviour based on rep actions
 */
export function adaptBehaviour(
  currentState: BehaviourState,
  repAction: {
    demonstratedAuthority?: boolean;
    askedDeepQuestions?: boolean;
    reframedEffectively?: boolean;
    builtValue?: boolean;
    builtTrust?: boolean;
    handledObjection?: boolean;
    appliedPressure?: boolean;
    lostControl?: boolean;
    overExplained?: boolean;
  }
): BehaviourState {
  const newState = { ...currentState };

  // Positive adaptations
  if (repAction.demonstratedAuthority) {
    newState.trustLevel = Math.min(10, newState.trustLevel + 1);
    newState.willingnessToBeChallenged =
      newState.willingnessToBeChallenged === 'low' ? 'medium' :
        newState.willingnessToBeChallenged === 'medium' ? 'high' : 'high';
  }

  if (repAction.askedDeepQuestions) {
    newState.answerDepth =
      newState.answerDepth === 'shallow' ? 'medium' :
        newState.answerDepth === 'medium' ? 'deep' : 'deep';
    newState.engagement = Math.min(10, newState.engagement + 1);
  }

  if (repAction.reframedEffectively) {
    newState.currentResistance = Math.max(0, newState.currentResistance - 1);
    newState.trustLevel = Math.min(10, newState.trustLevel + 0.5);
  }

  if (repAction.builtValue) {
    newState.valuePerception = Math.min(10, newState.valuePerception + 1);
    newState.currentResistance = Math.max(0, newState.currentResistance - 0.5);
  }

  if (repAction.builtTrust) {
    newState.trustLevel = Math.min(10, newState.trustLevel + 1);
    newState.openness =
      newState.openness === 'closed' ? 'cautious' :
        newState.openness === 'cautious' ? 'open' : 'open';
  }

  if (repAction.handledObjection) {
    newState.currentResistance = Math.max(0, newState.currentResistance - 1);
    newState.trustLevel = Math.min(10, newState.trustLevel + 0.5);
  }

  // Negative adaptations
  if (repAction.lostControl) {
    newState.currentResistance = Math.min(10, newState.currentResistance + 1);
    newState.engagement = Math.max(0, newState.engagement - 1);
    newState.openness =
      newState.openness === 'open' ? 'cautious' :
        newState.openness === 'cautious' ? 'closed' : 'closed';
  }

  if (repAction.overExplained) {
    newState.engagement = Math.max(0, newState.engagement - 0.5);
    newState.currentResistance = Math.min(10, newState.currentResistance + 0.5);
  }

  if (repAction.appliedPressure && newState.trustLevel < 5) {
    // Premature pressure backfires
    newState.currentResistance = Math.min(10, newState.currentResistance + 2);
    newState.trustLevel = Math.max(0, newState.trustLevel - 1);
  }

  return newState;
}

/**
 * Determine if prospect should raise objection based on current state
 */
export function shouldRaiseObjection(
  state: BehaviourState,
  conversationLength: number // messages so far
): boolean {
  const { objectionFrequency, currentResistance, trustLevel, valuePerception } = state;

  // Base probability from frequency
  let probability = 0.1; // 10% base
  if (objectionFrequency === 'medium') probability = 0.2;
  if (objectionFrequency === 'high') probability = 0.3;

  // Adjust based on resistance
  if (currentResistance > 7) probability += 0.2;
  if (currentResistance > 5) probability += 0.1;

  // Adjust based on trust/value gaps
  if (trustLevel < 4) probability += 0.15;
  if (valuePerception < 4) probability += 0.15;

  // Reduce if recently raised objection (cooldown)
  // This would be tracked in session state

  return Math.random() < probability;
}

/**
 * Get objection type based on state
 */
export function getObjectionType(
  state: BehaviourState,
  executionResistance?: number
): 'value' | 'trust' | 'fit' | 'logistics' {
  const { trustLevel, valuePerception, currentResistance } = state;

  // If execution resistance is low, logistics objections are more likely
  if (executionResistance !== undefined && executionResistance <= 4) {
    // Extreme resistance - logistics objections are primary concern
    if (trustLevel < 3 || valuePerception < 3) {
      // But still prioritize value/trust if extremely low
      if (valuePerception < trustLevel) return 'value';
      if (trustLevel < valuePerception) return 'trust';
    }
    return 'logistics';
  }

  // Determine which pillar is weakest
  if (valuePerception < trustLevel && valuePerception < 5) {
    return 'value';
  }
  if (trustLevel < valuePerception && trustLevel < 5) {
    return 'trust';
  }
  if (currentResistance > 7) {
    return 'fit';
  }

  // Logistics if execution resistance is medium or if other pillars are okay
  if (executionResistance !== undefined && executionResistance <= 7) {
    return 'logistics';
  }

  return 'logistics';
}

/**
 * Opening Line Context for generating realistic prospect openers
 */
export interface OpeningLineContext {
  funnelContext: FunnelContext;
  difficulty: ProspectDifficultyProfile;
  prospectName: string;
  offerType?: string;
  referrerName?: string;
}

/**
 * Opening line templates by funnel source
 * These replace unrealistic openers like "I don't know why I'm here"
 */
const OPENING_TEMPLATES = {
  // Cold outbound - skeptical but gave time
  cold_outbound: {
    easy: [
      "Hey, so you reached out about {topic}. I've got a few minutes—what's this about?",
      "Hi, I got your message. I'm curious what you've got, but I'm pretty busy today.",
      "Okay, you caught me. What exactly do you do?",
    ],
    realistic: [
      "Look, I don't usually take these calls, but you caught me at a good time. What's this about?",
      "I'm giving you five minutes. What do you have that's different from everyone else?",
      "Fine, I'm listening. But I've heard a lot of pitches—what makes yours different?",
    ],
    hard: [
      "I'm not sure why I picked up. You've got two minutes. Go.",
      "Make it quick—I've got back-to-back calls. What do you want?",
      "I don't know how you got my number, but okay, what's the pitch?",
    ],
    elite: [
      "My assistant said you were persistent. You've got sixty seconds to tell me why I shouldn't hang up.",
      "I'll be honest—I almost didn't take this. What's so important?",
      "I'm in between meetings. This better be good.",
    ],
  },

  // Warm inbound - applied/registered, some interest
  warm_inbound: {
    easy: [
      "Hi! I applied after seeing your ad. Really excited to learn more about how this works.",
      "Hey, I signed up on your website. This sounds like exactly what I need.",
      "Thanks for calling back! I've been looking for something like this for a while.",
    ],
    realistic: [
      "Hi, I applied for the {topic} thing. I'm interested, but I want to understand what I'm actually getting into.",
      "Yeah, I signed up. I've tried a few things before that didn't work, so I'm cautiously optimistic.",
      "Thanks for the call. I saw your ad and it seemed interesting, but I've got questions.",
    ],
    hard: [
      "I applied but I'm still not sure about this. I've been burned before, so convince me.",
      "Look, I signed up but I get a lot of these. What makes you different?",
      "I'm interested, but I need to know this isn't just another course that sits on my shelf.",
    ],
    elite: [
      "I applied because something caught my attention, but I'm skeptical. I've done programs before.",
      "My time is valuable. I'm here because someone I respect mentioned you. Now prove it was worth my time.",
      "I filled out the form, but I'm already questioning if this is for someone at my level.",
    ],
  },

  // Content-educated - watched videos, consumed content
  content_educated: {
    easy: [
      "I've been watching your videos for months! So excited to finally talk to someone.",
      "I feel like I already know you from the podcast. Ready to take the next step.",
      "Your content has been so helpful. I'm basically sold, just need the details.",
    ],
    realistic: [
      "I've consumed a lot of your content and it resonates. But I want to understand what the paid version includes.",
      "Been following for a while. The free stuff has been great, but I need to know if the program delivers.",
      "I like what you teach. Now I need to know if the investment makes sense for my situation.",
    ],
    hard: [
      "I've seen the content. It's good, but I've seen a lot of good content that doesn't translate to results.",
      "Look, I've watched the videos. I get the concepts. What I don't get is why I need to pay for this.",
      "The content is solid, but I need more than concepts. I need something that works for my specific case.",
    ],
    elite: [
      "I've studied your material. It's interesting, but I've been in this space longer than you. What can you teach me?",
      "I'm familiar with your work. Some good points, some I disagree with. Let's see if this makes sense.",
      "I've seen the content. I'm here because something about your approach is different. Show me what that is.",
    ],
  },

  // Referral - transferred trust
  referral: {
    easy: [
      "{referrer} told me I had to talk to you. He said you completely changed his business.",
      "I'm here because {referrer} won't stop raving about you. I trust her judgment completely.",
      "{referrer} said you're the real deal. I'm ready to get started.",
    ],
    realistic: [
      "{referrer} mentioned you might be able to help with my {problem}. He spoke highly of you.",
      "So {referrer} referred me. She said you helped her, but I want to understand if it applies to my situation.",
      "{referrer} said I should talk to you. I trust his judgment, but I still have questions.",
    ],
    hard: [
      "{referrer} referred me, but honestly, what worked for him might not work for me. Different situations.",
      "I'm here because {referrer} insisted. But I've seen referrals not pan out before, so prove it.",
      "{referrer} spoke well of you, but he's not the sharpest tool in the shed. Convince me yourself.",
    ],
    elite: [
      "{referrer} said you helped him. But he's in a different league than me. Can you handle my level?",
      "I got your name from {referrer}. I respect him, but I make my own decisions. Tell me what you've got.",
      "{referrer} mentioned you. I'm taking this call as a favor to him. Show me it was worth my time.",
    ],
  },
};

/**
 * Get a realistic opening line based on funnel context and difficulty
 * Replaces generic/unrealistic openers with context-aware dialogue
 */
export function getOpeningLine(context: OpeningLineContext): string {
  const { funnelContext, difficulty, prospectName, offerType, referrerName } = context;
  const { type } = funnelContext;
  const tier = difficulty.difficultyTier;

  // Map tier to template key
  let templateKey: 'easy' | 'realistic' | 'hard' | 'elite' = 'realistic';
  switch (tier) {
    case 'easy':
      templateKey = 'easy';
      break;
    case 'realistic':
      templateKey = 'realistic';
      break;
    case 'hard':
      templateKey = 'hard';
      break;
    case 'elite':
    case 'near_impossible':
      templateKey = 'elite';
      break;
  }

  // Get templates for this funnel type and difficulty
  const templates = OPENING_TEMPLATES[type]?.[templateKey] || OPENING_TEMPLATES.warm_inbound.realistic;

  // Pick a random template
  const template = templates[Math.floor(Math.random() * templates.length)];

  // Replace placeholders
  let opening = template
    .replace(/{topic}/g, offerType || 'this')
    .replace(/{problem}/g, 'my situation')
    .replace(/{referrer}/g, referrerName || 'someone');

  return opening;
}

/**
 * Get behaviour instructions for the AI based on difficulty tier
 * Used in system prompts to guide prospect behaviour
 */
export function getBehaviourInstructions(tier: DifficultyTier): string {
  switch (tier) {
    case 'easy':
      return `
You are a friendly, open prospect. You:
- Answer questions honestly and thoroughly
- Show genuine interest in solving your problem
- Raise mild objections but are easily convinced
- Don't interrupt or challenge aggressively
- Are eager to move forward if value is clear
`;
    case 'realistic':
      return `
You are a typical prospect with normal skepticism. You:
- Answer questions but may hold back sensitive details initially
- Show interest but need value proven before committing
- Raise reasonable objections and expect good answers
- May push back on price or timing
- Need trust built before opening up fully
`;
    case 'hard':
      return `
You are a skeptical prospect who has been burned before. You:
- Give short answers initially, require earning deeper responses
- Challenge claims and ask for proof
- Raise multiple objections, some quite pointed
- Mention past failures with similar solutions
- Need significant trust and value before considering
- May try to control the conversation
`;
    case 'elite':
      return `
You are a high-authority prospect who sees themselves as superior. You:
- Speak concisely and expect the same
- Challenge the rep's expertise and credentials
- Raise sophisticated objections
- May be dismissive or condescending
- Only respect demonstrated competence
- Have little patience for sales tactics
- Need to see unique value for someone at your level
`;
    case 'near_impossible':
      return `
You are an extremely difficult prospect. You:
- Are actively hostile or disengaged
- Give one-word answers when possible
- Constantly challenge and interrupt
- Have fundamental blockers (no budget, wrong timing, etc.)
- May try to end the call early
- Only the most exceptional sales approach has any chance
`;
    default:
      return getBehaviourInstructions('realistic');
  }
}

