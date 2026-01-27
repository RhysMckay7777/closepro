// Layer 2: Prospect Avatar & Difficulty Intelligence (40-Point Model)

export type AuthorityLevel = 'advisee' | 'peer' | 'advisor';
export type DifficultyTier = 'easy' | 'realistic' | 'hard' | 'elite' | 'near_impossible';

export interface ProspectDifficultyProfile {
  // 40-Point Model (4 dimensions × 10 points each)
  positionProblemAlignment: number; // 0-10
  painAmbitionIntensity: number; // 0-10
  perceivedNeedForHelp: number; // 0-10
  authorityLevel: AuthorityLevel;
  funnelContext: number; // 0-10 (Layer 3)
  
  // Calculated
  difficultyIndex: number; // 0-40 (sum of first 4 dimensions)
  difficultyTier: DifficultyTier;
}

export interface ProspectAvatar {
  // Difficulty Profile
  difficulty: ProspectDifficultyProfile;
  
  // Prospect Details
  positionDescription?: string;
  problems?: string[];
  painDrivers?: string[];
  ambitionDrivers?: string[];
  resistanceStyle?: {
    objectionPatterns?: string[];
    tone?: string;
    typicalResponses?: Record<string, string>;
  };
  behaviouralBaseline?: {
    answerDepth?: 'shallow' | 'medium' | 'deep';
    openness?: 'closed' | 'cautious' | 'open';
    responseSpeed?: 'slow' | 'normal' | 'fast';
  };
}

/**
 * Calculate difficulty index from dimensions
 */
export function calculateDifficultyIndex(
  positionProblemAlignment: number,
  painAmbitionIntensity: number,
  perceivedNeedForHelp: number,
  authorityLevel: AuthorityLevel,
  funnelContext: number
): { index: number; tier: DifficultyTier } {
  // Authority level contributes to perceivedNeedForHelp
  let authorityScore = perceivedNeedForHelp;
  if (authorityLevel === 'advisor') {
    authorityScore = Math.max(0, authorityScore - 3); // Advisors have lower perceived need
  } else if (authorityLevel === 'peer') {
    authorityScore = Math.max(0, authorityScore - 1);
  }
  // Advisee keeps full score

  // Calculate index (first 4 dimensions, funnel context is separate but influences behaviour)
  const index = Math.round(
    positionProblemAlignment +
    painAmbitionIntensity +
    authorityScore +
    funnelContext
  );

  // Determine tier
  let tier: DifficultyTier;
  if (index >= 35) {
    tier = 'easy';
  } else if (index >= 30) {
    tier = 'realistic';
  } else if (index >= 25) {
    tier = 'hard';
  } else if (index >= 20) {
    tier = 'elite';
  } else {
    tier = 'near_impossible';
  }

  return { index, tier };
}

/**
 * Map user-selected difficulty to prospect profile ranges
 */
export function mapDifficultySelectionToProfile(
  selectedDifficulty: 'easy' | 'realistic' | 'hard' | 'elite' | 'intermediate' | 'expert'
): {
  targetIndexRange: [number, number];
  targetTier: DifficultyTier;
} {
  switch (selectedDifficulty) {
    case 'easy':
      return { targetIndexRange: [35, 40], targetTier: 'easy' };
    case 'realistic':
    case 'intermediate':
      return { targetIndexRange: [30, 35], targetTier: 'realistic' };
    case 'hard':
      return { targetIndexRange: [25, 30], targetTier: 'hard' };
    case 'elite':
    case 'expert':
      return { targetIndexRange: [20, 25], targetTier: 'elite' };
    default:
      return { targetIndexRange: [30, 35], targetTier: 'realistic' };
  }
}

/**
 * Generate random number between min and max (inclusive)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a random prospect within a difficulty band
 * Ensures total difficulty score falls within selected range
 */
