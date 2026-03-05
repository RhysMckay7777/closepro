/**
 * Character Sheet Wrapper — Connor's Framework v3.0
 * The prospect's DNA — single source of truth for who they ARE across all phases.
 * Generated ONCE at roleplay start and LOCKED for the entire call.
 *
 * Architecture: All phase docs (intro, discovery, pitch, close/objections)
 * reference this sheet. Without it, the AI drifts.
 *
 * Source: Connor Williams' "CHARACTER SHEET WRAPPER — IMPLEMENTATION PROMPT FOR AI PROSPECT AGENT"
 */

// ═══════════════════════════════════════════════════════════
// TypeScript Interfaces
// ═══════════════════════════════════════════════════════════

export interface CharacterSheetIdentity {
  name: string;           // First name only
  age: number;            // Specific age
  gender: 'male' | 'female' | 'non-binary';
  location: string;       // City, Country — determines currency + regional speech
  job: string;            // Current employment, hours, role specifics
  income: string;         // Monthly take-home, specific number with currency
  familyStatus: string;   // Partner status, children, dependents
  livingSituation: string; // Renting/owning, shared housing, relevant constraints
}

export interface CharacterSheetScores {
  icpAlignment: number;              // 0-10
  motivationIntensity: number;       // 0-10
  authorityAndCoachability: number;  // 0-10
  funnelContext: number;             // 0-10
  abilityToProceed: number;          // 0-10
  total: number;                     // sum /50
  difficultyBand: string;            // Easy / Realistic / Hard / Expert / Near Impossible
}

export interface CharacterSheetAuthority {
  archetype: 'advisee' | 'peer' | 'advisor';
  corePosture: string;    // 1-2 sentences — default relationship to the closer
  howTheyShare: string;   // Brief vs detailed, emotional vs factual
  howTheyPushBack: string; // Transparent vs evaluative vs controlling
  howTheyDecide: string;  // Follows lead vs evaluates vs takes control
}

export interface CharacterSheetSpeechPatterns {
  pace: 'fast' | 'moderate' | 'slow' | 'variable';
  sentenceLength: 'short' | 'moderate' | 'long';
  fillerWords: string[];       // 3-5 specific fillers
  regionalMarkers: string[];   // Phrases tied to location
  verbalHabits: string[];      // Self-correction, trailing off, thinking out loud
  emotionalExpression: string; // How they show feeling through language
  formalityLevel: 'casual' | 'semi-formal' | 'formal';
}

export interface CharacterSheetBackstory {
  currentSituation: string;  // 2-3 sentences
  coreProblem: string;       // 1-2 sentences
  coreAmbition: string;      // 1-2 sentences
  whyNow: string;            // 1 sentence
  whatTheyTried: string;     // 1-2 sentences
  keyRelationships: string;  // Partner, family, friends relevant to decision
  financialReality: string;  // Specific numbers — savings, debts, income, obligations
  timeAvailability: string;  // Hours per week they could realistically commit
}

export interface CharacterSheetObjectionSet {
  primaryObjection: string;
  primaryType: 'value' | 'trust' | 'fit' | 'logistics';
  genuineOrDisguised: 'genuine' | 'disguised';
  realBlocker?: string;      // Only if disguised
  secondaryObjection: string;
  secondaryType: 'value' | 'trust' | 'fit' | 'logistics';
  coreResistance: string;    // Deepest layer
  resolutionPath: string;    // What the closer would need to do/say
  outcomeCeiling: 'pif' | 'payment_plan' | 'deposit' | 'follow_up' | 'loss';
}

export interface CharacterSheetOfferContext {
  offerType: string;
  offerName: string;
  price: string;
  discountedPrice?: string;
  paymentOptions: string;
  corePromise: string;
  guarantee?: string;
  socialProof?: string;
}

export interface CharacterSheet {
  identity: CharacterSheetIdentity;
  scores: CharacterSheetScores;
  authority: CharacterSheetAuthority;
  speechPatterns: CharacterSheetSpeechPatterns;
  backstory: CharacterSheetBackstory;
  objectionSet: CharacterSheetObjectionSet;
  offerContext: CharacterSheetOfferContext;
}

// ═══════════════════════════════════════════════════════════
// Speech Pattern Templates by Region
// ═══════════════════════════════════════════════════════════

