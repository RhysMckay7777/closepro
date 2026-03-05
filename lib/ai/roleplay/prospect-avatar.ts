// Layer 2: Prospect Avatar & Difficulty Intelligence (50-Point Model)

import {
  CharacterSheet, CharacterSheetIdentity, CharacterSheetScores,
  CharacterSheetAuthority, CharacterSheetBackstory, CharacterSheetOfferContext,
  generateSpeechPatterns, generateObjectionSet, generateFinancialReality,
} from '@/lib/training/character-sheet-wrapper';

// Realistic prospect names for auto-generated avatars (no "Auto-Generated X Prospect")
const FIRST_NAMES = [
  'James', 'Maria', 'David', 'Sarah', 'Michael', 'Emma', 'Chris', 'Lisa', 'Alex', 'Jennifer',
  'Ryan', 'Nicole', 'Jordan', 'Rachel', 'Taylor', 'Amanda', 'Morgan', 'Jessica', 'Casey', 'Lauren',
  'Sam', 'Katie', 'Jamie', 'Megan', 'Riley', 'Ashley', 'Quinn', 'Brooke', 'Reese', 'Hayley',
];

const MALE_FIRST_NAMES = [
  'James', 'David', 'Michael', 'Robert', 'Daniel',
  'Thomas', 'William', 'Richard', 'Joseph', 'Marcus',
  'Alex', 'Jordan', 'Sam', 'Chris', 'Ryan',
  'Nathan', 'Ben', 'Luke', 'Adam', 'Jack',
];

const FEMALE_FIRST_NAMES = [
  'Maria', 'Sarah', 'Emma', 'Rachel', 'Sophie',
  'Jessica', 'Laura', 'Hannah', 'Charlotte', 'Olivia',
  'Alex', 'Jordan', 'Sam', 'Chris', 'Morgan',
  'Taylor', 'Nicole', 'Katie', 'Amy', 'Lisa',
];

const LAST_NAMES = [
  'Chen', 'Williams', 'Martinez', 'Kim', 'Brown', 'Garcia', 'Johnson', 'Lee', 'Davis', 'Patel',
  'Thompson', 'Rodriguez', 'Wilson', 'Nguyen', 'Anderson', 'Taylor', 'Moore', 'Jackson', 'White', 'Harris',
];

export type ProspectGender = 'male' | 'female' | 'any';

/**
 * Infer prospect gender from the offer's whoItsFor field.
 * Returns 'male', 'female', or 'any' (default).
 */
export function inferGenderFromOffer(whoItsFor?: string | null): ProspectGender {
  if (!whoItsFor) return 'any';
  const lower = whoItsFor.toLowerCase();

  const maleSignals = ['men', 'male', 'fathers', 'dads', 'boys',
    'husbands', 'gentlemen', 'bros', "men's", 'him', 'his'];
  if (maleSignals.some(s => lower.includes(s))) return 'male';

  const femaleSignals = ['women', 'female', 'mothers', 'mums', 'moms',
    'girls', 'wives', 'ladies', "women's", 'her', 'she'];
  if (femaleSignals.some(s => lower.includes(s))) return 'female';

  return 'any';
}

/**
 * Resolve a definitive binary gender for a prospect.
 * Priority: stored gender > name-based inference > offer-level hint > random fallback.
 * Always returns 'male' | 'female' (never 'any').
 */
export function resolveProspectGender(
  name: string,
  offerGender: ProspectGender = 'any'
): 'male' | 'female' {
  // Infer from first name
  const firstName = name.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  if (FEMALE_FIRST_NAMES.map(n => n.toLowerCase()).includes(firstName)) return 'female';
  if (MALE_FIRST_NAMES.map(n => n.toLowerCase()).includes(firstName)) return 'male';

  // Fall back to offer-level hint
  if (offerGender === 'male') return 'male';
  if (offerGender === 'female') return 'female';

  // Final fallback: hash name to deterministic choice
  const hash = name.toLowerCase().split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  return hash % 2 === 0 ? 'male' : 'female';
}

function getFirstNamesForGender(gender: ProspectGender): string[] {
  switch (gender) {
    case 'male': return MALE_FIRST_NAMES;
    case 'female': return FEMALE_FIRST_NAMES;
    default: return FIRST_NAMES;
  }
}

