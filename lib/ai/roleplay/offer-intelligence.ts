// Layer 1: Offer Intelligence
// Defines what is being sold and how it should be positioned

export type OfferCategory = 
  | 'b2c_health'
  | 'b2c_wealth'
  | 'b2c_relationships'
  | 'b2b_services'
  | 'mixed_wealth';

export type DeliveryModel = 'dfy' | 'dwy' | 'diy' | 'hybrid';

export type EffortRequired = 'low' | 'medium' | 'high';

export type RiskReversal = 'refund' | 'guarantee' | 'conditional' | 'none';

export interface OfferProfile {
  // Classification
  offerCategory: OfferCategory;
  
  // Headline
  whoItsFor: string; // ICP definition
  coreOutcome: string; // Transformation/result
  mechanismHighLevel: string; // How it works
  
  // Delivery
  deliveryModel: DeliveryModel;
  supportChannels?: string[];
  touchpointsFrequency?: string;
  implementationResponsibility?: 'prospect_heavy' | 'provider_heavy' | 'balanced';
  
  // Cost Profile
  priceRange: string; // e.g., "5000-25000"
  paymentOptions?: {
    payInFull?: boolean;
    paymentPlans?: Array<{ installments: number; interval: string }>;
  };
  timeToResult?: string;
  effortRequired?: EffortRequired;
  
  // Problem Set
  primaryProblemsSolved: string[];
  emotionalDrivers?: {
    pain?: string[];
    ambition?: string[];
  };
  logicalDrivers?: string[];
  
  // Proof & Risk
  proofAssetsAvailable?: {
    caseStudies?: number;
    testimonials?: number;
    numbers?: string[];
    credentials?: string[];
  };
  proofRelevanceNotes?: string;
  riskReversal?: RiskReversal;
  commonSkepticismTriggers?: string[];
  
  // Fit Rules
  mustHaveConditions?: string[];
  disqualifiers?: string[];
  softDisqualifiers?: string[];
  bestFitNotes?: string;
}

/**
 * Generate internal offer summary for AI consumption
 */
export function generateOfferSummary(offer: OfferProfile): string {
  const categoryLabels: Record<OfferCategory, string> = {
    b2c_health: 'B2C Health Transformation',
    b2c_wealth: 'B2C Wealth Building',
    b2c_relationships: 'B2C Relationships',
    b2b_services: 'B2B Services/Agencies',
    mixed_wealth: 'Mixed Wealth (B2C/B2B Bridge)',
  };

  const deliveryLabels: Record<DeliveryModel, string> = {
    dfy: 'Done-For-You',
    dwy: 'Done-With-You',
    diy: 'Do-It-Yourself',
    hybrid: 'Hybrid Model',
  };

  return `OFFER PROFILE:
Category: ${categoryLabels[offer.offerCategory]}
Target: ${offer.whoItsFor}
Outcome: ${offer.coreOutcome}
Mechanism: ${offer.mechanismHighLevel}
Delivery: ${deliveryLabels[offer.deliveryModel]}
Price: ${offer.priceRange}
Effort: ${offer.effortRequired || 'Not specified'}

Problems Solved:
${offer.primaryProblemsSolved.map(p => `- ${p}`).join('\n')}

${offer.emotionalDrivers?.pain?.length ? `Pain Drivers:\n${offer.emotionalDrivers.pain.map(p => `- ${p}`).join('\n')}\n` : ''}
${offer.emotionalDrivers?.ambition?.length ? `Ambition Drivers:\n${offer.emotionalDrivers.ambition.map(a => `- ${a}`).join('\n')}\n` : ''}
${offer.logicalDrivers?.length ? `Logical Drivers:\n${offer.logicalDrivers.map(l => `- ${l}`).join('\n')}\n` : ''}

Risk Profile: ${offer.riskReversal || 'Not specified'}
Best Fit: ${offer.bestFitNotes || 'Not specified'}`;
}