const UK_SPEECH_TEMPLATES = {
  fillerWords: [
    ['I mean', 'you know', 'to be fair', 'like', 'I suppose'],
    ['do you know what I mean', 'to be honest', 'sort of', 'I reckon', 'basically'],
    ['right', 'innit', 'I guess', 'kind of', 'if that makes sense'],
  ],
  regionalMarkers: [
    ['mate', 'to be fair', 'do you know what I mean', 'massive', 'proper'],
    ['blimey', 'cheers', 'well done', 'brilliant', 'sorted'],
    ['fair enough', 'as it were', 'at the end of the day', 'mind you', 'by all means'],
  ],
  verbalHabits: [
    ['Self-corrects mid-sentence: "I was making — well, I still am — making progress"'],
    ['Trails off when thinking: "So, yeah..." / "But that\'s — yeah."'],
    ['Repetition for emphasis: "It\'s exhausting. I mean, it\'s exhausting."'],
    ['Thinking out loud: "That\'s a good question. Honestly, I was thinking about it to myself..."'],
  ],
};

const US_SPEECH_TEMPLATES = {
  fillerWords: [
    ['I mean', 'honestly', 'like', 'you know', 'for sure'],
    ['basically', 'literally', 'I guess', 'at the end of the day', 'kind of'],
    ['you know what', 'no cap', 'straight up', 'I feel like', 'real talk'],
  ],
  regionalMarkers: [
    ['for sure', 'straight up', 'no doubt', 'awesome', 'legit'],
    ['you guys', 'super', 'totally', 'big time', 'the thing is'],
    ['honestly', 'like I said', 'at this point', 'moving forward', 'bottom line'],
  ],
  verbalHabits: [
    ['Restarts sentences: "Well the thing is — I mean, what I\'m saying is..."'],
    ['Trailing off: "I just... I don\'t know if..." / "Yeah, no, that\'s..."'],
    ['Thinking out loud: "Hmm, you know what, I hadn\'t really thought about it like that..."'],
    ['Self-correction: "I tried — well, I started and then stopped — a couple of things"'],
  ],
};

// ═══════════════════════════════════════════════════════════
// Objection Templates by Authority × Ability
// ═══════════════════════════════════════════════════════════

const OBJECTION_TEMPLATES = {
  advisee: {
    highAbility: {
      primary: 'I just want to make sure this is the right thing for me',
      primaryType: 'value' as const,
      genuine: true,
      secondary: 'What if I put all this money in and it doesn\'t work?',
      secondaryType: 'trust' as const,
      outcomeCeiling: 'pif' as const,
    },
    medAbility: {
      primary: 'I don\'t know if I can afford it right now',
      primaryType: 'logistics' as const,
      genuine: true,
      secondary: 'Can I do a payment plan or something?',
      secondaryType: 'logistics' as const,
      outcomeCeiling: 'payment_plan' as const,
    },
    lowAbility: {
      primary: 'I literally don\'t have the money right now',
      primaryType: 'logistics' as const,
      genuine: true,
      secondary: 'When\'s the next intake? Can I start in a couple of months?',
      secondaryType: 'logistics' as const,
      outcomeCeiling: 'deposit' as const,
    },
  },
  peer: {
    highAbility: {
      primary: 'I need to think about it',
      primaryType: 'value' as const,
      genuine: false,
      realBlocker: 'Comparing options and not fully sold on this being the one',
      secondary: 'How is this different from other programs?',
      secondaryType: 'fit' as const,
      outcomeCeiling: 'pif' as const,
    },
    medAbility: {
      primary: 'I need to think about it',
      primaryType: 'value' as const,
      genuine: false,
      realBlocker: 'Unsure about making a financial commitment without more proof',
      secondary: 'I need to check with my partner about the finances',
      secondaryType: 'logistics' as const,
      outcomeCeiling: 'payment_plan' as const,
    },
    lowAbility: {
      primary: 'The money\'s just not there right now',
      primaryType: 'logistics' as const,
      genuine: true,
      secondary: 'I need to speak to my wife/husband about this',
      secondaryType: 'logistics' as const,
      outcomeCeiling: 'follow_up' as const,
    },
  },
  advisor: {
    highAbility: {
      primary: 'I need to do my own research first',
      primaryType: 'trust' as const,
      genuine: false,
      realBlocker: 'Doesn\'t want to be sold — wants to feel like they chose independently',
      secondary: 'What\'s your success rate? What percentage actually make money?',
      secondaryType: 'trust' as const,
      outcomeCeiling: 'pif' as const,
    },
    medAbility: {
      primary: 'I\'m weighing my options',
      primaryType: 'fit' as const,
      genuine: true,
      secondary: 'I need to see the numbers before I commit',
      secondaryType: 'value' as const,
      outcomeCeiling: 'deposit' as const,
    },
    lowAbility: {
      primary: 'I don\'t think the timing is right',
      primaryType: 'logistics' as const,
      genuine: false,
      realBlocker: 'Ego prevents admitting financial constraints',
      secondary: 'I\'ve been burned before — I need guarantees',
      secondaryType: 'trust' as const,
      outcomeCeiling: 'loss' as const,
    },
  },
};

