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
  selectedDifficulty: 'easy' | 'intermediate' | 'hard' | 'expert'
): {
  targetIndexRange: [number, number];
  targetTier: DifficultyTier;
} {
  switch (selectedDifficulty) {
    case 'easy':
      return { targetIndexRange: [35, 40], targetTier: 'easy' };
    case 'intermediate':
      return { targetIndexRange: [30, 34], targetTier: 'realistic' };
    case 'hard':
      return { targetIndexRange: [25, 29], targetTier: 'hard' };
    case 'expert':
      return { targetIndexRange: [20, 24], targetTier: 'elite' };
    default:
      return { targetIndexRange: [30, 34], targetTier: 'realistic' };
  }
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