/**
 * Returns a random realistic prospect name (e.g. "Maria Chen").
 * Pass a Set to avoid duplicates when generating multiple names in one go.
 * Pass gender to filter by male/female/any.
 */
export function generateRandomProspectName(usedNames?: Set<string>, gender: ProspectGender = 'any'): string {
  const firstNames = getFirstNamesForGender(gender);
  let name: string;
  do {
    const first = firstNames[Math.floor(Math.random() * firstNames.length)];
    const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    name = `${first} ${last}`;
  } while (usedNames?.has(name) && usedNames.size < firstNames.length * LAST_NAMES.length);
  usedNames?.add(name);
  return name;
}

export type AuthorityLevel = 'advisee' | 'peer' | 'advisor';
export type DifficultyTier = 'easy' | 'realistic' | 'hard' | 'expert' | 'near_impossible';

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

  // Character Sheet v3.0 (Connor's Character Sheet Wrapper)
  // Generated once at session start, locked for entire call.
  characterSheet?: CharacterSheet;
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

  // Determine tier based on 50-point scale (matches canonical V2_DIFFICULTY_BANDS)
  let tier: DifficultyTier;
  if (index >= 43) {
    tier = 'easy';
  } else if (index >= 36) {
    tier = 'realistic';
  } else if (index >= 30) {
    tier = 'hard';
  } else if (index >= 25) {
    tier = 'expert';
  } else {
    tier = 'near_impossible';
  }

  return { index, tier };
}

/**
 * Map user-selected difficulty to prospect profile ranges (50-point scale)
 */
