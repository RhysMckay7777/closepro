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
