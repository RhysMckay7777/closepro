// Layer 2: Prospect Avatar & Difficulty Intelligence (50-Point Model)

// Realistic prospect names for auto-generated avatars (no "Auto-Generated X Prospect")
const FIRST_NAMES = [
  'James', 'Maria', 'David', 'Sarah', 'Michael', 'Emma', 'Chris', 'Lisa', 'Alex', 'Jennifer',
  'Ryan', 'Nicole', 'Jordan', 'Rachel', 'Taylor', 'Amanda', 'Morgan', 'Jessica', 'Casey', 'Lauren',
  'Sam', 'Katie', 'Jamie', 'Megan', 'Riley', 'Ashley', 'Quinn', 'Brooke', 'Reese', 'Hayley',
];
const LAST_NAMES = [
  'Chen', 'Williams', 'Martinez', 'Kim', 'Brown', 'Garcia', 'Johnson', 'Lee', 'Davis', 'Patel',
  'Thompson', 'Rodriguez', 'Wilson', 'Nguyen', 'Anderson', 'Taylor', 'Moore', 'Jackson', 'White', 'Harris',
];

/**
 * Returns a random realistic prospect name (e.g. "Maria Chen").
 * Pass a Set to avoid duplicates when generating multiple names in one go.
 */
export function generateRandomProspectName(usedNames?: Set<string>): string {
  let name: string;
  do {
    const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    name = `${first} ${last}`;
  } while (usedNames?.has(name) && usedNames.size < FIRST_NAMES.length * LAST_NAMES.length);
  usedNames?.add(name);
  return name;
}

export type AuthorityLevel = 'advisee' | 'peer' | 'advisor';
export type DifficultyTier = 'easy' | 'realistic' | 'hard' | 'elite' | 'near_impossible';

export interface ProspectDifficultyProfile {
  // Layer A: Persuasion Difficulty (40 points)
  positionProblemAlignment: number; // 0-10
  painAmbitionIntensity: number; // 0-10
  perceivedNeedForHelp: number; // 0-10
  authorityLevel: AuthorityLevel;
  funnelContext: number; // 0-10

  // Layer B: Execution Resistance (10 points)
  executionResistance: number; // 0-10 (ability to proceed: money, time, effort, authority)