export function mapDifficultySelectionToProfile(
  selectedDifficulty: 'easy' | 'realistic' | 'hard' | 'expert' | 'intermediate' | 'elite'
): {
  targetIndexRange: [number, number];
  targetTier: DifficultyTier;
} {
  switch (selectedDifficulty) {
    case 'easy':
      return { targetIndexRange: [43, 50], targetTier: 'easy' };
    case 'realistic':
    case 'intermediate':
      return { targetIndexRange: [36, 42], targetTier: 'realistic' };
    case 'hard':
      return { targetIndexRange: [30, 35], targetTier: 'hard' };
    case 'expert':
    case 'elite':
      return { targetIndexRange: [25, 29], targetTier: 'expert' };
    default:
      return { targetIndexRange: [36, 42], targetTier: 'realistic' };
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

/** Role pools by difficulty tier for prospect context generation */
const ROLE_POOLS: Record<string, string[]> = {
  easy: ['aspiring entrepreneur', 'career changer', 'motivated professional', 'eager freelancer', 'new business owner', 'young professional'],
  realistic: ['small business owner', 'mid-career professional', 'team lead', 'freelance consultant', 'working professional', 'self-employed tradesperson'],
  hard: ['established business owner', 'senior professional', 'experienced consultant', 'department head', 'seasoned manager', 'veteran practitioner'],
  expert: ['industry veteran', 'senior executive', 'serial entrepreneur', 'managing director', 'established authority', 'seasoned decision-maker'],
  near_impossible: ['highly resistant executive', 'deeply skeptical decision-maker', 'overwhelmed CEO', 'hostile prospect', 'burnt-out veteran', 'disengaged authority figure'],
};

const LOCATIONS = [
  'London', 'Manchester', 'Birmingham', 'Leeds', 'Bristol', 'Edinburgh',
  'Liverpool', 'Glasgow', 'Nottingham', 'Newcastle', 'Cardiff', 'Sheffield',
  'Brighton', 'Southampton', 'Leicester', 'Coventry', 'Belfast', 'Dublin',
];

/**
 * Generate rich 8-12 line prospect context mapped to all 5 difficulty markers + offer.
 * Each section pulls from both the prospect's dimension scores AND the offer context.
 *
 * Sections:
 *  1. Identity / Demographics (1-2 lines)
 *  2. Position + Problem as it relates to the offer (2-3 lines)
 *  3. Motivation Intensity (2-3 lines)
 *  4. Authority & Coachability (2-3 lines)
 *  5. Funnel Context (1-2 lines)
 *  6. Ability to Proceed (1 line)
 */
export function generateProspectContext(params: {
  name: string;
  gender: ProspectGender;
  positionProblemAlignment: number;
  painAmbitionIntensity: number;
  perceivedNeedForHelp: number;
  authorityLevel: AuthorityLevel;
  funnelContext: number;
  executionResistance: number;
  difficultyTier: DifficultyTier;
  offer: {
    offerCategory?: string;
    whoItsFor?: string;
    coreProblems?: string;
    offerName?: string;
  };
}): string {
  const {
    name, gender,
    positionProblemAlignment: icpScore,
    painAmbitionIntensity: motivationScore,
    perceivedNeedForHelp: _authorityScore,
    authorityLevel,
    funnelContext: funnelScore,
    executionResistance: abilityScore,
    difficultyTier,
    offer,
  } = params;

  const firstName = name.split(' ')[0] || 'They';

  // Pronouns
  const he = gender === 'male' ? 'He' : gender === 'female' ? 'She' : 'They';
  const him = gender === 'male' ? 'him' : gender === 'female' ? 'her' : 'them';
  const his = gender === 'male' ? 'his' : gender === 'female' ? 'her' : 'their';
  const His = his.charAt(0).toUpperCase() + his.slice(1);
  const heLower = he.toLowerCase();

  // Deterministic seeded random from name
  const nameHash = name.toLowerCase().split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  let seed = nameHash;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

  // Age (25-47) and location — deterministic from name
  const age = 25 + (nameHash % 23);
  const location = pick(LOCATIONS);

  // Extract offer context for natural integration
  const offerArea = offer.offerName || offer.offerCategory?.replace(/_/g, ' ') || 'this kind of program';
  const offerProblems = offer.coreProblems
    ?.split(/[,;\n]+/)
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 3) || [];
  const offerICP = offer.whoItsFor?.slice(0, 200) || '';

  const pickProblem = (): string => {
    if (offerProblems.length > 0) return pick(offerProblems);
    return pick(['finding the right approach', 'getting consistent results', 'making real progress', 'staying on track']);
  };

  const rolePool = ROLE_POOLS[difficultyTier] || ROLE_POOLS.realistic;
  // Filter roles by gender
  const genderFiltered = gender === 'female'
    ? rolePool.filter(r => !r.includes('dad') && !r.includes('father'))
    : gender === 'male'
      ? rolePool.filter(r => !r.includes('mom') && !r.includes('mother'))
      : rolePool;
  const role = pick(genderFiltered.length > 0 ? genderFiltered : rolePool);

  const lines: string[] = [];

  // ── SECTION 1: Identity / Demographics (1-2 lines) ──
  lines.push(`${firstName} is a ${age}-year-old ${role} from ${location}.`);

  // ── SECTION 2: Position + Problem aligned to offer (2-3 lines) ──
  if (icpScore >= 7) {
    if (offerICP) {
      lines.push(`${he} closely matches the ideal profile — ${offerICP.toLowerCase().slice(0, 120)}.`);
    } else {
      lines.push(`${he} closely fits the target audience for ${offerArea}.`);
    }
    lines.push(`${he}'s actively dealing with ${pickProblem()} and has been searching for the right solution.`);
    if (offerProblems.length > 1) {
      lines.push(`On top of that, ${heLower}'s also struggling with ${pick(offerProblems.filter(p => p !== offerProblems[0]))}.`);
    }
  } else if (icpScore >= 4) {
    lines.push(`${he}'s somewhat in the market for help with ${pickProblem()}, though ${heLower}'s not a textbook fit for the offer.`);
    lines.push(`${His} situation has some overlap — ${heLower}'s felt the pain of ${pickProblem()} but isn't sure this approach is right for ${him}.`);
  } else {
    lines.push(`${he} doesn't immediately look like an obvious fit for ${offerArea}.`);
    lines.push(`${His} challenges are adjacent — ${heLower}'s dealing with ${pickProblem()} but from a different angle than most prospects.`);
    lines.push(`It will take real work to show ${him} why this is relevant to ${his} situation.`);
  }

  // ── SECTION 3: Motivation Intensity (2-3 lines) ──
  if (motivationScore >= 8) {
    lines.push(`${firstName} is highly motivated — there's real urgency behind ${his} interest.`);
    lines.push(pick([
      `${he}'s reached a breaking point with ${his} current situation and is desperate for change.`,
      `Something recent has lit a fire under ${him} — ${heLower}'s done waiting and wants results now.`,
      `The pain of staying where ${heLower} is has become unbearable, and that's driving ${him} to act.`,
    ]));
  } else if (motivationScore >= 5) {
    lines.push(`${he}'s moderately motivated — there's genuine interest but no burning urgency.`);
    lines.push(pick([
      `${he} knows ${heLower} needs to make a change but hasn't hit ${his} tipping point yet.`,
      `${he}'s been thinking about solving this for a while but keeps putting it off.`,
      `There's enough dissatisfaction to explore options, but ${heLower}'s not desperate.`,
    ]));
  } else {
    lines.push(`${firstName}'s motivation is low — ${heLower}'s more curious than committed at this point.`);
    lines.push(pick([
      `${he} doesn't feel urgent pressure to change and could easily walk away.`,
      `${he}'s exploring out of mild interest rather than real need.`,
      `Without a compelling reason, ${heLower}'s likely to stick with the status quo.`,
    ]));
  }

  // ── SECTION 4: Authority & Coachability (2-3 lines) ──
  if (authorityLevel === 'advisee') {
    lines.push(`${he}'s open to guidance and willing to be led — ${heLower} knows ${heLower} doesn't have all the answers.`);
    lines.push(pick([
      `${he} hasn't tried many solutions before and is genuinely looking for expert help.`,
      `${he}'s the type who follows through when given a clear plan and accountability.`,
      `${he} respects expertise and is ready to listen without putting up walls.`,
    ]));
  } else if (authorityLevel === 'peer') {
    lines.push(`${he} sees ${him}self as knowledgeable but open to the right perspective.`);
    lines.push(pick([
      `${he}'s tried a few things before — some worked, some didn't — and ${heLower}'s cautious about new promises.`,
      `${he} wants to be convinced through logic and evidence, not high-pressure tactics.`,
      `${he}'ll engage in a real conversation but won't be pushed into anything ${heLower} doesn't believe in.`,
    ]));
  } else {
    lines.push(`${he} considers ${him}self an expert in ${his} domain and doesn't respond well to being "taught."`);
    lines.push(pick([
      `${he}'s been in the game for years and has a "prove it to me" mentality that's hard to crack.`,
      `${he}'s the type who gives advice, not takes it — getting ${him} to see value requires a peer-level conversation.`,
      `Previous attempts to sell ${him} things have failed because reps came across as less experienced than ${him}.`,
    ]));
  }

  // ── SECTION 5: Funnel Context (1-2 lines) ──
  const offerNameShort = offer.offerName?.slice(0, 50) || 'the program';
  if (funnelScore >= 7) {
    lines.push(pick([
      `${he} came in warm — ${heLower}'s watched content, read testimonials, and already understands the core offer.`,
      `${he} was referred by someone who's had success, so ${heLower}'s pre-sold on the concept.`,
      `${he}'s been following ${offerNameShort} content for weeks and booked the call voluntarily.`,
    ]));
  } else if (funnelScore >= 4) {
    lines.push(pick([
      `${he} saw an ad or landing page and booked a call — ${heLower}'s aware of ${offerNameShort} but hasn't gone deep.`,
      `${he} came through a webinar opt-in with moderate awareness of what's being offered.`,
      `${he}'s done some basic research but still has questions about whether this is legit.`,
    ]));
  } else {
    lines.push(pick([
      `${he} was cold-approached — ${heLower} didn't seek this out and has almost no context going in.`,
      `${he} barely knows what ${offerNameShort} is about and is skeptical about why ${heLower}'s even on this call.`,
      `This is essentially a cold conversation — ${heLower} has zero prior exposure to the brand or offer.`,
    ]));
  }

  // ── SECTION 6: Ability to Proceed (1 line) ──
  if (abilityScore >= 8) {
    lines.push(pick([
      `Money, time, and decision authority aren't issues — if ${heLower}'s sold, ${heLower} can move forward today.`,
      `${he} has the budget and bandwidth to commit immediately if convinced.`,
    ]));
  } else if (abilityScore >= 5) {
    lines.push(pick([
      `${he} could proceed but would need to reprioritize — ${pick(['budget is tight', 'time is limited', `${heLower} needs to discuss with a partner`])} but not impossible.`,
      `There's some friction around logistics — ${heLower}'ll need to ${pick(['move things around financially', `clear ${his} schedule`, 'get buy-in from someone else'])} to commit.`,
    ]));
  } else {
    lines.push(pick([
      `Major logistical blockers: ${pick([`${heLower} genuinely can't afford it right now`, `${his} time is completely locked up`, 'someone else controls the budget'])}.`,
      `Proceeding today is near-impossible — ${pick([`the money simply isn't there`, `${heLower}'s overcommitted on time`, `${heLower} needs approval from others first`])}.`,
    ]));
  }

  return lines.join(' ');
}

/**
 * Legacy wrapper — generates a short character-driven bio.
 * Use generateProspectContext() for the full 8-12 line version when scores are available.
 */
export function getDefaultBioForDifficulty(
  tier: DifficultyTier | 'realistic' | 'hard' | 'expert' | 'elite' | 'easy' | 'near_impossible',
  prospectName?: string,
  offerContext?: {
    offerCategory?: string;
    whoItsFor?: string;
    coreProblems?: string;
    offerName?: string;
  },
  gender?: ProspectGender
): string {
  // Legacy fallback — delegates to generateProspectContext with default mid-range scores
  const mappedTier: DifficultyTier = (tier === 'elite' ? 'expert' : tier) as DifficultyTier;
  return generateProspectContext({
    name: prospectName || 'Prospect',
    gender: gender || 'any',
    positionProblemAlignment: mappedTier === 'easy' ? 8 : mappedTier === 'realistic' ? 6 : mappedTier === 'hard' ? 4 : 3,
    painAmbitionIntensity: mappedTier === 'easy' ? 8 : mappedTier === 'realistic' ? 6 : mappedTier === 'hard' ? 4 : 2,
    perceivedNeedForHelp: mappedTier === 'easy' ? 8 : mappedTier === 'realistic' ? 5 : mappedTier === 'hard' ? 3 : 2,
    authorityLevel: mappedTier === 'easy' ? 'advisee' : mappedTier === 'realistic' ? 'peer' : 'advisor',
    funnelContext: mappedTier === 'easy' ? 8 : mappedTier === 'realistic' ? 5 : mappedTier === 'hard' ? 3 : 2,
    executionResistance: mappedTier === 'easy' ? 8 : mappedTier === 'realistic' ? 6 : mappedTier === 'hard' ? 4 : 2,
    difficultyTier: mappedTier,
    offer: offerContext || {},
  });
}

/**
 * Generate a random prospect within a difficulty band (50-point model)
 * Ensures total difficulty score falls within selected range
 */
export function generateRandomProspectInBand(
  selectedDifficulty: 'easy' | 'realistic' | 'hard' | 'expert' | 'intermediate' | 'elite'
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

    case 'expert':
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

// ═══════════════════════════════════════════════════════════
// Character Sheet Generation (Connor v3.0)
// ═══════════════════════════════════════════════════════════

/**
 * Generate a complete 7-section character sheet from prospect data.
 * Rule 1: Scores are ALREADY generated — this builds identity/backstory/objections
 * to FIT those scores.
 */
export function generateCharacterSheet(params: {
  name: string;
  gender: ProspectGender;
  difficulty: ProspectDifficultyProfile;
  offer: {
    offerCategory?: string;
    offerName?: string;
    priceRange?: string;
    coreOutcome?: string;
    whoItsFor?: string;
    coreProblems?: string;
    guaranteesRefundTerms?: string;
  };
  existingContext?: string; // From generateProspectContext(), used to populate backstory
}): CharacterSheet {
  const { name, gender, difficulty, offer, existingContext } = params;
  const firstName = name.split(' ')[0] || name;

  // Deterministic seeded random from name
  const nameHash = name.toLowerCase().split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  let seed = nameHash;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

  // Age and location — deterministic from name
  const age = 25 + (nameHash % 23);
  const location = pick(LOCATIONS);
  const isUK = ['London', 'Manchester', 'Birmingham', 'Leeds', 'Bristol', 'Edinburgh',
    'Liverpool', 'Glasgow', 'Nottingham', 'Newcastle', 'Cardiff', 'Sheffield',
    'Brighton', 'Southampton', 'Leicester', 'Coventry', 'Belfast', 'Dublin'].includes(location);
  const currency = isUK ? '£' : '$';

  // Job and income from role pools
  const rolePool = ROLE_POOLS[difficulty.difficultyTier] || ROLE_POOLS.realistic;
  const role = pick(rolePool);
  const incomeBase = difficulty.executionResistance >= 7 ? 3000 + (nameHash % 4) * 1000
    : difficulty.executionResistance >= 4 ? 2000 + (nameHash % 3) * 500
    : 1000 + (nameHash % 3) * 300;
  const income = `${currency}${incomeBase.toLocaleString()}/month`;

  // Family status — affects whether partner objection is valid
  const hasPartner = rand() > 0.35; // 65% have a partner
  const hasChildren = hasPartner && rand() > 0.5;
  const partnerGender = gender === 'male' ? 'wife' : gender === 'female' ? 'husband' : 'partner';
  const familyStatus = hasPartner
    ? hasChildren
      ? `Lives with ${partnerGender} and ${Math.ceil(rand() * 3)} child${Math.ceil(rand() * 3) > 1 ? 'ren' : ''}`
      : `In a relationship with ${partnerGender}`
    : 'Single, no dependents';

  const livingSituation = difficulty.executionResistance >= 7
    ? pick(['Owns a home, mortgage manageable', 'Renting a decent flat, stable'])
    : difficulty.executionResistance >= 4
    ? pick(['Renting, shared with partner', 'Small flat, rent takes up 40% of income'])
    : pick(['Renting, behind on payments', 'Living with parents to save money', 'Shared housing, barely covering rent']);

  // Section 1: Identity
  const identity: CharacterSheetIdentity = {
    name: firstName,
    age,
    gender: gender === 'any' ? (rand() > 0.5 ? 'male' : 'female') : gender as 'male' | 'female',
    location: `${location}, ${isUK ? 'UK' : 'US'}`,
    job: `${role}, working ${difficulty.executionResistance <= 4 ? 'long hours' : 'standard hours'}`,
    income,
    familyStatus,
    livingSituation,
  };

  // Section 2: Difficulty Scores
  const scores: CharacterSheetScores = {
    icpAlignment: difficulty.positionProblemAlignment,
    motivationIntensity: difficulty.painAmbitionIntensity,
    authorityAndCoachability: difficulty.perceivedNeedForHelp,
    funnelContext: difficulty.funnelContext,
    abilityToProceed: difficulty.executionResistance,
    total: difficulty.difficultyIndex,
    difficultyBand: difficulty.difficultyTier.charAt(0).toUpperCase() + difficulty.difficultyTier.slice(1).replace('_', ' '),
  };

  // Section 3: Authority Archetype
  const authorityDescriptions = {
    advisee: {
      corePosture: 'Open to being helped. Respects the closer\'s authority and expertise.',
      howTheyShare: 'Detailed, emotional, volunteers context unprompted. Shares story behind facts.',
      howTheyPushBack: 'Transparent — asks questions rather than challenging. Rarely pushes back.',
      howTheyDecide: 'Follows the closer\'s lead if trust and value are established.',
    },
    peer: {
      corePosture: 'Evaluative. Respects competence but needs to see proof before trusting.',
      howTheyShare: 'Factual, measured, surface-level until trust is earned. Hedged language.',
      howTheyPushBack: 'Evaluative — compares options, mentions competitors, asks pointed questions.',
      howTheyDecide: 'Evaluates independently. Needs to feel like they made the choice, not that they were sold.',
    },
    advisor: {
      corePosture: 'Positions as an equal or superior. Has opinions about everything.',
      howTheyShare: 'A lot of detail but on THEIR terms. Talks about their experience and analysis.',
      howTheyPushBack: 'Controlling — challenges questions, redirects to their expertise, asks questions back.',
      howTheyDecide: 'Takes control of the decision. Will resist any feeling of being "sold to."',
    },
  };

  const archDesc = authorityDescriptions[difficulty.authorityLevel];
  const authority: CharacterSheetAuthority = {
    archetype: difficulty.authorityLevel,
    corePosture: archDesc.corePosture,
    howTheyShare: archDesc.howTheyShare,
    howTheyPushBack: archDesc.howTheyPushBack,
    howTheyDecide: archDesc.howTheyDecide,
  };

  // Section 4: Speech Patterns
  const speechPatterns = generateSpeechPatterns(location, age, difficulty.authorityLevel);

  // Section 5: Backstory
  const motivationIntensity = difficulty.painAmbitionIntensity;
  const coreProblem = motivationIntensity >= 7
    ? pick([
      `Reached a breaking point — the current job is destroying ${identity.gender === 'male' ? 'his' : 'her'} confidence and energy.`,
      `Can\'t keep doing this for another year. The financial pressure is building and something has to change.`,
    ])
    : motivationIntensity >= 4
    ? pick([
      `Knows the current situation isn\'t ideal but hasn\'t hit rock bottom yet. More uncomfortable than desperate.`,
      `Wants more from life but keeps putting off the change. Comfortable enough to keep delaying.`,
    ])
    : pick([
      `No urgent problem. Just curious and exploring options. Could walk away without losing sleep.`,
      `Life is fine. A friend mentioned this and it sounded interesting. No real pressure to act.`,
    ]);

  const coreAmbition = motivationIntensity >= 7
    ? `Wants to hit ${currency}${(5000 + (nameHash % 10) * 1000).toLocaleString()}/month within 6 months. Has a specific vision of what that life looks like.`
    : motivationIntensity >= 4
    ? `Would like to make ${currency}${(3000 + (nameHash % 5) * 1000).toLocaleString()}/month eventually. Flexible on timeline.`
    : 'Just wants to make a bit more than currently. No specific target.';

  const whyNow = motivationIntensity >= 7
    ? pick(['Recent event forced a reckoning — can\'t ignore it anymore.', 'Deadline approaching that makes this urgent.'])
    : motivationIntensity >= 4
    ? pick(['Saw some content that resonated.', 'Friend suggested it and the timing felt right.'])
    : pick(['A friend told them about it.', 'Saw an ad and clicked. No specific trigger.']);

  const financialReality = generateFinancialReality(
    difficulty.executionResistance,
    income,
    location
  );

  const backstory: CharacterSheetBackstory = {
    currentSituation: existingContext?.slice(0, 200) || `Works as a ${role} in ${location}. ${livingSituation}. ${familyStatus}.`,
    coreProblem,
    coreAmbition,
    whyNow,
    whatTheyTried: pick([
      'Tried dropshipping — lost money. Looked at trading — seemed like a scam.',
      'Explored appointment setting, had a bad experience with a pushy sales call.',
      'Started a YouTube channel but never monetized it. Got discouraged.',
      'Bought a course before but never finished it. Felt like a waste.',
      'No previous attempts. This is the first time seriously looking into it.',
    ]),
    keyRelationships: hasPartner ? `${partnerGender.charAt(0).toUpperCase() + partnerGender.slice(1)} — ${rand() > 0.5 ? 'supportive but cautious about money' : 'skeptical about online programs'}.` : 'No partner involved in the decision.',
    financialReality,
    timeAvailability: difficulty.executionResistance >= 7
      ? `${10 + (nameHash % 15)} hours per week available. Could make more if needed.`
      : difficulty.executionResistance >= 4
      ? `${5 + (nameHash % 10)} hours per week, squeezed around the day job.`
      : '2-3 hours per week at best. Already stretched thin.',
  };

  // Section 6: Objection Set
  const objectionSet = generateObjectionSet(
    difficulty.authorityLevel,
    difficulty.executionResistance,
    hasPartner
  );

  // Section 7: Offer Context
  const priceStr = offer.priceRange || '5000-15000';
  const priceMatch = priceStr.match(/(\d+)/g);
  const maxPrice = priceMatch && priceMatch.length > 1 ? parseInt(priceMatch[1]) : 10000;

  const offerContext: CharacterSheetOfferContext = {
    offerType: offer.offerCategory?.replace(/_/g, ' ') || 'sales coaching',
    offerName: offer.offerName || 'The Program',
    price: `${currency}${maxPrice.toLocaleString()}`,
    paymentOptions: `PIF / ${Math.ceil(maxPrice / 1000)}-month plan / ${currency}${Math.round(maxPrice * 0.1)} deposit`,
    corePromise: offer.coreOutcome || 'Build a high-income skill and replace your current income',
    guarantee: offer.guaranteesRefundTerms || undefined,
  };

  return {
    identity,
    scores,
    authority,
    speechPatterns,
    backstory,
    objectionSet,
    offerContext,
  };
}
