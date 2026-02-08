// AI Analysis service using Anthropic Claude
// Alternative: Groq (faster, cheaper) or Together AI (flexible)

import Anthropic from '@anthropic-ai/sdk';
import Groq from 'groq-sdk';
import { SALES_CATEGORIES, type SalesCategoryId } from './scoring-framework';
import { getCondensedExamples } from './knowledge/real-call-examples';

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

/** 10-category score (each 0-10). Keys are SalesCategoryId. */
export type CategoryScores = Partial<Record<SalesCategoryId, number>>;

/** Single objection with pillar classification (Value, Trust, Fit, Logistics). */
export interface ObjectionEntry {
  objection: string;
  pillar: 'value' | 'trust' | 'fit' | 'logistics';
  handling?: string;
  howRepHandled?: string;
}

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

export interface ProspectDifficultyAssessment {
  // Prospect difficulty dimensions (50-point model)
  positionProblemAlignment?: number; // 0-10
  painAmbitionIntensity?: number; // 0-10
  perceivedNeedForHelp?: number; // 0-10
  authorityLevel?: 'advisee' | 'peer' | 'advisor';
  funnelContext?: number; // 0-10
  executionResistance?: number; // 0-10 (ability to proceed)
  totalDifficultyScore?: number; // 0-50
  difficultyTier?: 'easy' | 'realistic' | 'hard' | 'elite' | 'near_impossible';
}

/** AI-suggested outcome for sales figures (when addToFigures is true) */
export interface CallOutcomeSuggestion {
  result?: 'no_show' | 'closed' | 'lost' | 'unqualified' | 'deposit';
  qualified?: boolean;
  cashCollected?: number; // cents
  revenueGenerated?: number; // cents
  reasonForOutcome?: string;
}

export interface CallAnalysisResult {
  overallScore: number; // 0-100

  /** 10 category scores (each 0-10). Primary scoring per Sales Call Scoring Framework. */
  categoryScores: CategoryScores;

  /** Objections with pillar classification only (not primary scores). */
  objections: ObjectionEntry[];

  /** Legacy: skill scores as array for backward compat; derived from categoryScores when persisting. */
  skillScores: SkillScore[];

  // Coaching recommendations
  coachingRecommendations: CoachingRecommendation[];

  // Timestamped feedback
  timestampedFeedback: TimestampedFeedback[];

  // Prospect difficulty assessment (for call list and reporting)
  prospectDifficulty?: ProspectDifficultyAssessment;

  // Optional outcome suggestion for sales figures (when analysisIntent is update_figures)
  outcome?: CallOutcomeSuggestion;

  // Completion tracking (for roleplay)
  stagesCompleted?: {
    opening: boolean;
    discovery: boolean;
    offer: boolean;
    objections: boolean;
    close: boolean;
  };
  isIncomplete?: boolean;

  // Enhanced feedback (for roleplay results)
  categoryFeedback?: CategoryFeedback[];
  priorityFixes?: PriorityFix[];
  objectionAnalysis?: ObjectionAnalysis[];
}

/** Per-category feedback for results display */
export interface CategoryFeedback {
  category: string;
  categoryId: string;
  score: number;
  whatWasDoneWell: string;
  whatWasMissing: string;
  whatToImproveNextTime: string;
}

/** Priority fix item for actionable improvements */
export interface PriorityFix {
  priority: number; // 1-5
  category: string;
  whatWentWrong: string;
  whyItMattered: string;
  whatToDoDifferently: string;
  messageIndex?: number;
  transcriptSegment?: string;
}

/** Detailed objection analysis */
export interface ObjectionAnalysis {
  objection: string;
  pillar: 'value' | 'trust' | 'fit' | 'logistics';
  messageIndex?: number;
  howRepHandled: string;
  wasHandledWell: boolean;
  howCouldBeHandledBetter: string;
}

/**
 * Analyze sales call transcript using Claude
 */
