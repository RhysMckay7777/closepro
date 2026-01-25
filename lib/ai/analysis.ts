// AI Analysis service using Anthropic Claude
// Alternative: Groq (faster, cheaper) or Together AI (flexible)

import Anthropic from '@anthropic-ai/sdk';
import Groq from 'groq-sdk';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const USE_GROQ = process.env.USE_GROQ === 'true' || !ANTHROPIC_API_KEY; // Default to Groq if no Anthropic key

// Initialize AI clients
const anthropic = ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: ANTHROPIC_API_KEY })
  : null;

const groq = GROQ_API_KEY
  ? new Groq({ apiKey: GROQ_API_KEY })
  : null;

export interface SkillScore {
  category: string;
  subSkills: Record<string, number>; // subSkill name -> score (0-100)
}

export interface PillarDetails {
  score: number; // 0-100
  strengths: string[];
  weaknesses: string[];
  breakdown: string; // Detailed explanation
}

export interface CoachingRecommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  issue: string;
  explanation: string;
  timestamp?: number; // milliseconds into call
  transcriptSegment?: string;
  action: string; // What to do differently
}

export interface TimestampedFeedback {
  timestamp: number; // milliseconds
  type: 'strength' | 'weakness' | 'opportunity' | 'warning';
  message: string;
  transcriptSegment: string;
  pillar?: 'value' | 'trust' | 'fit' | 'logistics';
}

export interface CallAnalysisResult {
  overallScore: number; // 0-100
  
  // 4 Pillars
  value: PillarDetails;
  trust: PillarDetails;
  fit: PillarDetails;
  logistics: PillarDetails;
  
  // Skill scores (10 categories, 40+ sub-skills)
  skillScores: SkillScore[];
  
  // Coaching recommendations
  coachingRecommendations: CoachingRecommendation[];
  
  // Timestamped feedback
  timestampedFeedback: TimestampedFeedback[];
}

/**
 * Analyze sales call transcript using Claude
 */
export async function analyzeCall(
  transcript: string,
  transcriptJson: { utterances: Array<{ speaker: string; start: number; end: number; text: string }> }
): Promise<CallAnalysisResult> {
  // Build structured prompt
  const prompt = buildAnalysisPrompt(transcript, transcriptJson);
  const systemPrompt = `You are an expert sales coach analyzing sales calls. You evaluate calls across 4 pillars (Value, Trust, Fit, Logistics) and 10 skill categories with 40+ sub-skills. Provide structured, actionable feedback. Always return valid JSON.`;

  // Try Groq first (cheaper, faster) if enabled, otherwise try Anthropic
  if (USE_GROQ && groq) {
    try {
      const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile', // Fast and capable model
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 8000,
        response_format: { type: 'json_object' }, // Force JSON output
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from Groq');
      }

      // Parse JSON response (Groq returns clean JSON when response_format is json_object)
      let jsonText = content.trim();
      // Remove markdown code blocks if present
      jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      const analysis = JSON.parse(jsonText) as CallAnalysisResult;
      return normalizeAnalysis(analysis);
    } catch (error: any) {
      console.error('Groq analysis error:', error);
      // Fall through to try Anthropic if available
      if (!anthropic) {
        throw new Error(`Analysis failed: ${error.message || 'Unknown error'}`);
      }
    }
  }

  // Try Anthropic Claude if available
  if (anthropic) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 8000,
        temperature: 0.3,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response format from Claude');
      }

      // Extract JSON from response
      const text = content.text;
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
      
      const analysis = JSON.parse(jsonText) as CallAnalysisResult;
      return normalizeAnalysis(analysis);
    } catch (error: any) {
      console.error('Anthropic analysis error:', error);
      throw new Error(`Analysis failed: ${error.message || 'Unknown error'}`);
    }
  }

  throw new Error('No AI service configured. Please set GROQ_API_KEY or ANTHROPIC_API_KEY');
}