// ═══════════════════════════════════════════════════════════
// Financial Reality Templates
// ═══════════════════════════════════════════════════════════

const FINANCIAL_TEMPLATES = {
  high: [
    '£{savings} in savings, no significant debt. Take-home is £{income}/month with low outgoings.',
    '${savings} saved up, mortgage is manageable at ${mortgage}/month. Has discretionary income.',
    '£{savings} set aside, car payment £{car}/month, otherwise comfortable. Could invest if convinced.',
  ],
  medium: [
    '£{savings} in savings, credit card balance of £{debt}. Take-home is £{income}/month, rent is £{rent}/month.',
    '${savings} saved, student loans at ${debt}. Makes ${income}/month but most goes to essentials.',
    '£{savings} in current account, pays £{rent}/month rent plus £{bills}/month bills. Tight but possible.',
  ],
  low: [
    '£{savings} in savings — barely. No income until {payday}. Selling items on Vinted for grocery money.',
    '${savings} total. Credit cards maxed at ${debt}. Behind on {bill} payments. Partner doesn\'t know.',
    '£{savings} across all accounts. Overdraft of £{debt}. Wife handles the finances. Zero discretionary.',
  ],
};

// ═══════════════════════════════════════════════════════════
// Character Sheet Generation
// ═══════════════════════════════════════════════════════════

/**
 * Generate speech patterns based on location, age, and authority level.
 * Rule: Speech patterns must be consistent with location and age.
 */
export function generateSpeechPatterns(
  location: string,
  age: number,
  authorityLevel: 'advisee' | 'peer' | 'advisor'
): CharacterSheetSpeechPatterns {
  const isUK = isUKLocation(location);
  const templates = isUK ? UK_SPEECH_TEMPLATES : US_SPEECH_TEMPLATES;

  // Seeded selection based on location + age
  const seed = location.length + age;
  const pick = <T>(arr: T[]): T => arr[seed % arr.length];

  // Pace and sentence length based on authority
  const pace = authorityLevel === 'advisee' ? 'moderate' as const
    : authorityLevel === 'peer' ? 'variable' as const
    : 'moderate' as const;

  const sentenceLength = authorityLevel === 'advisee' ? 'long' as const
    : authorityLevel === 'peer' ? 'moderate' as const
    : 'short' as const;

  const formalityLevel = age >= 40 ? 'semi-formal' as const
    : age >= 30 ? 'casual' as const
    : 'casual' as const;

  // Emotional expression based on authority
  const emotionalExpression = authorityLevel === 'advisee'
    ? 'Expresses feelings openly through word choice and tone. Uses emotional language freely.'
    : authorityLevel === 'peer'
    ? 'Reserved initially. Showing emotion requires trust. Uses hedged emotional language.'
    : 'Redirects emotional questions to logic. Rarely uses emotional words. Shows feelings through brevity or pace changes.';

  return {
    pace,
    sentenceLength,
    fillerWords: pick(templates.fillerWords),
    regionalMarkers: pick(templates.regionalMarkers),
    verbalHabits: [pick(templates.verbalHabits)[0]],
    emotionalExpression,
    formalityLevel,
  };
}

/**
 * Generate pre-determined objection set based on authority and ability scores.
 * Rule: Objections must logically follow from the difficulty profile.
 */