export async function analyzeCall(
  transcript: string,
  transcriptJson: { utterances: Array<{ speaker: string; start: number; end: number; text: string }> },
  offerCategory?: 'b2c_health' | 'b2c_relationships' | 'b2c_wealth' | 'mixed_wealth' | 'b2b_services',
  customerStage?: 'aspiring' | 'current' | 'mixed'
): Promise<CallAnalysisResult> {
  // Build structured prompt with category context
  const prompt = buildAnalysisPrompt(transcript, transcriptJson, offerCategory, customerStage);
  const systemPrompt = `You are an expert sales coach analyzing sales calls. You evaluate calls using the Sales Call Scoring Framework: one overall score (0-100) and 10 category scores (each 0-10). Objections are classified by pillar (Value, Trust, Fit, Logistics) only. Provide structured, actionable feedback. Always return valid JSON.`;

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
      return normalizeAnalysis(analysis, offerCategory, customerStage);
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
        model: 'claude-sonnet-4-20250514',
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
      return normalizeAnalysis(analysis, offerCategory, customerStage);
    } catch (error: any) {
      console.error('Anthropic analysis error:', error);
      const msg = error?.message ?? '';
      const isCreditError = /credit|balance|too low|invalid_request|payment|upgrade/i.test(msg) || error?.status === 400;
      // If Anthropic failed due to credits, try Groq as free-tier alternative
      if (isCreditError && groq) {
        try {
          const response = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 8000,
            response_format: { type: 'json_object' },
          });
          const content = response.choices[0]?.message?.content;
          if (!content) throw new Error('No response from Groq');
          let jsonText = content.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
          const analysis = JSON.parse(jsonText) as CallAnalysisResult;
          console.info('Call analysis completed via Groq (Anthropic credits low or unavailable).');
          return normalizeAnalysis(analysis, offerCategory, customerStage);
        } catch (groqError: any) {
          console.error('Groq fallback error:', groqError);
        }
      }
      throw new Error(`Analysis failed: ${msg || 'Unknown error'}`);
    }
  }

  throw new Error('No AI service configured. Please set GROQ_API_KEY or ANTHROPIC_API_KEY');
}

/**
 * Build analysis prompt for Claude
 */
