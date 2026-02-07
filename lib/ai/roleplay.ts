// AI Roleplay service using Anthropic Claude
// For real-time conversation with prospect personas

import Anthropic from '@anthropic-ai/sdk';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const anthropic = ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: ANTHROPIC_API_KEY })
  : null;

export interface RoleplayPersona {
  id: string;
  name: string;
  description: string;
  company: string;
  role: string;
  painPoints: string[];
  budget: string;
  timeline: string;
  objections: string[]; // Common objections this persona raises
  personality: string; // Friendly, skeptical, technical, etc.
}

export interface RoleplayMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface RoleplayResponse {
  message: string;
  metadata?: {
    objectionRaised?: boolean;
    objectionType?: string;
    interestLevel?: 'high' | 'medium' | 'low';
    nextStep?: string;
  };
}

// Predefined personas
export const ROLEPLAY_PERSONAS: RoleplayPersona[] = [
  {
    id: 'skeptical-cfo',
    name: 'Sarah Chen',
    description: 'CFO at a mid-size SaaS company, very budget-conscious and skeptical of new tools',
    company: 'TechFlow Solutions',
    role: 'CFO',
    painPoints: [
      'Worried about ROI and budget',
      'Seen too many tools fail to deliver',
      'Concerned about implementation time',
    ],
    budget: '$5,000-10,000/month',
    timeline: '3-6 months',
    objections: [
      'We already have a CRM',
      'This seems expensive',
      'How do we know it will work?',
      'What if our team doesn\'t adopt it?',
    ],
    personality: 'Skeptical, analytical, data-driven, asks tough questions',
  },
  {
    id: 'eager-sales-manager',
    name: 'Marcus Johnson',
    description: 'Sales Manager at a growing startup, eager to improve team performance',
    company: 'GrowthCo',
    role: 'Sales Manager',
    painPoints: [
      'Team performance is inconsistent',
      'Hard to identify coaching opportunities',
      'Reps aren\'t improving fast enough',
    ],
    budget: 'Flexible',
    timeline: 'ASAP',
    objections: [
      'How quickly can we see results?',
      'Will this integrate with our CRM?',
      'Can we customize it for our process?',
    ],
    personality: 'Enthusiastic, results-oriented, asks about features and ROI',
  },
  {
    id: 'technical-cto',
    name: 'Priya Patel',
    description: 'CTO at a tech company, focused on technical integration and security',
    company: 'DevStack Inc',
    role: 'CTO',
    painPoints: [
      'Security and compliance concerns',
      'Integration complexity',
      'Data privacy',
    ],
    budget: '$10,000-20,000/month',
    timeline: '2-4 months',
    objections: [
      'How secure is the data?',
      'What APIs do you have?',
      'Can we self-host?',
      'What about GDPR compliance?',
    ],
    personality: 'Technical, detail-oriented, asks about architecture and security',
  },
];

/**
 * Get persona by ID
 */
export function getPersona(personaId: string): RoleplayPersona | null {
  return ROLEPLAY_PERSONAS.find((p) => p.id === personaId) || null;
}

/**
 * Generate roleplay response from persona
 */
export async function generateRoleplayResponse(
  persona: RoleplayPersona,
  conversationHistory: RoleplayMessage[],
  repMessage: string
): Promise<RoleplayResponse> {
  if (!anthropic) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const systemPrompt = buildRoleplaySystemPrompt(persona);
  const messages = buildConversationMessages(conversationHistory, repMessage);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      temperature: 0.8, // Higher for more natural conversation
      system: systemPrompt,
      messages,
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response format');
    }

    // Parse response for metadata (objections, interest level, etc.)
    const metadata = extractMetadata(content.text, persona);

    return {
      message: content.text.trim(),
      metadata,
    };
  } catch (error: any) {
    console.error('Error generating roleplay response:', error);
    throw new Error(`Roleplay failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Build system prompt for roleplay persona
 */
function buildRoleplaySystemPrompt(persona: RoleplayPersona): string {
  return `You are ${persona.name}, ${persona.role} at ${persona.company}.

PERSONALITY: ${persona.personality}

YOUR SITUATION:
- Company: ${persona.company}
- Role: ${persona.role}
- Pain Points: ${persona.painPoints.join(', ')}
- Budget: ${persona.budget}
- Timeline: ${persona.timeline}

COMMON OBJECTIONS YOU MIGHT RAISE:
${persona.objections.map((o) => `- ${o}`).join('\n')}

INSTRUCTIONS:
1. Respond naturally as this persona would
2. Be authentic to their personality and concerns
3. Raise objections when appropriate (but not every time)
4. Show varying levels of interest based on how well the rep handles the conversation
5. Ask follow-up questions relevant to your role and pain points
6. Keep responses concise (1-3 sentences typically)
7. If the rep does well, show more interest. If they struggle, be more skeptical.

Remember: You're having a sales conversation. Be realistic but not overly difficult.`;
}

/**
 * Build conversation messages for Claude
 */
function buildConversationMessages(
  history: RoleplayMessage[],
  repMessage: string
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  // Add conversation history (limit to last 20 messages for context)
  const recentHistory = history.slice(-20);
  for (const msg of recentHistory) {
    // In roleplay, rep is 'user' and persona is 'assistant'
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    });
  }

  // Add current rep message
  messages.push({
    role: 'user',
    content: repMessage,
  });

  return messages;
}

/**
 * Extract metadata from persona response
 */
function extractMetadata(
  response: string,
  persona: RoleplayPersona
): RoleplayResponse['metadata'] {
  const metadata: RoleplayResponse['metadata'] = {};

  // Check for objections
  const lowerResponse = response.toLowerCase();
  for (const objection of persona.objections) {
    if (lowerResponse.includes(objection.toLowerCase().slice(0, 20))) {
      metadata.objectionRaised = true;
      metadata.objectionType = objection;
      break;
    }
  }

  // Detect interest level from keywords
  const interestKeywords = {
    high: ['interested', 'sounds good', 'tell me more', 'how does', 'when can'],
    low: ['not sure', 'concerned', 'worried', 'expensive', 'too much'],
  };

  for (const [level, keywords] of Object.entries(interestKeywords)) {
    if (keywords.some((kw) => lowerResponse.includes(kw))) {
      metadata.interestLevel = level as 'high' | 'low';
      break;
    }
  }

  if (!metadata.interestLevel) {
    metadata.interestLevel = 'medium';
  }

  return metadata;
}
