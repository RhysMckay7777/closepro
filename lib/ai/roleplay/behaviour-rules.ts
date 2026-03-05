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

  // Phase Tracking (Connor's Discovery Phase v3.0)
  currentPhase: 'intro' | 'discovery' | 'pitch' | 'close' | 'objections';
  discoveryTurnCount: number;  // turns within discovery phase
  discoveryDepthLevel: 'early' | 'mid' | 'late';  // progressive opening arc
  peerUnlockLevel: number;  // 0 = locked, 1-3 = progressively unlocked

  // Close Phase Tracking (Connor's Close Phase v3.0)
  closeObjectionLayer: number;  // 1-3 = current objection layer
  closeHandlingQuality: 'good' | 'average' | 'poor' | 'manipulative';
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

    case 'expert':
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

  // Initialize phase tracking (Connor's Discovery Phase v3.0)
  baseState.currentPhase = 'intro';
  baseState.discoveryTurnCount = 0;
  baseState.discoveryDepthLevel = 'early';
  baseState.peerUnlockLevel = 0;

  // Initialize close phase state (Connor's Close Phase v3.0)
  baseState.closeObjectionLayer = 1;
  baseState.closeHandlingQuality = 'average';

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
    // Discovery Phase v3.0 — Peer Unlock triggers
    reframedForUnlock?: boolean;
    namedPattern?: boolean;
    directlyChallenged?: boolean;
    transitionedToPhase?: 'discovery' | 'pitch' | 'close' | 'objections';
    // Close Phase v3.0 — Handling quality
    handledObjectionWell?: boolean;
    handledManipulatively?: boolean;
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

  // ═══ Discovery Phase v3.0 — Peer Unlock Mechanics ═══
  // Peer unlock: good reframes/challenges increase unlock level (max 3)
  if (repAction.reframedForUnlock || repAction.namedPattern || repAction.directlyChallenged) {
    newState.peerUnlockLevel = Math.min(3, newState.peerUnlockLevel + 1);
    // Also boost openness and reduce resistance
    newState.openness = newState.openness === 'closed' ? 'cautious' :
      newState.openness === 'cautious' ? 'open' : 'open';
    newState.currentResistance = Math.max(0, newState.currentResistance - 0.5);
  }

  // Bad question after unlock can partially re-close (peer only)
  if ((repAction.lostControl || repAction.overExplained) && newState.peerUnlockLevel > 0) {
    newState.peerUnlockLevel = Math.max(0, newState.peerUnlockLevel - 1);
  }

  // Phase transitions
  if (repAction.transitionedToPhase) {
    newState.currentPhase = repAction.transitionedToPhase;
    if (repAction.transitionedToPhase === 'discovery') {
      newState.discoveryTurnCount = 0;
      newState.discoveryDepthLevel = 'early';
    }
  }

  // Discovery turn count & progressive opening arc
  if (newState.currentPhase === 'discovery') {
    newState.discoveryTurnCount += 1;
    if (newState.discoveryTurnCount <= 5) {
      newState.discoveryDepthLevel = 'early';
    } else if (newState.discoveryTurnCount <= 15) {
      newState.discoveryDepthLevel = 'mid';
    } else {
      newState.discoveryDepthLevel = 'late';
    }
  }

  // ═══ Close Phase v3.0 — Handling Quality & Objection Layer ═══
  if (newState.currentPhase === 'close') {
    // Track handling quality
    if (repAction.handledManipulatively) {
      newState.closeHandlingQuality = 'manipulative';
      // Manipulative handling → trust drops, prospect disengages
      newState.trustLevel = Math.max(0, newState.trustLevel - 2);
      newState.engagement = Math.max(0, newState.engagement - 2);
      newState.openness = 'closed';
    } else if (repAction.handledObjectionWell) {
      newState.closeHandlingQuality = 'good';
      // Good handling → progress to next objection layer
      newState.closeObjectionLayer = Math.min(3, newState.closeObjectionLayer + 1);
      newState.trustLevel = Math.min(10, newState.trustLevel + 1);
      newState.openness = newState.openness === 'closed' ? 'cautious' :
        newState.openness === 'cautious' ? 'open' : 'open';
    } else if (repAction.lostControl || repAction.overExplained) {
      newState.closeHandlingQuality = 'poor';
      // Poor handling → harden, shorter responses
      newState.currentResistance = Math.min(10, newState.currentResistance + 1);
    }
    // Average handling: no objection layer progression, stay in same loop
  }

  return newState;
}

/**
 * Determine if prospect should raise objection based on current state.
 * Hard gate: NO objections before turn 4 (8 messages = 4 exchanges) unless practiceMode is 'objections'.
 */
export function shouldRaiseObjection(
  state: BehaviourState,
  conversationLength: number, // messages so far
  practiceMode?: string
): boolean {
  // Hard gate: block objections before 4 exchanges (8 messages) unless practicing objections
  if (conversationLength < 8 && practiceMode !== 'objections') {
    return false;
  }

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
 * Brief, natural, low-information greetings (3-8 words max).
 * Difficulty/skepticism emerges LATER through responses, not in the opening.
 */
const OPENING_TEMPLATES: Record<string, Record<string, string[]>> = {
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
  },

  // CONTENT EDUCATED — watched videos, consumed content
  content_educated: {
    easy: [
      "Hey! Yeah, I've seen your stuff.",
      "Hi, yeah I've been following along.",
      "Hey, how's it going?",
    ],
    realistic: [
      "Hi, yeah I've seen some of your content.",
      "Hey. Yeah, I know who you are.",
      "Hi. Yeah, go ahead.",
    ],
    hard: [
      "Hey. Yeah.",
      "Hi.",
      "Yeah, I've seen a few things.",
    ],
    expert: [
      "Hey.",
      "Hi. Yeah.",
      "Yeah?",
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
  let templateKey: 'easy' | 'realistic' | 'hard' | 'expert' = 'realistic';
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
    case 'expert':
    case 'elite' as any:
    case 'near_impossible':
      templateKey = 'expert';
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
- Start NEUTRAL. Skepticism emerges gradually after turn 3-4, not from the opening.
- Give short answers initially, require earning deeper responses
- Challenge claims and ask for proof
- Raise multiple objections, some quite pointed
- Mention past failures with similar solutions
- Need significant trust and value before considering
- May try to control the conversation
`;
    case 'expert':
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
You are an extremely difficult prospect with severe constraints across multiple dimensions. You:
- Start NEUTRAL but quickly become guarded once the conversation moves beyond pleasantries
- Give minimal information — one-word or one-sentence answers unless deeply probed
- Have extreme skepticism from past negative experiences — you've been burned badly
- Have severe execution barriers (money, time, authority, or all three)
- Challenge everything — credentials, claims, timelines, and outcomes
- Are dismissive of generic pitches — only hyper-specific, evidence-backed claims get traction
- May have a spouse, boss, or external blocker who must approve any decision
- Need overwhelming proof of value AND a way past your execution barriers to even consider proceeding
- Even if convinced on value, logistics objections are very hard to overcome
`;
    default:
      return getBehaviourInstructions('realistic');
  }
}