/**
 * Build analysis prompt for Claude
 */
function buildAnalysisPrompt(
  transcript: string,
  transcriptJson: { utterances: Array<{ speaker: string; start: number; end: number; text: string }> }
): string {
  return `Analyze this sales call transcript and provide a comprehensive evaluation.

TRANSCRIPT:
${transcript.length > 6000 ? transcript.substring(0, 6000) + '\n... (truncated for faster analysis)' : transcript}

SPEAKER TIMESTAMPS (sample):
${JSON.stringify(transcriptJson.utterances.slice(0, 30), null, 2)}${transcriptJson.utterances.length > 30 ? `\n... (${transcriptJson.utterances.length - 30} more utterances)` : ''}

EVALUATION FRAMEWORK:

1. FOUR PILLARS (each scored 0-100):
   - VALUE: Did the rep effectively communicate value proposition?
   - TRUST: Did the rep build trust and rapport?
   - FIT: Did the rep identify if the prospect is a good fit?
   - LOGISTICS: Did the rep handle logistics, next steps, and closing?

2. SKILL CATEGORIES (10 categories, 40+ sub-skills):
   - Opening & Rapport Building
   - Discovery & Questioning
   - Value Communication
   - Objection Handling
   - Closing Techniques
   - Active Listening
   - Tone & Energy
   - Pacing & Flow
   - Follow-up & Next Steps
   - Professionalism

3. COACHING RECOMMENDATIONS:
   - Priority (high/medium/low)
   - Specific issue identified
   - Explanation of why it matters
   - Actionable guidance
   - Timestamp if applicable

4. TIMESTAMPED FEEDBACK:
   - Specific moments in the call (with timestamps)
   - Type: strength, weakness, opportunity, warning
   - Relevant transcript segment

Return your analysis as JSON in this exact format:
{
  "overallScore": 75,
  "value": {
    "score": 80,
    "strengths": ["..."],
    "weaknesses": ["..."],
    "breakdown": "..."
  },
  "trust": { ... },
  "fit": { ... },
  "logistics": { ... },
  "skillScores": [
    {
      "category": "Opening & Rapport Building",
      "subSkills": {
        "Warm greeting": 85,
        "Personal connection": 70,
        ...
      }
    },
    ...
  ],
  "coachingRecommendations": [
    {
      "priority": "high",
      "category": "Objection Handling",
      "issue": "...",
      "explanation": "...",
      "timestamp": 120000,
      "transcriptSegment": "...",
      "action": "..."
    },
    ...
  ],
  "timestampedFeedback": [
    {
      "timestamp": 45000,
      "type": "strength",
      "message": "...",
      "transcriptSegment": "...",
      "pillar": "trust"
    },
    ...
  ]
}`;
}

/**
 * Normalize and validate analysis results
 */
function normalizeAnalysis(analysis: any): CallAnalysisResult {
  // Ensure all scores are 0-100
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

  return {
    overallScore: clamp(analysis.overallScore || 0),
    value: normalizePillar(analysis.value),
    trust: normalizePillar(analysis.trust),
    fit: normalizePillar(analysis.fit),
    logistics: normalizePillar(analysis.logistics),
    skillScores: Array.isArray(analysis.skillScores) ? analysis.skillScores : [],
    coachingRecommendations: Array.isArray(analysis.coachingRecommendations) 
      ? analysis.coachingRecommendations 
      : [],
    timestampedFeedback: Array.isArray(analysis.timestampedFeedback)
      ? analysis.timestampedFeedback
      : [],
  };
}

function normalizePillar(pillar: any): PillarDetails {
  return {
    score: Math.max(0, Math.min(100, Math.round(pillar?.score || 0))),
    strengths: Array.isArray(pillar?.strengths) ? pillar.strengths : [],
    weaknesses: Array.isArray(pillar?.weaknesses) ? pillar.weaknesses : [],
    breakdown: pillar?.breakdown || '',
  };
}