export function generateObjectionSet(
  authorityLevel: 'advisee' | 'peer' | 'advisor',
  abilityToProceed: number,
  hasPartner: boolean
): CharacterSheetObjectionSet {
  const abilityBand = abilityToProceed >= 7 ? 'highAbility'
    : abilityToProceed >= 4 ? 'medAbility'
    : 'lowAbility';

  const template = OBJECTION_TEMPLATES[authorityLevel][abilityBand];

  // If no partner, cannot use partner objection
  let secondary = template.secondary;
  let secondaryType = template.secondaryType;
  if (!hasPartner && secondary.includes('partner') || secondary.includes('wife') || secondary.includes('husband')) {
    secondary = authorityLevel === 'advisee'
      ? 'What if it doesn\'t work for someone like me?'
      : 'I want to see proof it works for people in my situation';
    secondaryType = 'value';
  }

  return {
    primaryObjection: template.primary,
    primaryType: template.primaryType,
    genuineOrDisguised: template.genuine ? 'genuine' : 'disguised',
    realBlocker: 'realBlocker' in template ? template.realBlocker : undefined,
    secondaryObjection: secondary,
    secondaryType,
    coreResistance: `The deepest layer is ${authorityLevel === 'advisee' ? 'fear of failure and wasting money they can\'t afford to lose' : authorityLevel === 'peer' ? 'fear of making the wrong choice and regretting it' : 'fear of losing control and being sold something they didn\'t independently choose'}.`,
    resolutionPath: authorityLevel === 'advisee'
      ? 'Reassurance through social proof, guarantee emphasis, and emotional commitment callback'
      : authorityLevel === 'peer'
      ? 'Challenge their pattern of hesitation, use their own words from discovery, offer deposit as safe first step'
      : 'Respect their intelligence, present data/ROI, let them feel like they\'re making the decision',
    outcomeCeiling: template.outcomeCeiling,
  };
}

/**
 * Generate financial reality string with specific numbers.
 * Rule 3: Specificity Over Generality — every field must be specific enough to reference.
 */
export function generateFinancialReality(
  abilityToProceed: number,
  income: string,
  location: string
): string {
  const isUK = isUKLocation(location);
  const currency = isUK ? '£' : '$';
  const seed = income.length + abilityToProceed;

  const band = abilityToProceed >= 7 ? 'high'
    : abilityToProceed >= 4 ? 'medium'
    : 'low';

  const templates = FINANCIAL_TEMPLATES[band];
  const template = templates[seed % templates.length];

  // Generate specific numbers based on ability score
  const savingsBase = band === 'high' ? 3000 + (seed % 7) * 1000
    : band === 'medium' ? 500 + (seed % 10) * 200
    : 50 + (seed % 10) * 30;

  const debtBase = band === 'high' ? 0
    : band === 'medium' ? 1000 + (seed % 5) * 500
    : 2000 + (seed % 8) * 500;

  const rentBase = 600 + (seed % 8) * 100;
  const billsBase = 150 + (seed % 5) * 50;
  const carBase = 200 + (seed % 4) * 50;
  const mortgageBase = 800 + (seed % 6) * 200;

  const months = ['January', 'February', 'March', 'April', 'May', 'June'];
  const payday = `${months[seed % 6]} ${15 + (seed % 15)}th`;
  const bills = ['electricity', 'council tax', 'phone', 'car insurance'];
  const bill = bills[seed % bills.length];

  return template
    .replace(/\{savings\}/g, `${savingsBase.toLocaleString()}`)
    .replace(/\{income\}/g, income.replace(/[£$]/g, ''))
    .replace(/\{debt\}/g, `${debtBase.toLocaleString()}`)
    .replace(/\{rent\}/g, `${rentBase}`)
    .replace(/\{bills\}/g, `${billsBase}`)
    .replace(/\{car\}/g, `${carBase}`)
    .replace(/\{mortgage\}/g, `${mortgageBase}`)
    .replace(/\{payday\}/g, payday)
    .replace(/\{bill\}/g, bill)
    .replace(/[£$]/g, currency);
}

/** Helper: determine if location is UK-based */
function isUKLocation(location: string): boolean {
  const ukCities = [
    'London', 'Manchester', 'Birmingham', 'Leeds', 'Bristol', 'Edinburgh',
    'Liverpool', 'Glasgow', 'Nottingham', 'Newcastle', 'Cardiff', 'Sheffield',
    'Brighton', 'Southampton', 'Leicester', 'Coventry', 'Belfast', 'Dublin',
    'Aberdeen', 'Swansea', 'Plymouth', 'Stoke', 'Wolverhampton', 'Derby',
  ];
  return ukCities.some(city => location.toLowerCase().includes(city.toLowerCase())) ||
    location.toLowerCase().includes('uk') || location.toLowerCase().includes('england') ||
    location.toLowerCase().includes('scotland') || location.toLowerCase().includes('wales');
}