export function generateRandomProspectInBand(
  selectedDifficulty: 'easy' | 'realistic' | 'hard' | 'elite' | 'intermediate' | 'expert'
): {
  positionProblemAlignment: number;
  painAmbitionIntensity: number;
  perceivedNeedForHelp: number;
  authorityLevel: AuthorityLevel;
  funnelContext: number;
  difficultyIndex: number;
  difficultyTier: DifficultyTier;
} {
  const { targetIndexRange, targetTier } = mapDifficultySelectionToProfile(selectedDifficulty);
  const [minTotal, maxTotal] = targetIndexRange;

  // Generate random scores that sum to within the target range
  let positionProblemAlignment: number;
  let painAmbitionIntensity: number;
  let perceivedNeedForHelp: number;
  let authorityLevel: AuthorityLevel;
  let funnelContext: number;
  let total: number;
  let attempts = 0;
  const maxAttempts = 100;

  do {
    // Generate random scores for each dimension (1-10)
    positionProblemAlignment = randomInt(1, 10);
    painAmbitionIntensity = randomInt(1, 10);
    perceivedNeedForHelp = randomInt(1, 10);
    funnelContext = randomInt(1, 10);

    // Determine authority level based on perceivedNeedForHelp
    if (perceivedNeedForHelp >= 8) {
      authorityLevel = 'advisee';
    } else if (perceivedNeedForHelp >= 4) {
      authorityLevel = 'peer';
    } else {
      authorityLevel = 'advisor';
    }

    // Calculate total (accounting for authority adjustment)
    let authorityScore = perceivedNeedForHelp;
    if (authorityLevel === 'advisor') {
      authorityScore = Math.max(0, authorityScore - 3);
    } else if (authorityLevel === 'peer') {
      authorityScore = Math.max(0, authorityScore - 1);
    }

    total = positionProblemAlignment + painAmbitionIntensity + authorityScore + funnelContext;
    attempts++;
  } while ((total < minTotal || total > maxTotal) && attempts < maxAttempts);

  // If still not in range after max attempts, adjust to fit
  if (total < minTotal || total > maxTotal) {
    const adjustment = Math.round((minTotal + maxTotal) / 2 - total);
    const adjustmentPerDimension = Math.round(adjustment / 4);
    
    positionProblemAlignment = Math.max(1, Math.min(10, positionProblemAlignment + adjustmentPerDimension));
    painAmbitionIntensity = Math.max(1, Math.min(10, painAmbitionIntensity + adjustmentPerDimension));
    perceivedNeedForHelp = Math.max(1, Math.min(10, perceivedNeedForHelp + adjustmentPerDimension));
    funnelContext = Math.max(1, Math.min(10, funnelContext + adjustmentPerDimension));

    // Recalculate
    let authorityScore = perceivedNeedForHelp;
    if (authorityLevel === 'advisor') {
      authorityScore = Math.max(0, authorityScore - 3);
    } else if (authorityLevel === 'peer') {
      authorityScore = Math.max(0, authorityScore - 1);
    }
    total = positionProblemAlignment + painAmbitionIntensity + authorityScore + funnelContext;
  }

  const { tier } = calculateDifficultyIndex(
    positionProblemAlignment,
    painAmbitionIntensity,
    perceivedNeedForHelp,
    authorityLevel,
    funnelContext
  );

  return {
    positionProblemAlignment,
    painAmbitionIntensity,
    perceivedNeedForHelp,
    authorityLevel,
    funnelContext,
    difficultyIndex: total,
    difficultyTier: tier,
  };
}

/**
 * Generate prospect behaviour profile based on difficulty
 */
export function generateBehaviourProfile(
  difficulty: ProspectDifficultyProfile
): {
  objectionFrequency: 'low' | 'medium' | 'high';
  objectionIntensity: 'low' | 'medium' | 'high';
  answerDepth: 'shallow' | 'medium' | 'deep';
  openness: 'closed' | 'cautious' | 'open';
  willingnessToBeChallenged: 'low' | 'medium' | 'high';
  responseSpeed: 'slow' | 'normal' | 'fast';
} {
  const { difficultyTier, authorityLevel } = difficulty;

  switch (difficultyTier) {
    case 'easy':
      return {
        objectionFrequency: 'low',
        objectionIntensity: 'low',
        answerDepth: 'deep',
        openness: 'open',
        willingnessToBeChallenged: 'high',
        responseSpeed: 'fast',
      };

    case 'realistic':
      return {
        objectionFrequency: 'medium',
        objectionIntensity: 'medium',
        answerDepth: 'medium',
        openness: 'cautious',
        willingnessToBeChallenged: 'medium',
        responseSpeed: 'normal',
      };

    case 'hard':
      return {
        objectionFrequency: 'high',
        objectionIntensity: 'medium',
        answerDepth: 'shallow',
        openness: 'cautious',
        willingnessToBeChallenged: 'low',
        responseSpeed: 'slow',
      };

    case 'elite':
      return {
        objectionFrequency: 'medium',
        objectionIntensity: 'high',
        answerDepth: 'shallow',
        openness: 'closed',
        willingnessToBeChallenged: authorityLevel === 'advisor' ? 'low' : 'medium',
        responseSpeed: 'normal',
      };

    case 'near_impossible':
      return {
        objectionFrequency: 'high',
        objectionIntensity: 'high',
        answerDepth: 'shallow',
        openness: 'closed',
        willingnessToBeChallenged: 'low',
        responseSpeed: 'slow',
      };

    default:
      return {
        objectionFrequency: 'medium',
        objectionIntensity: 'medium',
        answerDepth: 'medium',
        openness: 'cautious',
        willingnessToBeChallenged: 'medium',
        responseSpeed: 'normal',
      };
  }
}
