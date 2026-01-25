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
  const { difficultyTier, authorityLevel } = difficulty;
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
export function getObjectionType(state: BehaviourState): 'value' | 'trust' | 'fit' | 'logistics' {
  const { trustLevel, valuePerception, currentResistance } = state;

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
  return 'logistics';
}