// ═══════════════════════════════════════════════════════════
// Format Character Sheet for System Prompt Injection
// ═══════════════════════════════════════════════════════════

/**
 * Format a CharacterSheet into the locked prompt text injected into the system prompt.
 * This is the prospect's DNA — referenced by all phase docs.
 */
export function formatCharacterSheet(sheet: CharacterSheet): string {
  return `
═══ LOCKED CHARACTER SHEET — DO NOT CONTRADICT ═══
This is your complete identity. Every response you give must be consistent with this sheet.
It was generated at session start and is LOCKED for the entire call.

SECTION 1: IDENTITY
Name: ${sheet.identity.name}
Age: ${sheet.identity.age}
Gender: ${sheet.identity.gender}
Location: ${sheet.identity.location}
Job: ${sheet.identity.job}
Income: ${sheet.identity.income}
Family: ${sheet.identity.familyStatus}
Living situation: ${sheet.identity.livingSituation}

SECTION 2: DIFFICULTY SCORES
ICP Alignment: ${sheet.scores.icpAlignment}/10
Motivation Intensity: ${sheet.scores.motivationIntensity}/10
Authority & Coachability: ${sheet.scores.authorityAndCoachability}/10
Funnel Context: ${sheet.scores.funnelContext}/10
Ability to Proceed: ${sheet.scores.abilityToProceed}/10
Total: ${sheet.scores.total}/50
Difficulty Band: ${sheet.scores.difficultyBand}
RULE: These scores are FIXED. They do NOT change based on closer performance.

SECTION 3: AUTHORITY ARCHETYPE
Archetype: ${sheet.authority.archetype.toUpperCase()}
Core posture: ${sheet.authority.corePosture}
How you share: ${sheet.authority.howTheyShare}
How you push back: ${sheet.authority.howTheyPushBack}
How you decide: ${sheet.authority.howTheyDecide}

SECTION 4: SPEECH PATTERNS
Pace: ${sheet.speechPatterns.pace}
Sentence length: ${sheet.speechPatterns.sentenceLength}
Filler words: ${sheet.speechPatterns.fillerWords.join(', ')}
Regional markers: ${sheet.speechPatterns.regionalMarkers.join(', ')}
Verbal habits: ${sheet.speechPatterns.verbalHabits.join('; ')}
Emotional expression: ${sheet.speechPatterns.emotionalExpression}
Formality: ${sheet.speechPatterns.formalityLevel}
RULE: Use these speech patterns consistently from first word to last.

SECTION 5: BACKSTORY & SITUATION
Current situation: ${sheet.backstory.currentSituation}
Core problem: ${sheet.backstory.coreProblem}
Core ambition: ${sheet.backstory.coreAmbition}
Why now: ${sheet.backstory.whyNow}
What you've tried: ${sheet.backstory.whatTheyTried}
Key relationships: ${sheet.backstory.keyRelationships}
Financial reality: ${sheet.backstory.financialReality}
Time availability: ${sheet.backstory.timeAvailability}
RULE: Not everything here needs to come out during the call. What gets shared depends on the closer's questions and your authority archetype.

SECTION 6: PRE-DETERMINED OBJECTION SET
Primary objection: "${sheet.objectionSet.primaryObjection}"
Primary type: ${sheet.objectionSet.primaryType}
${sheet.objectionSet.genuineOrDisguised === 'disguised' ? `Genuine or disguised: DISGUISED\nReal blocker: ${sheet.objectionSet.realBlocker}` : 'Genuine or disguised: GENUINE'}
Secondary objection: "${sheet.objectionSet.secondaryObjection}"
Secondary type: ${sheet.objectionSet.secondaryType}
Core resistance: ${sheet.objectionSet.coreResistance}
Resolution path: ${sheet.objectionSet.resolutionPath}
Outcome ceiling: ${sheet.objectionSet.outcomeCeiling.toUpperCase().replace('_', ' ')}
RULES:
- Intro & Discovery → Objection set is INVISIBLE. Do not hint.
- Pitch → Minor signals may appear (Peer with fit objection asks "How is this different...")
- Close → Primary surfaces after price drop. If handled well, secondary emerges.
- ONLY raise objections from this set. Cannot raise objections not pre-loaded.

SECTION 7: OFFER CONTEXT
Offer type: ${sheet.offerContext.offerType}
Offer name: ${sheet.offerContext.offerName}
Price: ${sheet.offerContext.price}
${sheet.offerContext.discountedPrice ? `Discounted price: ${sheet.offerContext.discountedPrice}` : ''}
Payment options: ${sheet.offerContext.paymentOptions}
Core promise: ${sheet.offerContext.corePromise}
${sheet.offerContext.guarantee ? `Guarantee: ${sheet.offerContext.guarantee}` : ''}
${sheet.offerContext.socialProof ? `Social proof: ${sheet.offerContext.socialProof}` : ''}
`;
}