  // Calculated
  difficultyIndex: number; // 0-50 (Layer A + Layer B)
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
 * Calculate difficulty index from dimensions (50-point model)
 * Layer A (40 points): Persuasion Difficulty
 * Layer B (10 points): Execution Resistance
 */
export function calculateDifficultyIndex(
  positionProblemAlignment: number,
  painAmbitionIntensity: number,
  perceivedNeedForHelp: number,
  authorityLevel: AuthorityLevel,
  funnelContext: number,
  executionResistance: number = 5 // Default to medium ability
): { index: number; tier: DifficultyTier } {
  // Authority level contributes to perceivedNeedForHelp
  let authorityScore = perceivedNeedForHelp;
  if (authorityLevel === 'advisor') {
    authorityScore = Math.max(0, authorityScore - 3); // Advisors have lower perceived need
  } else if (authorityLevel === 'peer') {
    authorityScore = Math.max(0, authorityScore - 1);
  }
  // Advisee keeps full score

  // Calculate Layer A: Persuasion Difficulty (40 points)
  const layerA = Math.round(
    positionProblemAlignment +
    painAmbitionIntensity +
    authorityScore +
    funnelContext
  );

  // Layer B: Execution Resistance (10 points)
  const layerB = Math.max(0, Math.min(10, Math.round(executionResistance)));

  // Total difficulty index (0-50)
  const index = layerA + layerB;

  // Determine tier based on 50-point scale (matches canonical DIFFICULTY_BANDS)
  let tier: DifficultyTier;
  if (index >= 42) {
    tier = 'easy';
  } else if (index >= 36) {
    tier = 'realistic';
  } else if (index >= 30) {
    tier = 'hard';
  } else if (index >= 25) {
    tier = 'elite';
  } else {
    tier = 'near_impossible';
  }

  return { index, tier };
}

/**
 * Map user-selected difficulty to prospect profile ranges (50-point scale)
 */
export function mapDifficultySelectionToProfile(
  selectedDifficulty: 'easy' | 'realistic' | 'hard' | 'elite' | 'intermediate' | 'expert'
): {
  targetIndexRange: [number, number];
  targetTier: DifficultyTier;
} {
  switch (selectedDifficulty) {
    case 'easy':
      return { targetIndexRange: [42, 50], targetTier: 'easy' };
    case 'realistic':
    case 'intermediate':
      return { targetIndexRange: [36, 41], targetTier: 'realistic' };
    case 'hard':
      return { targetIndexRange: [30, 35], targetTier: 'hard' };
    case 'elite':
    case 'expert':
      return { targetIndexRange: [25, 29], targetTier: 'elite' };
    default:
      return { targetIndexRange: [36, 41], targetTier: 'realistic' };
  }
}

/**
 * Calculate Execution Resistance based on offer requirements and prospect profile
 * Returns score 1-10 where higher = more able to proceed
 * 
 * @param offerPriceRange - Price range string like "5000-25000"
 * @param offerEffortRequired - 'low' | 'medium' | 'high'
 * @param prospectAuthorityLevel - Authority level affects decision-making ability
 * @param prospectPainAmbitionIntensity - Higher motivation = more likely to find resources
 * @returns Execution resistance score (1-10)
 */
export function calculateExecutionResistance(
  offerPriceRange: string,
  offerEffortRequired: 'low' | 'medium' | 'high' = 'medium',
  prospectAuthorityLevel: AuthorityLevel = 'peer',
  prospectPainAmbitionIntensity: number = 5
): number {
  let baseScore = 7; // Start with moderate ability

  // Adjust based on price range
  // Extract numeric range from string like "5000-25000"
  const priceMatch = offerPriceRange.match(/(\d+)/g);
  if (priceMatch && priceMatch.length >= 1) {
    const minPrice = parseInt(priceMatch[0]);
    const maxPrice = priceMatch.length > 1 ? parseInt(priceMatch[1]) : minPrice;
    const avgPrice = (minPrice + maxPrice) / 2;

    // Higher price = lower ability score
    if (avgPrice >= 20000) {
      baseScore -= 2; // Very high ticket
    } else if (avgPrice >= 10000) {
      baseScore -= 1; // High ticket
    } else if (avgPrice >= 5000) {
      // Medium ticket, no change
    } else {
      baseScore += 1; // Lower ticket, easier to afford
    }
  }

  // Adjust based on effort required
  switch (offerEffortRequired) {
    case 'high':
      baseScore -= 1.5; // High effort = harder to commit time
      break;
    case 'medium':
      baseScore -= 0.5;
      break;
    case 'low':
      // Low effort, no penalty
      break;
  }

  // Adjust based on authority level (decision-making ability)
  switch (prospectAuthorityLevel) {
    case 'advisor':
      baseScore += 1; // Advisors typically have more resources/authority
      break;
    case 'peer':
      // No change
      break;
    case 'advisee':
      baseScore -= 0.5; // May have less decision authority
      break;
  }

  // Adjust based on motivation (pain/ambition intensity)
  // Higher motivation = more likely to find resources
  if (prospectPainAmbitionIntensity >= 8) {
    baseScore += 1; // High motivation can overcome constraints
  } else if (prospectPainAmbitionIntensity <= 3) {
    baseScore -= 1; // Low motivation = more excuses
  }

  // Clamp to 1-10 range
  return Math.max(1, Math.min(10, Math.round(baseScore)));
}

/**
 * Generate random number between min and max (inclusive)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Character archetypes for generating realistic, person-driven bios */
const CHARACTER_ARCHETYPES = {
  easy: [
    { role: 'busy parent', context: 'trying to balance family and career, looking for solutions that save time' },
    { role: 'young professional', context: 'early in their career, eager to learn and improve their situation' },
    { role: 'small business owner', context: 'just starting out, open to new ideas and ready to invest in growth' },
    { role: 'career changer', context: 'transitioning to a new field, actively seeking guidance and support' },
    { role: 'motivated individual', context: 'has clear goals and is ready to take action to achieve them' },
  ],
  realistic: [
    { role: 'busy dad', context: 'trying to figure out his business while managing family responsibilities' },
    { role: 'working mom', context: 'juggling career advancement with raising kids, needs efficient solutions' },
    { role: 'mid-level manager', context: 'looking to level up their career but cautious about investments' },
    { role: 'entrepreneur', context: 'running a small business, weighing options and looking for proven results' },
    { role: 'professional', context: 'established in their field but exploring ways to improve their situation' },
    { role: 'secretary', context: 'trained to an MVP level, looking to advance and take on more responsibility' },
  ],
  hard: [
    { role: 'skeptical business owner', context: 'has been burned before, questions everything and needs proof' },
    { role: 'busy executive', context: 'overwhelmed with options and competing priorities, hard to get attention' },
    { role: 'price-sensitive buyer', context: 'interested but budget-conscious, needs strong ROI justification' },
    { role: 'experienced professional', context: 'set in their ways, resistant to change unless benefits are clear' },
    { role: 'time-poor decision maker', context: 'wants results but struggles to find time to commit or evaluate' },
  ],
  elite: [
    { role: 'expert consultant', context: 'deeply knowledgeable, questions methodology and wants data-driven proof' },
    { role: 'seasoned executive', context: 'has seen many pitches, high standards and requires exceptional value' },
    { role: 'sophisticated buyer', context: 'evaluates multiple alternatives, needs compelling differentiation' },
    { role: 'authority figure', context: 'makes decisions for others, requires extensive validation and trust' },
  ],
  near_impossible: [
    { role: 'hostile prospect', context: 'disengaged or negative, multiple blockers and low perceived need' },
    { role: 'wrong timing prospect', context: 'no budget, timeline far out, or decision by committee required' },
  ],
};

/**
 * Generate a character-driven bio using the prospect's name and a character archetype.
 * Creates realistic, person-focused descriptions like "Busy dad George trying to figure out his business".
 */
export function getDefaultBioForDifficulty(
  tier: DifficultyTier | 'realistic' | 'hard' | 'elite' | 'easy',
  prospectName?: string
): string {
  const key = tier as DifficultyTier;
  const archetypes = CHARACTER_ARCHETYPES[key] ?? CHARACTER_ARCHETYPES.realistic;
  const archetype = archetypes[randomInt(0, archetypes.length - 1)];

  // Extract first name from prospect name if provided
  const firstName = prospectName?.split(' ')[0] || 'They';

  // Generate character-driven bio
  return `${archetype.role.charAt(0).toUpperCase() + archetype.role.slice(1)} ${firstName} ${archetype.context}.`;
}

/**
 * Generate a random prospect within a difficulty band (50-point model)
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
  executionResistance: number;
  difficultyIndex: number;
  difficultyTier: DifficultyTier;
} {
  const { targetIndexRange, targetTier } = mapDifficultySelectionToProfile(selectedDifficulty);
  const [minTotal, maxTotal] = targetIndexRange;

  // Generate random scores that sum to within the target range (50-point scale)
  let positionProblemAlignment: number;
  let painAmbitionIntensity: number;
  let perceivedNeedForHelp: number;
  let authorityLevel: AuthorityLevel;
  let funnelContext: number;
  let executionResistance: number;
  let total: number;
  let attempts = 0;
  const maxAttempts = 100;

  do {
    // Generate random scores for each dimension (1-10)
    positionProblemAlignment = randomInt(1, 10);
    painAmbitionIntensity = randomInt(1, 10);
    perceivedNeedForHelp = randomInt(1, 10);
    funnelContext = randomInt(1, 10);
    executionResistance = randomInt(1, 10);

    // Determine authority level based on perceivedNeedForHelp
    if (perceivedNeedForHelp >= 8) {
      authorityLevel = 'advisee';
    } else if (perceivedNeedForHelp >= 4) {
      authorityLevel = 'peer';
    } else {
      authorityLevel = 'advisor';
    }

    // Calculate Layer A (accounting for authority adjustment)
    let authorityScore = perceivedNeedForHelp;
    if (authorityLevel === 'advisor') {
      authorityScore = Math.max(0, authorityScore - 3);
    } else if (authorityLevel === 'peer') {
      authorityScore = Math.max(0, authorityScore - 1);
    }

    const layerA = positionProblemAlignment + painAmbitionIntensity + authorityScore + funnelContext;
    const layerB = executionResistance;
    total = layerA + layerB;
    attempts++;
  } while ((total < minTotal || total > maxTotal) && attempts < maxAttempts);

  // If still not in range after max attempts, adjust to fit
  if (total < minTotal || total > maxTotal) {
    const targetMid = Math.round((minTotal + maxTotal) / 2);
    const currentLayerA = positionProblemAlignment + painAmbitionIntensity +
      (authorityLevel === 'advisor' ? Math.max(0, perceivedNeedForHelp - 3) :
        authorityLevel === 'peer' ? Math.max(0, perceivedNeedForHelp - 1) : perceivedNeedForHelp) +
      funnelContext;

    // Adjust execution resistance to hit target
    const neededLayerB = targetMid - currentLayerA;
    executionResistance = Math.max(1, Math.min(10, neededLayerB));

    // Recalculate total
    let authorityScore = perceivedNeedForHelp;
    if (authorityLevel === 'advisor') {
      authorityScore = Math.max(0, authorityScore - 3);
    } else if (authorityLevel === 'peer') {
      authorityScore = Math.max(0, authorityScore - 1);
    }
    const layerA = positionProblemAlignment + painAmbitionIntensity + authorityScore + funnelContext;
    total = layerA + executionResistance;
  }

  const { index, tier } = calculateDifficultyIndex(
    positionProblemAlignment,
    painAmbitionIntensity,
    perceivedNeedForHelp,
    authorityLevel,
    funnelContext,
    executionResistance
  );

  return {
    positionProblemAlignment,
    painAmbitionIntensity,
    perceivedNeedForHelp,
    authorityLevel,
    funnelContext,
    executionResistance,
    difficultyIndex: index,
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
