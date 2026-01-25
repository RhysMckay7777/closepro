// Layer 3: Funnel Context & Pre-Call State Intelligence

export type FunnelContextType = 
  | 'cold_outbound'
  | 'warm_inbound'
  | 'content_educated'
  | 'referral';

export interface FunnelContext {
  type: FunnelContextType;
  score: number; // 0-10
  description?: string;
  
  // Context Details
  source?: string; // 'cold_dm', 'webinar', 'youtube', 'referral', etc.
  contentExposure?: string[]; // What content they've consumed
  brandAwareness?: 'none' | 'low' | 'medium' | 'high';
  trustBaseline?: 'none' | 'low' | 'medium' | 'high';
}

/**
 * Map funnel context type to score range
 */
export function getFunnelContextScore(type: FunnelContextType): number {
  switch (type) {
    case 'cold_outbound':
      return Math.floor(Math.random() * 4); // 0-3
    case 'warm_inbound':
      return 4 + Math.floor(Math.random() * 3); // 4-6
    case 'content_educated':
      return 7 + Math.floor(Math.random() * 2); // 7-8
    case 'referral':
      return 9 + Math.floor(Math.random() * 2); // 9-10
    default:
      return 5;
  }
}

/**
 * Generate funnel context from type
 */
export function generateFunnelContext(type: FunnelContextType): FunnelContext {
  const score = getFunnelContextScore(type);

  const contexts: Record<FunnelContextType, Partial<FunnelContext>> = {
    cold_outbound: {
      description: 'Cold lead with minimal prior exposure',
      source: 'cold_dm',
      brandAwareness: 'none',
      trustBaseline: 'none',
    },
    warm_inbound: {
      description: 'Warm lead with some awareness',
      source: 'webinar',
      brandAwareness: 'low',
      trustBaseline: 'low',
    },
    content_educated: {
      description: 'Content-educated prospect with high awareness',
      source: 'youtube',
      brandAwareness: 'high',
      trustBaseline: 'medium',
    },
    referral: {
      description: 'Referred prospect with transferred trust',
      source: 'referral',
      brandAwareness: 'high',
      trustBaseline: 'high',
    },
  };

  return {
    type,
    score,
    ...contexts[type],
  } as FunnelContext;
}

/**
 * Extract funnel context from transcript signals
 */
export function extractFunnelContextFromTranscript(transcript: string): FunnelContext | null {
  const lowerTranscript = transcript.toLowerCase();

  // Check for referral signals
  if (
    lowerTranscript.includes('referred') ||
    lowerTranscript.includes('told me') ||
    lowerTranscript.includes('recommended')
  ) {
    return generateFunnelContext('referral');
  }

  // Check for content signals
  if (
    lowerTranscript.includes('video') ||
    lowerTranscript.includes('youtube') ||
    lowerTranscript.includes('podcast') ||
    lowerTranscript.includes('watched') ||
    lowerTranscript.includes('read your')
  ) {
    return generateFunnelContext('content_educated');
  }

  // Check for warm signals
  if (
    lowerTranscript.includes('webinar') ||
    lowerTranscript.includes('email') ||
    lowerTranscript.includes('signed up') ||
    lowerTranscript.includes('downloaded')
  ) {
    return generateFunnelContext('warm_inbound');
  }

  // Default to cold if no signals
  if (
    lowerTranscript.includes('why are you calling') ||
    lowerTranscript.includes('not sure why') ||
    lowerTranscript.includes('cold call')
  ) {
    return generateFunnelContext('cold_outbound');
  }

  // If unclear, default to warm
  return generateFunnelContext('warm_inbound');
}

/**
 * Get behavioural impact of funnel context
 */
export function getFunnelBehaviourImpact(context: FunnelContext): {
  startingTrust: number; // 0-10
  earlyResistance: 'high' | 'medium' | 'low';
  speedToDepth: 'slow' | 'normal' | 'fast';
  objectionType: 'concept' | 'trust' | 'fit' | 'logistics';
} {
  const { score, type } = context;

  if (score <= 3) {
    // Cold
    return {
      startingTrust: 2,
      earlyResistance: 'high',
      speedToDepth: 'slow',
      objectionType: 'concept',
    };
  } else if (score <= 6) {
    // Warm
    return {
      startingTrust: 5,
      earlyResistance: 'medium',
      speedToDepth: 'normal',
      objectionType: 'trust',
    };
  } else if (score <= 8) {
    // Content-educated
    return {
      startingTrust: 7,
      earlyResistance: 'low',
      speedToDepth: 'fast',
      objectionType: 'fit',
    };
  } else {
    // Referral
    return {
      startingTrust: 9,
      earlyResistance: 'low',
      speedToDepth: 'fast',
      objectionType: 'logistics',
    };
  }
}