function buildAnalysisPrompt(
  transcript: string,
  transcriptJson: { utterances: Array<{ speaker: string; start: number; end: number; text: string }> },
  offerCategory?: 'b2c_health' | 'b2c_relationships' | 'b2c_wealth' | 'mixed_wealth' | 'b2b_services',
  customerStage?: 'aspiring' | 'current' | 'mixed'
): string {
  // Import category rules
  const { getCategoryBehaviorRules } = require('./roleplay/offer-intelligence');
  const categoryContext = offerCategory ? getCategoryBehaviorRules(offerCategory, customerStage) : null;

  const categoryGuidance = categoryContext ? `
OFFER CATEGORY CONTEXT:
Category: ${offerCategory}
Sales Approach: ${categoryContext.tone} (${categoryContext.emphasis.join(', ')})
Scoring Weights: Value ${categoryContext.scoringExpectations.valueScoreWeight}, Trust ${categoryContext.scoringExpectations.trustScoreWeight}, Fit ${categoryContext.scoringExpectations.fitScoreWeight}, Logistics ${categoryContext.scoringExpectations.logisticsScoreWeight}
Expected Baseline Score: ${categoryContext.difficultyInterpretation.baselineExpectation} for "realistic" difficulty
Objection Patterns: ${categoryContext.objectionInterpretation.commonPatterns.join(', ')}
Insight Focus: ${categoryContext.insightFocus.join(', ')}

When scoring, adjust expectations based on category:
- Weight pillars according to category importance
- Interpret objections through category lens
- Generate insights that emphasize category-specific factors
- Consider baseline expectations when evaluating performance
` : '';

  // Real call examples for scoring calibration
  const realExamples = getCondensedExamples(3);
  const realExamplesSection = realExamples ? `
REAL CALL REFERENCE EXAMPLES:
The following are extracted from real high-ticket sales calls.
Use these to calibrate your scoring — understand what good and bad performance looks like in practice.

${realExamples}
` : '';

  return `Analyze this sales call transcript and provide a comprehensive evaluation.
${categoryGuidance}
${realExamplesSection}
TRANSCRIPT:
${transcript.length > 6000 ? transcript.substring(0, 6000) + '\n... (truncated for faster analysis)' : transcript}

SPEAKER TIMESTAMPS (sample):
${JSON.stringify(transcriptJson.utterances.slice(0, 30), null, 2)}${transcriptJson.utterances.length > 30 ? `\n... (${transcriptJson.utterances.length - 30} more utterances)` : ''}

EVALUATION FRAMEWORK (Sales Call Scoring – 10 Category Framework):

1. OVERALL SCORE (0-100) and 10 CATEGORY SCORES (each 0-10). Use these exact category IDs:
   - authority_leadership: Authority & Leadership
   - structure_framework: Structure & Framework
   - communication_storytelling: Communication & Storytelling
   - discovery_diagnosis: Discovery Depth & Diagnosis
   - gap_urgency: Gap & Urgency
   - value_offer_positioning: Value & Offer Positioning
   - trust_safety_ethics: Trust, Safety & Ethics
   - adaptation_calibration: Adaptation & Calibration
   - objection_handling: Objection Handling & Preemption
   - closing_commitment: Closing & Commitment Integrity

2. OBJECTIONS (pillar classification only). For each objection raised: classify as value | trust | fit | logistics; note how rep handled it.

3. PROSPECT DIFFICULTY ASSESSMENT (50-point model):
   Analyze the PROSPECT's difficulty to contextualize the rep's performance:
   - positionProblemAlignment (0-10): How well prospect's position/problems align with offer
   - painAmbitionIntensity (0-10): Strength of pain or ambition
   - perceivedNeedForHelp (0-10): How much they believe they need help
   - authorityLevel: "advisee" | "peer" | "advisor"
   - funnelContext (0-10): How warm/cold (0-3 cold, 4-6 warm, 7-8 educated, 9-10 referral)
   - executionResistance (0-10): Ability to proceed (8-10 fully able, 5-7 partial, 1-4 extreme)
   - totalDifficultyScore (0-50): Sum of all dimensions
   - difficultyTier: "easy" | "realistic" | "hard" | "elite" | "near_impossible"
   
   IMPORTANT: Execution resistance must be reported separately. It increases difficulty but does not excuse poor sales skill. Flag structural blockers clearly.

4. COACHING RECOMMENDATIONS:
   - Priority (high/medium/low)
   - Specific issue identified
   - Explanation of why it matters
   - Actionable guidance
   - Timestamp if applicable
   - Note: Separate skill issues from lead quality/execution resistance issues

5. TIMESTAMPED FEEDBACK:
   - Specific moments in the call (with timestamps)
   - Type: strength, weakness, opportunity, warning
   - Relevant transcript segment

6. OUTCOME (for sales figures – important):
   Infer from the transcript whether an agreement was reached and what money was involved.
   - result: "closed" if they bought/committed, "deposit" if only deposit taken, "lost" / "unqualified" / "no_show" otherwise.
   - qualified: true if prospect was a fit and moved forward (or closed), false otherwise.
   - cashCollected: amount actually collected on this call IN CENTS (e.g. $50 → 5000, $1,200 → 120000). If the transcript mentions a payment, deposit, or "they paid", extract the number and convert to cents. If no amount is mentioned but they closed, use 0 or a reasonable estimate from context.
   - revenueGenerated: total value of the deal IN CENTS (e.g. full program price, including payment plans). If the transcript states the deal size or program price, use that in cents. If only a deposit is mentioned, revenueGenerated can equal cashCollected or the stated total.
   - reasonForOutcome: one sentence on why this outcome (e.g. "Prospect agreed to $X program; paid deposit $Y.").
   Always include the "outcome" object. When result is "closed" or "deposit" you MUST set cashCollected and/or revenueGenerated in CENTS from numbers mentioned in the transcript (e.g. "$500" → 50000, "£200" → 20000). Use 0 only when no amount is stated anywhere.

Return your analysis as JSON in this exact format:
{
  "overallScore": 75,
  "categoryScores": {
    "authority_leadership": 7,
    "structure_framework": 8,
    "communication_storytelling": 7,
    "discovery_diagnosis": 6,
    "gap_urgency": 7,
    "value_offer_positioning": 8,
    "trust_safety_ethics": 7,
    "adaptation_calibration": 6,
    "objection_handling": 7,
    "closing_commitment": 8
  },
  "objections": [
    { "objection": "I need to think about it", "pillar": "trust", "handling": "Rep acknowledged and asked what specifically to think about." }
  ],
  "coachingRecommendations": [
    {
      "priority": "high",
      "category": "objection_handling",
      "issue": "...",
      "explanation": "...",
      "timestamp": 120000,
      "transcriptSegment": "...",
      "action": "..."
    }
  ],
  "timestampedFeedback": [
    {
      "timestamp": 45000,
      "type": "strength",
      "message": "...",
      "transcriptSegment": "...",
      "pillar": "trust"
    }
  ],
  "prospectDifficulty": {
    "positionProblemAlignment": 7,
    "painAmbitionIntensity": 6,
    "perceivedNeedForHelp": 5,
    "authorityLevel": "peer",
    "funnelContext": 5,
    "executionResistance": 4,
    "totalDifficultyScore": 27,
    "difficultyTier": "elite"
  },
  "outcome": {
    "result": "closed",
    "qualified": true,
    "cashCollected": 5000,
    "revenueGenerated": 10000,
    "reasonForOutcome": "Prospect agreed to purchase; deposit taken."
  }
}`;
}