// ═══════════════════════════════════════════════════════════
// Drift Prevention Rules (injected after character sheet)
// ═══════════════════════════════════════════════════════════

export const DRIFT_PREVENTION_RULES = `
═══ DRIFT PREVENTION RULES (ENFORCED THROUGHOUT ALL PHASES) ═══

1. NAME CONSISTENCY: Use the SAME details throughout. If you said "my little boy" in discovery, don't say "my kids" in the close.

2. SCORE CONSISTENCY: Behaviour cannot exceed the boundaries set by scores. A Peer (Authority 6) who warms up does NOT become an Advisee (Authority 9). They become a WARMER PEER. The archetype is permanent — warmth within it is variable.

3. FINANCIAL CONSISTENCY: Every number mentioned must be traceable to the character sheet. If the sheet says £400 in savings, you cannot mention £2,000 in a different account during the close. Financial details are the most common drift point.

4. OBJECTION CONSISTENCY: The pre-determined objection set is the ONLY objection set. Cannot raise objections not pre-loaded. If primary objection is "need to think about it" (disguised fear) and you're a single mum — you cannot raise a partner authority objection because there IS no partner.

5. SPEECH PATTERN CONSISTENCY: Fillers, pace, regional markers, and verbal habits remain constant from first word to last. If you say "do you know what I mean?" in discovery, you say it in the close too.

6. EMOTIONAL ARC CONSISTENCY: Emotional state evolves LOGICALLY. Nervous in intro → cautiously open in discovery → engaged in pitch → objections in close = coherent. Enthusiastic in discovery → cold in pitch with no trigger = drift.

7. NO RETROACTIVE CONTRADICTION: Cannot contradict anything said earlier. If you said "I work 6 days a week" in discovery, you cannot say "I've got plenty of free time" in the pitch.
`;

// ═══════════════════════════════════════════════════════════
// Character Sheet Generation Rules (for documentation)
// ═══════════════════════════════════════════════════════════

export const CHARACTER_SHEET_RULES = `
CHARACTER GENERATION RULES:

1. SCORES FIRST, CHARACTER SECOND: Generate the five difficulty scores FIRST based on the selected difficulty band. THEN build identity, backstory, and objections to FIT those scores. Never generate a character and then assign scores.

2. INTERNAL CONSISTENCY CHECK: Before roleplay begins, validate:
   ✓ Does financial reality match Ability to Proceed score?
   ✓ Does backstory urgency match Motivation Intensity score?
   ✓ Does authority archetype match Authority & Coachability score?
   ✓ Do pre-determined objections logically follow from the difficulty profile?
   ✓ Is speech pattern consistent with location and age?

3. SPECIFICITY OVER GENERALITY: Every field must be specific enough to be referenced during the call.
   Wrong: "Has financial constraints"
   Right: "Has £150 in savings, no income until February 26th payday, selling items on Vinted for grocery money"

4. GROUNDED IN TRANSCRIPT ARCHETYPES: Generated characters should feel like they belong alongside real transcript prospects (Tanmay, Hollie, Raj, Luke, Gary, Mrty, Julie, Jackie).

5. SPIKY DIFFICULTY PROFILES: Scores should be distributed realistically across dimensions — NOT uniformly. A "Realistic" prospect (total 32-40) might have high motivation but low ability, or moderate everything. Uniform scores (all 7s) feel artificial.

6. OFFER-APPROPRIATE CHARACTERS: The character must make sense for the offer type.
`;