/**
 * Determine default sales style based on offer category
 */
export function getDefaultSalesStyle(offer: OfferProfile): {
  tone: 'emotional' | 'logical' | 'hybrid';
  emphasis: string[];
} {
  switch (offer.offerCategory) {
    case 'b2c_health':
    case 'b2c_relationships':
      return {
        tone: 'emotional',
        emphasis: ['transformation', 'identity', 'feelings', 'life change'],
      };
    
    case 'b2b_services':
      return {
        tone: 'logical',
        emphasis: ['ROI', 'process', 'implementation', 'metrics'],
      };
    
    case 'b2c_wealth':
    case 'mixed_wealth':
      return {
        tone: 'hybrid',
        emphasis: ['freedom', 'earnings path', 'practical steps', 'identity + logic'],
      };
    
    default:
      return {
        tone: 'hybrid',
        emphasis: ['value', 'transformation'],
      };
  }
}

/**
 * Validate offer profile completeness
 */
export function validateOfferProfile(offer: Partial<OfferProfile>): {
  valid: boolean;
  missing: string[];
} {
  const required: (keyof OfferProfile)[] = [
    'offerCategory',
    'whoItsFor',
    'coreOutcome',
    'mechanismHighLevel',
    'deliveryModel',
    'priceRange',
    'primaryProblemsSolved',
  ];

  const missing: string[] = [];

  for (const field of required) {
    if (!offer[field]) {
      missing.push(field);
    }
  }

  // Check primaryProblemsSolved has at least 3
  if (offer.primaryProblemsSolved && offer.primaryProblemsSolved.length < 3) {
    missing.push('primaryProblemsSolved (needs at least 3)');
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Generic Offer Templates
 * Pre-filled templates for common offer categories
 */
export interface OfferTemplate {
  name: string;
  offerCategory: OfferCategory;
  whoItsFor: string;
  coreOutcome: string;
  mechanismHighLevel: string;
  deliveryModel: DeliveryModel;
  priceRange: string;
  primaryProblemsSolved: string[];
  emotionalDrivers?: {
    pain?: string[];
    ambition?: string[];
  };
  logicalDrivers?: string[];
  commonSkepticismTriggers?: string[];
  effortRequired?: EffortRequired;
  timeToResult?: string;
  riskReversal?: RiskReversal;
  bestFitNotes?: string;
}

export const OFFER_TEMPLATES: Record<string, OfferTemplate> = {
  'b2c_health': {
    name: 'B2C Health (Weight Loss / Fitness)',
    offerCategory: 'b2c_health',
    whoItsFor: 'Men and women 30-55 who have struggled with weight loss, lack energy, and want to feel confident in their bodies again',
    coreOutcome: 'Sustainable weight loss and improved health with lasting lifestyle changes',
    mechanismHighLevel: 'Personalized nutrition plans, structured workout programs, accountability coaching, and habit transformation system',
    deliveryModel: 'dwy',
    priceRange: '3000-12000',
    primaryProblemsSolved: [
      'Failed multiple diets and weight loss attempts',
      'Lack of time and energy for consistent exercise',
      'Emotional eating and poor relationship with food',
      'Low self-confidence and body image issues',
      'No accountability or support system'
    ],
    emotionalDrivers: {
      pain: [
        'Feeling ashamed of current body',
        'Avoiding social situations due to weight',
        'Health concerns and doctor warnings',
        'Lack of energy affecting daily life'
      ],
      ambition: [
        'Want to feel confident and attractive',
        'Desire to be a role model for family',
        'Want to live longer and healthier',
        'Dream of fitting into old clothes'
      ]
    },
    logicalDrivers: [
      'Proven system with measurable results',
      'Structured program with clear milestones',
      'Professional guidance and support'
    ],
    commonSkepticismTriggers: [
      'Tried everything before, nothing worked',
      'Too busy to commit to another program',
      'Skeptical of quick fixes and fad diets',
      'Worried about cost vs. results'
    ],
    effortRequired: 'medium',
    timeToResult: '12-16 weeks for initial transformation',
    riskReversal: 'guarantee',
    bestFitNotes: 'Best for people who are ready to commit to change, have tried other methods, and need structured support'
  },
  'b2c_relationships': {
    name: 'B2C Relationships',
    offerCategory: 'b2c_relationships',
    whoItsFor: 'Single men and women 25-45 who struggle with dating, want to find a meaningful relationship, or improve their current partnership',
    coreOutcome: 'Find and maintain healthy, fulfilling romantic relationships with confidence and authenticity',
    mechanismHighLevel: 'Dating strategy coaching, communication skills training, confidence building, and relationship frameworks',
    deliveryModel: 'dwy',
    priceRange: '2000-8000',
    primaryProblemsSolved: [
      'Struggling to attract quality partners',
      'Repeated patterns of failed relationships',
      'Lack of confidence in dating situations',
      'Poor communication and conflict resolution',
      'Unclear about what they want in a partner'
    ],
    emotionalDrivers: {
      pain: [
        'Loneliness and fear of being alone',
        'Feeling unlovable or not good enough',
        'Past relationship trauma and trust issues',
        'Social pressure from family and friends'
      ],
      ambition: [
        'Want to find their life partner',
        'Desire for deep connection and intimacy',
        'Want to build a family',
        'Dream of being in a healthy relationship'
      ]
    },
    logicalDrivers: [
      'Proven dating and relationship strategies',
      'Clear framework for understanding compatibility',
      'Practical communication tools'
    ],
    commonSkepticismTriggers: [
      'Dating coaches are scams',
      'Relationships should happen naturally',
      'Too old or too set in ways to change',
      'Worried about appearing desperate'
    ],
    effortRequired: 'medium',
    timeToResult: '3-6 months to see significant improvement',
    riskReversal: 'conditional',
    bestFitNotes: 'Best for people who are genuinely ready to work on themselves and committed to finding a relationship'
  },
  'b2c_wealth': {
    name: 'B2C Wealth (Career / Income)',
    offerCategory: 'b2c_wealth',
    whoItsFor: 'Aspiring entrepreneurs and career professionals 25-45 who want to increase their income, start a business, or escape the 9-to-5',
    coreOutcome: 'Build a profitable business or high-income career that provides financial freedom and lifestyle flexibility',
    mechanismHighLevel: 'Business strategy, sales training, marketing systems, and mentorship to build income-generating skills',
    deliveryModel: 'dwy',
    priceRange: '5000-25000',
    primaryProblemsSolved: [
      'Stuck in low-paying job with no growth',
      'Want to start business but don\'t know how',
      'Lack sales and marketing skills',
      'No clear path to financial freedom',
      'Fear of leaving stable income'
    ],
    emotionalDrivers: {
      pain: [
        'Financial stress and living paycheck to paycheck',
        'Feeling trapped in unfulfilling work',
        'Watching others succeed while stuck',
        'Fear of never achieving financial goals'
      ],
      ambition: [
        'Want financial freedom and independence',
        'Desire to build something meaningful',
        'Want to provide better for family',
        'Dream of location independence and flexibility'
      ]
    },
    logicalDrivers: [
      'Proven business models and strategies',
      'Step-by-step system for building income',
      'Real case studies and success stories',
      'ROI-focused approach'
    ],
    commonSkepticismTriggers: [
      'Too good to be true',
      'Worried about losing money on another course',
      'Don\'t have time while working full-time',
      'Skeptical of online business opportunities'
    ],
    effortRequired: 'high',
    timeToResult: '6-12 months to build sustainable income',
    riskReversal: 'conditional',
    bestFitNotes: 'Best for people who are coachable, willing to take action, and serious about changing their financial situation'
  },
  'b2b_wealth': {
    name: 'B2B Wealth (Agency / Consulting / DFY)',
    offerCategory: 'b2b_services',
    whoItsFor: 'Current business owners and agency operators who are stuck at a revenue plateau, want to scale, or need help with client acquisition',
    coreOutcome: 'Scale business revenue, improve client acquisition, and build systems for sustainable growth',
    mechanismHighLevel: 'Done-for-you services, agency partnerships, consulting frameworks, and proven client acquisition systems',
    deliveryModel: 'dfy',
    priceRange: '10000-100000',
    primaryProblemsSolved: [
      'Revenue plateau and can\'t break through',
      'Struggling to acquire new clients consistently',
      'Lack systems and processes for scaling',
      'Wearing too many hats and burning out',
      'Need expertise in areas outside core competency'
    ],
    emotionalDrivers: {
      pain: [
        'Working long hours with no growth',
        'Feeling stuck and frustrated',
        'Competition increasing while revenue stagnates',
        'Team and family depending on business success'
      ],
      ambition: [
        'Want to scale to 7-8 figures',
        'Desire to build a sellable business',
        'Want to work less and earn more',
        'Dream of building a legacy business'
      ]
    },
    logicalDrivers: [
      'Proven systems and frameworks',
      'Measurable ROI and results',
      'Access to expertise and resources',
      'Scalable business model'
    ],
    commonSkepticismTriggers: [
      'High investment, need to see ROI',
      'Worried about losing control of business',
      'Skeptical of agency/consulting promises',
      'Previous bad experiences with consultants'
    ],
    effortRequired: 'low',
    timeToResult: '3-6 months to see significant revenue impact',
    riskReversal: 'conditional',
    bestFitNotes: 'Best for established businesses with existing revenue who are ready to invest in growth and have clear goals'
  },
  'mixed_wealth': {
    name: 'Mixed Wealth (Aspiring + Current Business Owners)',
    offerCategory: 'mixed_wealth',
    whoItsFor: 'Both aspiring entrepreneurs starting from zero and current business owners who want to scale, learn high-ticket sales, or build a closing business',
    coreOutcome: 'Build a high-ticket closing business or agency that generates consistent 5-6 figure monthly revenue',
    mechanismHighLevel: 'High-ticket sales training, closing frameworks, client acquisition systems, and mentorship for building a closing business',
    deliveryModel: 'dwy',
    priceRange: '5000-20000',
    primaryProblemsSolved: [
      'Want to become a high-ticket closer but lack skills',
      'Current business needs better sales and closing',
      'Want to add closing services to existing business',
      'Need proven frameworks for high-ticket sales',
      'Struggling to close deals consistently'
    ],
    emotionalDrivers: {
      pain: [
        'Leaving money on the table with poor closing',
        'Fear of high-ticket sales conversations',
        'Watching others succeed while struggling',
        'Financial pressure to increase income'
      ],
      ambition: [
        'Want to become a skilled closer',
        'Desire to build a closing business',
        'Want to earn 6-figures from closing',
        'Dream of being the go-to closer in their niche'
      ]
    },
    logicalDrivers: [
      'Proven closing frameworks and scripts',
      'Real-world roleplay and practice',
      'Case studies and success stories',
      'Clear path to building closing business'
    ],
    commonSkepticismTriggers: [
      'Worried about ability to learn closing',
      'Skeptical of sales training programs',
      'Don\'t have clients to practice with',
      'High investment for uncertain results'
    ],
    effortRequired: 'high',
    timeToResult: '3-6 months to become proficient, 6-12 months to build business',
    riskReversal: 'conditional',
    bestFitNotes: 'Best for people who are coachable, willing to practice, and serious about building a career or business in high-ticket sales'
  }
};

/**
 * Get all available offer templates
 */
export function getOfferTemplates(): OfferTemplate[] {
  return Object.values(OFFER_TEMPLATES);
}

/**
 * Get a specific template by key
 */
export function getOfferTemplate(key: string): OfferTemplate | undefined {
  return OFFER_TEMPLATES[key];
}