/**
 * Normalize and validate analysis results
 */
function normalizeAnalysis(analysis: any, _offerCategory?: 'b2c_health' | 'b2c_relationships' | 'b2c_wealth' | 'mixed_wealth' | 'b2b_services', _customerStage?: 'aspiring' | 'current' | 'mixed'): CallAnalysisResult {
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

  // 10-category scores (each 0-10)
  const clamp10 = (n: number) => Math.max(0, Math.min(10, Math.round(n)));
  const categoryScores: CategoryScores = {};
  const rawCategoryScores = analysis.categoryScores && typeof analysis.categoryScores === 'object' ? analysis.categoryScores : {};
  for (const { id } of SALES_CATEGORIES) {
    const v = rawCategoryScores[id];
    if (typeof v === 'number') categoryScores[id as SalesCategoryId] = clamp10(v);
  }
  if (Object.keys(categoryScores).length === 0 && Array.isArray(analysis.skillScores) && analysis.skillScores.length > 0) {
    const nameToId: Record<string, SalesCategoryId> = {
      'Authority & Leadership': 'authority_leadership',
      'Structure & Framework': 'structure_framework',
      'Communication & Storytelling': 'communication_storytelling',
      'Discovery Depth & Diagnosis': 'discovery_diagnosis',
      'Gap & Urgency': 'gap_urgency',
      'Value & Offer Positioning': 'value_offer_positioning',
      'Trust, Safety & Ethics': 'trust_safety_ethics',
      'Adaptation & Calibration': 'adaptation_calibration',
      'Objection Handling & Preemption': 'objection_handling',
      'Closing & Commitment Integrity': 'closing_commitment',
    };
    for (const s of analysis.skillScores.slice(0, 10)) {
      const id = nameToId[s.category];
      if (id) {
        const score = typeof s.subSkills === 'object' ? (Object.values(s.subSkills) as number[]).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0) / Math.max(1, Object.keys(s.subSkills).length) : 0;
        categoryScores[id] = clamp10(score);
      }
    }
  }

  // Objections (pillar classification only)
  const objections: ObjectionEntry[] = [];
  if (Array.isArray(analysis.objections)) {
    for (const o of analysis.objections) {
      const pillar = o.pillar && ['value', 'trust', 'fit', 'logistics'].includes(o.pillar) ? o.pillar : undefined;
      if (o.objection && pillar) {
        objections.push({
          objection: String(o.objection).slice(0, 500),
          pillar,
          handling: o.handling ? String(o.handling).slice(0, 500) : undefined,
          howRepHandled: o.howRepHandled ? String(o.howRepHandled).slice(0, 500) : undefined,
        });
      }
    }
  }

  // Prospect difficulty
  let prospectDifficulty: ProspectDifficultyAssessment | undefined;
  if (analysis.prospectDifficulty) {
    const pd = analysis.prospectDifficulty;
    prospectDifficulty = {
      positionProblemAlignment: Math.max(0, Math.min(10, Math.round(pd.positionProblemAlignment || 5))),
      painAmbitionIntensity: Math.max(0, Math.min(10, Math.round(pd.painAmbitionIntensity || 5))),
      perceivedNeedForHelp: Math.max(0, Math.min(10, Math.round(pd.perceivedNeedForHelp || 5))),
      authorityLevel: pd.authorityLevel || 'peer',
      funnelContext: Math.max(0, Math.min(10, Math.round(pd.funnelContext || 5))),
      executionResistance: Math.max(0, Math.min(10, Math.round(pd.executionResistance || 5))),
      totalDifficultyScore: Math.max(0, Math.min(50, Math.round(pd.totalDifficultyScore || 25))),
      difficultyTier: pd.difficultyTier || 'realistic',
    };
  }

  const overallScore = clamp(analysis.overallScore || 0);

  let coachingRecommendations = Array.isArray(analysis.coachingRecommendations) ? analysis.coachingRecommendations : [];
  const timestampedFeedback = Array.isArray(analysis.timestampedFeedback) ? analysis.timestampedFeedback : [];

  const validResults = ['no_show', 'closed', 'lost', 'unqualified', 'deposit'] as const;
  let outcome: CallOutcomeSuggestion | undefined;
  if (analysis.outcome && typeof analysis.outcome === 'object') {
    const o = analysis.outcome as Record<string, unknown>;
    const result = typeof o.result === 'string' && validResults.includes(o.result as any) ? o.result as CallOutcomeSuggestion['result'] : undefined;
    const cashCollectedRaw = o.cashCollected ?? o.cash_collected;
    const revenueGeneratedRaw = o.revenueGenerated ?? o.revenue_generated;
    const reasonRaw = o.reasonForOutcome ?? o.reason_for_outcome;
    outcome = {
      result,
      qualified: typeof o.qualified === 'boolean' ? o.qualified : undefined,
      cashCollected: typeof cashCollectedRaw === 'number' && cashCollectedRaw >= 0 ? Math.round(cashCollectedRaw) : undefined,
      revenueGenerated: typeof revenueGeneratedRaw === 'number' && revenueGeneratedRaw >= 0 ? Math.round(revenueGeneratedRaw) : undefined,
      reasonForOutcome: typeof reasonRaw === 'string' ? String(reasonRaw).trim().slice(0, 2000) : undefined,
    };
    if (!result && outcome?.qualified === undefined && outcome?.cashCollected === undefined && outcome?.revenueGenerated === undefined && !outcome?.reasonForOutcome) {
      outcome = undefined;
    }
  }

  const skillScores: SkillScore[] = SALES_CATEGORIES.map((c) => ({
    category: c.label,
    subSkills: { [c.id]: categoryScores[c.id] ?? 0 },
  }));

  return {
    overallScore,
    categoryScores,
    objections,
    skillScores,
    coachingRecommendations,
    timestampedFeedback,
    prospectDifficulty,
    outcome,
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
