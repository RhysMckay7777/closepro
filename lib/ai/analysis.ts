// AI Analysis service using Anthropic Claude
// Alternative: Groq (faster, cheaper) or Together AI (flexible)

import Anthropic from '@anthropic-ai/sdk';
import Groq from 'groq-sdk';
import { SALES_CATEGORIES, type SalesCategoryId } from './scoring-framework';
import { getCondensedExamples } from './knowledge/real-call-examples';
import {
  SCORING_CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
  PROSPECT_DIFFICULTY_MODEL_V2,
  V2_DIFFICULTY_DIMENSIONS,
  V2_DIFFICULTY_DIMENSION_LABELS,
} from '@/lib/training';
import { getDifficultyBandV2 } from '@/lib/training/prospect-difficulty-model';

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

// ═══════════════════════════════════════════════════════════
// V1 Types (kept for backward compat with existing analyses)
// ═══════════════════════════════════════════════════════════

/** 10-category score (each 0-10). Keys are SalesCategoryId. */
export type CategoryScores = Partial<Record<SalesCategoryId, number>>;

/** Detailed per-category score with explanation fields (Connor's spec) */
export interface CategoryScoreDetail {
  score: number; // 0-10
  whyThisScore: string;
  whatWasDoneWell: string;
  whatWasMissing: string;
  howItAffectedOutcome: string;
}

/** Single objection with pillar classification (Value, Trust, Fit, Logistics). */
export interface ObjectionEntry {
  objection: string;
  pillar: 'value' | 'trust' | 'fit' | 'logistics';
  handling?: string;
  howRepHandled?: string;
  rootCause?: string;
  preventionOpportunity?: string;
  handlingQuality?: number; // 0-10
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
  // v1 dimensions (6-dimension model, higher = easier)
  positionProblemAlignment?: number;
  painAmbitionIntensity?: number;
  perceivedNeedForHelp?: number;
  authorityLevel?: 'advisee' | 'peer' | 'advisor';
  funnelContext?: number;
  executionResistance?: number;
  totalDifficultyScore?: number;
  difficultyTier?: 'easy' | 'realistic' | 'hard' | 'expert';
}

/** AI-suggested outcome for sales figures (when addToFigures is true) */
export interface CallOutcomeSuggestion {
  result?: 'no_show' | 'closed' | 'lost' | 'unqualified' | 'deposit' | 'payment_plan';
  qualified?: boolean;
  cashCollected?: number; // cents
  revenueGenerated?: number; // cents
  reasonForOutcome?: string;
}

/** Moment-by-moment coaching entry (Connor Section 4) */
export interface MomentCoachingEntry {
  timestamp: string;
  whatHappened: string;
  whatShouldHaveHappened: string;
  affectedCategory: string;
  whyItMatters: string;
}

/** Enhanced priority fix (Connor Section 6) */
export interface EnhancedPriorityFix {
  problem: string;
  whatToDoDifferently: string;
  whenToApply: string;
  whyItMatters: string;
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
  priority: number;
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

// ═══════════════════════════════════════════════════════════
// V2 Types (phase-based analysis)
// ═══════════════════════════════════════════════════════════

/** Phase scores (each 0-100) */
export interface PhaseScores {
  overall: number;
  intro: number;
  discovery: number;
  pitch: number;
  close: number;
  objections: number;
}

/** Per-phase timestamped feedback item */
export interface PhaseTimestampedFeedback {
  timestamp: string;
  whatHappened: string;
  whatShouldHaveHappened: string;
  whyItMatters: string;
}

/** Phase detail for intro, discovery, pitch, close */
export interface PhaseDetail {
  summary: string;
  whatWorked: string[];
  whatLimitedImpact: string;
  timestampedFeedback: PhaseTimestampedFeedback[];
}

/** Overall phase detail */
export interface OverallPhaseDetail {
  summary: string;
  biggestImprovementTheme: string;
  isStrongCall: boolean;
}

/** Objection block for phase analysis */
export interface ObjectionBlock {
  quote: string;
  timestamp: string;
  type: 'value' | 'trust' | 'fit' | 'logistics';
  whySurfaced: string;
  howHandled: string;
  higherLeverageAlternative: string;
}

/** Full phase analysis structure */
export interface PhaseAnalysis {
  overall: OverallPhaseDetail;
  intro: PhaseDetail;
  discovery: PhaseDetail;
  pitch: PhaseDetail;
  close: PhaseDetail;
  objections: {
    blocks: ObjectionBlock[];
  };
}

/** Action point (replaces priority fixes in v2) — max 2 */
export interface ActionPoint {
  thePattern: string;
  whyItsCostingYou: string;
  whatToDoInstead: string;
  microDrill: string;
}

/** Per-dimension difficulty justifications */
export interface ProspectDifficultyJustifications {
  icpAlignment: string;
  painAndAmbition: string;
  funnelWarmth: string;
  authorityAndCoachability: string;
  executionResistance: string;
}

/** v2 prospect difficulty (5 dimensions, higher = harder) */
export interface ProspectDifficultyV2 {
  icpAlignment: number;
  painAndAmbition: number;
  funnelWarmth: number;
  authorityAndCoachability: number;
  executionResistance: number;
  totalDifficultyScore: number;
  difficultyTier: 'easy' | 'realistic' | 'hard' | 'expert';
}

export type CloserEffectiveness = 'above_expectation' | 'at_expectation' | 'below_expectation';

/** Locked form values from the confirm page, passed to AI as context */
export interface ConfirmFormContext {
  callDate?: string;
  offerName?: string;
  prospectName?: string;
  callType?: string;
  result?: string;
  cashCollected?: number; // cents
  revenueGenerated?: number; // cents
  reasonForOutcome?: string;
}

// ═══════════════════════════════════════════════════════════
// Combined Result Type
// ═══════════════════════════════════════════════════════════

export interface CallAnalysisResult {
  overallScore: number; // 0-100

  // v1 fields (kept for backward compat)
  categoryScores: CategoryScores;
  categoryFeedbackDetailed?: Partial<Record<SalesCategoryId, CategoryScoreDetail>>;
  outcomeDiagnostic?: string;
  objections: ObjectionEntry[];
  skillScores: SkillScore[];
  coachingRecommendations: CoachingRecommendation[];
  momentCoaching?: MomentCoachingEntry[];
  timestampedFeedback: TimestampedFeedback[];
  prospectDifficulty?: ProspectDifficultyAssessment;
  outcome?: CallOutcomeSuggestion;
  enhancedPriorityFixes?: EnhancedPriorityFix[];
  stagesCompleted?: {
    opening: boolean;
    discovery: boolean;
    offer: boolean;
    objections: boolean;
    close: boolean;
  };
  isIncomplete?: boolean;
  categoryFeedback?: CategoryFeedback[];
  priorityFixes?: PriorityFix[];
  objectionAnalysis?: ObjectionAnalysis[];

  // v2 fields (phase-based analysis)
  phaseScores?: PhaseScores;
  phaseAnalysis?: PhaseAnalysis;
  outcomeDiagnosticP1?: string;
  outcomeDiagnosticP2?: string;
  closerEffectiveness?: CloserEffectiveness;
  prospectDifficultyV2?: ProspectDifficultyV2;
  prospectDifficultyJustifications?: ProspectDifficultyJustifications;
  actionPoints?: ActionPoint[];
}

// ═══════════════════════════════════════════════════════════
// Closer Effectiveness Calculation (deterministic, NOT AI-computed)
// ═══════════════════════════════════════════════════════════

/**
 * Calculate closer effectiveness based on prospect difficulty and overall score.
 * This is a deterministic function — it does NOT rely on AI output.
 */
export function calculateCloserEffectiveness(
  difficultyTotal: number,
  overallScore: number
): CloserEffectiveness {
  if (difficultyTotal >= 36) {
    // Hard/Expert prospect
    if (overallScore >= 70) return 'above_expectation';
    if (overallScore >= 50) return 'at_expectation';
    return 'below_expectation';
  }
  if (difficultyTotal >= 21) {
    // Realistic prospect
    if (overallScore >= 80) return 'above_expectation';
    if (overallScore >= 60) return 'at_expectation';
    return 'below_expectation';
  }
  // Easy prospect (0-20)
  if (overallScore >= 90) return 'above_expectation';
  if (overallScore >= 75) return 'at_expectation';
  return 'below_expectation';
}

// ═══════════════════════════════════════════════════════════
// Main Analysis Function
// ═══════════════════════════════════════════════════════════

/**
 * Analyze sales call transcript using AI (Groq primary, Anthropic fallback)
 */
export async function analyzeCall(
  transcript: string,
  transcriptJson: { utterances: Array<{ speaker: string; start: number; end: number; text: string }> },
  offerCategory?: 'b2c_health' | 'b2c_relationships' | 'b2c_wealth' | 'mixed_wealth' | 'b2b_services',
  customerStage?: 'aspiring' | 'current' | 'mixed',
  confirmFormContext?: ConfirmFormContext
): Promise<CallAnalysisResult> {
  const prompt = buildAnalysisPrompt(transcript, transcriptJson, offerCategory, customerStage, confirmFormContext);
  const systemPrompt = `You are an expert sales coach analyzing real sales calls. You evaluate calls using a phase-based scoring framework: one overall score (0-100) and 5 phase scores (intro, discovery, pitch, close, objections — each 0-100). Prospect difficulty is scored across 5 dimensions (each 0-10, higher = harder). Provide structured, decisive, strategic feedback. No fluff. Always return valid JSON.`;

  // Try Groq first (cheaper, faster) if enabled, otherwise try Anthropic
  if (USE_GROQ && groq) {
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
      if (!content) {
        throw new Error('No response from Groq');
      }

      let jsonText = content.trim();
      jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      const analysis = JSON.parse(jsonText);
      return normalizeAnalysis(analysis, offerCategory, customerStage);
    } catch (error: any) {
      console.error('Groq analysis error:', error);
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

      const text = content.text;
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;

      const analysis = JSON.parse(jsonText);
      return normalizeAnalysis(analysis, offerCategory, customerStage);
    } catch (error: any) {
      console.error('Anthropic analysis error:', error);
      const msg = error?.message ?? '';
      const isCreditError = /credit|balance|too low|invalid_request|payment|upgrade/i.test(msg) || error?.status === 400;
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
          const analysis = JSON.parse(jsonText);
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

// ═══════════════════════════════════════════════════════════
// V2 Prompt Builder
// ═══════════════════════════════════════════════════════════

function buildAnalysisPrompt(
  transcript: string,
  transcriptJson: { utterances: Array<{ speaker: string; start: number; end: number; text: string }> },
  offerCategory?: 'b2c_health' | 'b2c_relationships' | 'b2c_wealth' | 'mixed_wealth' | 'b2b_services',
  customerStage?: 'aspiring' | 'current' | 'mixed',
  confirmFormContext?: ConfirmFormContext
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

  // Locked contextual variables from confirm form
  const lockedContext = confirmFormContext ? `
══════════════════════════════════════════
LOCKED CONTEXTUAL VARIABLES (from pre-analysis form — DO NOT contradict these)
══════════════════════════════════════════
${confirmFormContext.callDate ? `Call Date: ${confirmFormContext.callDate}` : ''}
${confirmFormContext.offerName ? `Offer: ${confirmFormContext.offerName}` : ''}
${confirmFormContext.prospectName ? `Prospect Name: ${confirmFormContext.prospectName}` : ''}
${confirmFormContext.callType ? `Call Type: ${confirmFormContext.callType}` : ''}
${confirmFormContext.result ? `Outcome: ${confirmFormContext.result}` : ''}
${confirmFormContext.cashCollected !== undefined ? `Cash Collected: £${(confirmFormContext.cashCollected / 100).toFixed(2)}` : ''}
${confirmFormContext.revenueGenerated !== undefined ? `Revenue Generated: £${(confirmFormContext.revenueGenerated / 100).toFixed(2)}` : ''}
${confirmFormContext.reasonForOutcome ? `Reason for Outcome: ${confirmFormContext.reasonForOutcome}` : ''}
══════════════════════════════════════════
These values are confirmed by the user. Your analysis must be consistent with them.
Do NOT infer a different outcome, cash amount, or prospect identity.
` : '';

  return `Analyze this sales call transcript and provide a comprehensive phase-based evaluation.
${lockedContext}
${categoryGuidance}
${realExamplesSection}
TRANSCRIPT:
${transcript.length > 6000 ? transcript.substring(0, 6000) + '\n... (truncated for faster analysis)' : transcript}

SPEAKER TIMESTAMPS (sample):
${JSON.stringify(transcriptJson.utterances.slice(0, 30), null, 2)}${transcriptJson.utterances.length > 30 ? `\n... (${transcriptJson.utterances.length - 30} more utterances)` : ''}

${PROSPECT_DIFFICULTY_MODEL_V2}

EVALUATION FRAMEWORK (Phase-Based Scoring v2.0):

Return your analysis as a single JSON object with the following structure:

1. OVERALL SCORE (0-100):
   "overallScore": number — the overall call performance score.

2. PHASE SCORES (each 0-100):
   "phaseScores": {
     "overall": number,
     "intro": number,
     "discovery": number,
     "pitch": number,
     "close": number,
     "objections": number
   }

3. PHASE ANALYSIS:
   "phaseAnalysis": {
     "overall": {
       "summary": string (4-8 lines, comprehensive call summary),
       "biggestImprovementTheme": string (the single most impactful thing to improve),
       "isStrongCall": boolean (true if overall >= 70, determines if theme is optimization vs corrective)
     },
     "intro": {
       "summary": string (paragraph about intro performance),
       "whatWorked": string[] (max 3 bullet points),
       "whatLimitedImpact": string (paragraph about what held back the intro),
       "timestampedFeedback": [
         {
           "timestamp": string (e.g. "1:23"),
           "whatHappened": string,
           "whatShouldHaveHappened": string,
           "whyItMatters": string
         }
       ]
     },
     "discovery": { ...same structure as intro... },
     "pitch": { ...same structure as intro... },
     "close": { ...same structure as intro... },
     "objections": {
       "blocks": [
         {
           "quote": string (verbatim prospect quote),
           "timestamp": string,
           "type": "value" | "trust" | "fit" | "logistics",
           "whySurfaced": string (what earlier failure caused this),
           "howHandled": string (what the rep actually did),
           "higherLeverageAlternative": string (better response)
         }
       ]
     }
   }

4. OUTCOME DIAGNOSTIC (two separate paragraphs):
   "outcomeDiagnosticP1": string — WHY the result occurred. Clear cause-and-effect chain. No generic statements.
   "outcomeDiagnosticP2": string — Contextual paragraph:
     - If outcome is "closed" AND overall score >= 80 → optimization opportunities
     - If outcome is "deposit" or "payment_plan" → what would increase probability of full close
     - If outcome is "lost" → what needed to happen to close
   Tone: decisive and strategic, not generic.

5. PROSPECT DIFFICULTY (v2.0 — 5 dimensions, higher = harder):
   "prospectDifficulty": {
     "icpAlignment": number (0-10, 10=worst fit),
     "painAndAmbition": number (0-10, 10=no motivation),
     "funnelWarmth": number (0-10, 10=cold),
     "authorityAndCoachability": number (0-10, 10=combative),
     "executionResistance": number (0-10, 10=immovable blockers),
     "totalDifficultyScore": number (sum of above, 0-50),
     "difficultyTier": "easy" | "realistic" | "hard" | "expert"
   }

6. PROSPECT DIFFICULTY JUSTIFICATIONS (2-4 sentences per dimension):
   "prospectDifficultyJustifications": {
     "icpAlignment": string,
     "painAndAmbition": string,
     "funnelWarmth": string,
     "authorityAndCoachability": string,
     "executionResistance": string
   }

7. ACTION POINTS (MAXIMUM 2 — hard cap, do NOT return more than 2):
   "actionPoints": [
     {
       "thePattern": string (what's happening behaviorally — reference specific call moments),
       "whyItsCostingYou": string (revenue or authority impact),
       "whatToDoInstead": string (specific behavioral shift),
       "microDrill": string (clear practice instruction)
     }
   ]
   Every point MUST reference specific moments from this call. No generic advice.

Return ONLY valid JSON. No markdown, no explanation outside the JSON object.

Example structure:
{
  "overallScore": 62,
  "phaseScores": {
    "overall": 62,
    "intro": 70,
    "discovery": 55,
    "pitch": 65,
    "close": 50,
    "objections": 60
  },
  "phaseAnalysis": {
    "overall": {
      "summary": "The call opened well with strong rapport and clear framing, but lost momentum during discovery where the rep failed to explore emotional consequences of inaction. The pitch was technically competent but lacked personalization to the prospect's specific situation. The close was premature — the prospect hadn't been given enough reason to act now. Objection handling was reactive rather than pre-emptive, suggesting gaps in earlier phases.",
      "biggestImprovementTheme": "Deepen discovery by exploring emotional consequences before transitioning to pitch",
      "isStrongCall": false
    },
    "intro": {
      "summary": "Strong opening with clear agenda-setting and rapport building. The rep established authority early.",
      "whatWorked": ["Clear agenda set in first 60 seconds", "Warm tone that built initial trust", "Asked permission before proceeding"],
      "whatLimitedImpact": "The intro ran slightly long (4 minutes) which compressed discovery time. Could have been tighter.",
      "timestampedFeedback": [
        {
          "timestamp": "0:45",
          "whatHappened": "Rep spent 2 minutes on small talk after rapport was established",
          "whatShouldHaveHappened": "Transition to agenda after 30 seconds of rapport",
          "whyItMatters": "Extended small talk signals lack of structure and wastes limited call time"
        }
      ]
    },
    "discovery": { "summary": "...", "whatWorked": ["..."], "whatLimitedImpact": "...", "timestampedFeedback": [] },
    "pitch": { "summary": "...", "whatWorked": ["..."], "whatLimitedImpact": "...", "timestampedFeedback": [] },
    "close": { "summary": "...", "whatWorked": ["..."], "whatLimitedImpact": "...", "timestampedFeedback": [] },
    "objections": {
      "blocks": [
        {
          "quote": "I need to think about it",
          "timestamp": "32:15",
          "type": "trust",
          "whySurfaced": "Insufficient gap creation during discovery — prospect didn't feel urgency to act now",
          "howHandled": "Rep asked what specifically they needed to think about, then tried to re-pitch features",
          "higherLeverageAlternative": "Acknowledge, then isolate: 'When you say think about it, is it the investment, the timing, or something else?' Then address the root cause directly."
        }
      ]
    }
  },
  "outcomeDiagnosticP1": "This call resulted in a loss because the rep failed to create sufficient urgency during discovery. While surface-level problems were uncovered, the emotional consequences of inaction were never explored. This meant the pitch — while technically competent — landed as informational rather than motivational. The prospect had no compelling reason to act today.",
  "outcomeDiagnosticP2": "To close this prospect, the rep needed to spend 5-7 more minutes in discovery exploring what happens if the problem persists. Specifically: financial cost of inaction, emotional toll, and timeline pressure. This would have made the close feel inevitable rather than pressured. The objection 'I need to think about it' would likely not have surfaced with proper urgency framing.",
  "prospectDifficulty": {
    "icpAlignment": 3,
    "painAndAmbition": 4,
    "funnelWarmth": 5,
    "authorityAndCoachability": 3,
    "executionResistance": 6,
    "totalDifficultyScore": 21,
    "difficultyTier": "realistic"
  },
  "prospectDifficultyJustifications": {
    "icpAlignment": "The prospect runs an online coaching business generating £8k/month, which is a strong fit for this offer. Their current challenges around scaling and client acquisition align well with the core outcome. Minor gap in their experience level compared to ideal ICP.",
    "painAndAmbition": "The prospect expressed clear desire to scale but framed it as aspirational rather than urgent. They mentioned wanting to 'eventually' reach £20k months, suggesting moderate motivation without time pressure.",
    "funnelWarmth": "The prospect came through a webinar funnel and had watched 2 videos before the call. They applied proactively but didn't engage deeply with follow-up content. Lukewarm — interested but not pre-sold.",
    "authorityAndCoachability": "The prospect was receptive to advice and asked thoughtful questions. They're the sole decision-maker with no spouse or partner to consult. Open to being coached but not easily led.",
    "executionResistance": "The prospect mentioned cash flow concerns and said the investment would be 'a stretch'. They asked about payment plans unprompted, suggesting financial barriers are real. Moderate-to-high resistance on the execution front."
  },
  "actionPoints": [
    {
      "thePattern": "At 14:20, the rep transitioned from discovery to pitch after only 2 surface-level problem questions. This pattern of rushing through discovery appeared again at 18:45 when the prospect hinted at deeper issues that went unexplored.",
      "whyItsCostingYou": "Without emotional anchoring, every pitch lands as information rather than transformation. This directly caused the 'I need to think about it' objection and likely costs 2-3 closes per month.",
      "whatToDoInstead": "After identifying the core problem, ask 3 consequence questions: 'What happens if this doesn't change in 6 months?', 'How does this affect [specific area they mentioned]?', 'What's the real cost of staying where you are?'",
      "microDrill": "Before your next 3 calls, write down 5 consequence questions specific to the prospect's situation. During discovery, do not transition to pitch until you've asked at least 3 of them and gotten emotional responses."
    }
  ]
}`;
}

// ═══════════════════════════════════════════════════════════
// Normalization (handles both v1 and v2 AI responses)
// ═══════════════════════════════════════════════════════════

/**
 * Normalize and validate analysis results.
 * Detects v2 (phaseScores present) vs v1 (categoryScores present) and normalizes accordingly.
 */
function normalizeAnalysis(analysis: any, _offerCategory?: string, _customerStage?: string): CallAnalysisResult {
  // Detect v2 by checking for phaseScores
  const isV2 = analysis.phaseScores && typeof analysis.phaseScores === 'object';

  if (isV2) {
    return normalizeV2Analysis(analysis);
  }
  return normalizeV1Analysis(analysis);
}

/**
 * Normalize v2 phase-based analysis from AI response.
 */
function normalizeV2Analysis(analysis: any): CallAnalysisResult {
  const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n || 0)));
  const clamp10 = (n: number) => Math.max(0, Math.min(10, Math.round(n || 0)));

  // Phase scores
  const rawPS = analysis.phaseScores || {};
  const phaseScores: PhaseScores = {
    overall: clamp100(rawPS.overall),
    intro: clamp100(rawPS.intro),
    discovery: clamp100(rawPS.discovery),
    pitch: clamp100(rawPS.pitch),
    close: clamp100(rawPS.close),
    objections: clamp100(rawPS.objections),
  };

  const overallScore = clamp100(analysis.overallScore || phaseScores.overall);

  // Phase analysis
  const rawPA = analysis.phaseAnalysis || {};
  const normalizePhaseDetail = (raw: any): PhaseDetail => ({
    summary: typeof raw?.summary === 'string' ? raw.summary.slice(0, 3000) : '',
    whatWorked: Array.isArray(raw?.whatWorked) ? raw.whatWorked.slice(0, 3).map((s: any) => String(s).slice(0, 500)) : [],
    whatLimitedImpact: typeof raw?.whatLimitedImpact === 'string' ? raw.whatLimitedImpact.slice(0, 2000) : '',
    timestampedFeedback: Array.isArray(raw?.timestampedFeedback)
      ? raw.timestampedFeedback.map((f: any) => ({
          timestamp: String(f.timestamp ?? ''),
          whatHappened: String(f.whatHappened ?? '').slice(0, 1000),
          whatShouldHaveHappened: String(f.whatShouldHaveHappened ?? '').slice(0, 1000),
          whyItMatters: String(f.whyItMatters ?? '').slice(0, 1000),
        }))
      : [],
  });

  const overallDetail: OverallPhaseDetail = {
    summary: typeof rawPA.overall?.summary === 'string' ? rawPA.overall.summary.slice(0, 3000) : '',
    biggestImprovementTheme: typeof rawPA.overall?.biggestImprovementTheme === 'string'
      ? rawPA.overall.biggestImprovementTheme.slice(0, 1000)
      : '',
    isStrongCall: typeof rawPA.overall?.isStrongCall === 'boolean' ? rawPA.overall.isStrongCall : overallScore >= 70,
  };

  // Objection blocks
  const rawObjBlocks = rawPA.objections?.blocks;
  const objectionBlocks: ObjectionBlock[] = Array.isArray(rawObjBlocks)
    ? rawObjBlocks.map((b: any) => ({
        quote: String(b.quote ?? '').slice(0, 500),
        timestamp: String(b.timestamp ?? ''),
        type: ['value', 'trust', 'fit', 'logistics'].includes(b.type) ? b.type : 'value',
        whySurfaced: String(b.whySurfaced ?? '').slice(0, 1000),
        howHandled: String(b.howHandled ?? '').slice(0, 1000),
        higherLeverageAlternative: String(b.higherLeverageAlternative ?? '').slice(0, 1000),
      }))
    : [];

  const phaseAnalysis: PhaseAnalysis = {
    overall: overallDetail,
    intro: normalizePhaseDetail(rawPA.intro),
    discovery: normalizePhaseDetail(rawPA.discovery),
    pitch: normalizePhaseDetail(rawPA.pitch),
    close: normalizePhaseDetail(rawPA.close),
    objections: { blocks: objectionBlocks },
  };

  // Outcome diagnostics
  const outcomeDiagnosticP1 = typeof analysis.outcomeDiagnosticP1 === 'string'
    ? analysis.outcomeDiagnosticP1.trim().slice(0, 3000) : '';
  const outcomeDiagnosticP2 = typeof analysis.outcomeDiagnosticP2 === 'string'
    ? analysis.outcomeDiagnosticP2.trim().slice(0, 3000) : '';

  // Prospect difficulty v2
  const rawPD = analysis.prospectDifficulty || {};
  const pdScores = {
    icpAlignment: clamp10(rawPD.icpAlignment),
    painAndAmbition: clamp10(rawPD.painAndAmbition),
    funnelWarmth: clamp10(rawPD.funnelWarmth),
    authorityAndCoachability: clamp10(rawPD.authorityAndCoachability),
    executionResistance: clamp10(rawPD.executionResistance),
  };
  const totalDifficulty = Math.min(50, pdScores.icpAlignment + pdScores.painAndAmbition + pdScores.funnelWarmth + pdScores.authorityAndCoachability + pdScores.executionResistance);
  const difficultyBand = getDifficultyBandV2(totalDifficulty);

  const prospectDifficultyV2: ProspectDifficultyV2 = {
    ...pdScores,
    totalDifficultyScore: totalDifficulty,
    difficultyTier: difficultyBand.label.toLowerCase() as ProspectDifficultyV2['difficultyTier'],
  };

  // Difficulty justifications
  const rawJust = analysis.prospectDifficultyJustifications || {};
  const prospectDifficultyJustifications: ProspectDifficultyJustifications = {
    icpAlignment: typeof rawJust.icpAlignment === 'string' ? rawJust.icpAlignment.slice(0, 2000) : '',
    painAndAmbition: typeof rawJust.painAndAmbition === 'string' ? rawJust.painAndAmbition.slice(0, 2000) : '',
    funnelWarmth: typeof rawJust.funnelWarmth === 'string' ? rawJust.funnelWarmth.slice(0, 2000) : '',
    authorityAndCoachability: typeof rawJust.authorityAndCoachability === 'string' ? rawJust.authorityAndCoachability.slice(0, 2000) : '',
    executionResistance: typeof rawJust.executionResistance === 'string' ? rawJust.executionResistance.slice(0, 2000) : '',
  };

  // Closer effectiveness (deterministic)
  const closerEffectiveness = calculateCloserEffectiveness(totalDifficulty, overallScore);

  // Action points (hard cap at 2)
  const rawAP = Array.isArray(analysis.actionPoints) ? analysis.actionPoints.slice(0, 2) : [];
  const actionPoints: ActionPoint[] = rawAP.map((ap: any) => ({
    thePattern: String(ap.thePattern ?? '').slice(0, 2000),
    whyItsCostingYou: String(ap.whyItsCostingYou ?? '').slice(0, 2000),
    whatToDoInstead: String(ap.whatToDoInstead ?? '').slice(0, 2000),
    microDrill: String(ap.microDrill ?? '').slice(0, 2000),
  }));

  // Build v1 compat fields (empty for v2 analyses)
  // Convert objection blocks to v1 ObjectionEntry format for backward compat
  const objections: ObjectionEntry[] = objectionBlocks.map(b => ({
    objection: b.quote,
    pillar: b.type,
    handling: b.howHandled,
    rootCause: b.whySurfaced,
    preventionOpportunity: b.higherLeverageAlternative,
  }));

  // Map v2 prospect difficulty to v1 format for backward compat
  const prospectDifficulty: ProspectDifficultyAssessment = {
    totalDifficultyScore: totalDifficulty,
    difficultyTier: prospectDifficultyV2.difficultyTier,
    executionResistance: pdScores.executionResistance,
  };

  return {
    overallScore,
    // v1 compat fields (empty/minimal for v2)
    categoryScores: {},
    objections,
    skillScores: [],
    coachingRecommendations: [],
    timestampedFeedback: [],
    prospectDifficulty,
    // v2 fields
    phaseScores,
    phaseAnalysis,
    outcomeDiagnosticP1: outcomeDiagnosticP1 || undefined,
    outcomeDiagnosticP2: outcomeDiagnosticP2 || undefined,
    closerEffectiveness,
    prospectDifficultyV2,
    prospectDifficultyJustifications,
    actionPoints: actionPoints.length > 0 ? actionPoints : undefined,
  };
}

/**
 * Normalize v1 (10-category) analysis from AI response.
 * This is the original normalizeAnalysis logic, kept for backward compat.
 */
function normalizeV1Analysis(analysis: any): CallAnalysisResult {
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  const clamp10 = (n: number) => Math.max(0, Math.min(10, Math.round(n)));
  const categoryScores: CategoryScores = {};
  const rawCategoryScores = analysis.categoryScores && typeof analysis.categoryScores === 'object' ? analysis.categoryScores : {};

  const idAliasMap: Record<string, SalesCategoryId> = {
    'authority_leadership': 'authority',
    'structure_framework': 'structure',
    'communication_storytelling': 'communication',
    'discovery_diagnosis': 'discovery',
    'gap_urgency': 'gap',
    'value_offer_positioning': 'value',
    'emotional_intelligence': 'trust',
    'closing_commitment': 'closing',
    'tonality_delivery': 'adaptation',
    'trust_safety_ethics': 'trust',
    'adaptation_calibration': 'adaptation',
    'Authority & Leadership': 'authority',
    'Structure & Framework': 'structure',
    'Communication & Storytelling': 'communication',
    'Discovery Depth & Diagnosis': 'discovery',
    'Discovery & Diagnosis': 'discovery',
    'Gap & Urgency': 'gap',
    'Value & Offer Positioning': 'value',
    'Objection Handling & Preemption': 'objection_handling',
    'Objection Handling': 'objection_handling',
    'Emotional Intelligence': 'trust',
    'Trust, Safety & Ethics': 'trust',
    'Adaptation & Calibration': 'adaptation',
    'Tonality & Delivery': 'adaptation',
    'Closing & Commitment Integrity': 'closing',
    'Closing & Commitment': 'closing',
  };

  for (const { id } of SALES_CATEGORIES) {
    const v = rawCategoryScores[id];
    if (typeof v === 'number') categoryScores[id as SalesCategoryId] = clamp10(v);
  }
  for (const [key, val] of Object.entries(rawCategoryScores)) {
    if (typeof val === 'number') {
      const canonicalId = idAliasMap[key];
      if (canonicalId && !(canonicalId in categoryScores)) {
        categoryScores[canonicalId] = clamp10(val);
      }
    }
  }

  if (Object.keys(categoryScores).length === 0 && Array.isArray(analysis.skillScores) && analysis.skillScores.length > 0) {
    for (const s of analysis.skillScores.slice(0, 10)) {
      const id = idAliasMap[s.category];
      if (id) {
        const score = typeof s.subSkills === 'object' ? (Object.values(s.subSkills) as number[]).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0) / Math.max(1, Object.keys(s.subSkills).length) : 0;
        categoryScores[id] = clamp10(score);
      }
    }
  }

  const objections: ObjectionEntry[] = [];
  if (Array.isArray(analysis.objections)) {
    for (const o of analysis.objections) {
      const rawPillar = o.pillar ?? o.objectionType;
      const pillar = rawPillar && ['value', 'trust', 'fit', 'logistics'].includes(String(rawPillar).toLowerCase())
        ? String(rawPillar).toLowerCase() as ObjectionEntry['pillar']
        : undefined;
      const objText = o.objection ?? o.exactObjection;
      if (objText && pillar) {
        objections.push({
          objection: String(objText).slice(0, 500),
          pillar,
          handling: o.handling ? String(o.handling).slice(0, 500) : undefined,
          howRepHandled: o.howRepHandled ? String(o.howRepHandled).slice(0, 500) : undefined,
          rootCause: o.rootCause ? String(o.rootCause).slice(0, 500) : undefined,
          preventionOpportunity: o.preventionOpportunity ? String(o.preventionOpportunity).slice(0, 500) : undefined,
          handlingQuality: typeof o.handlingQuality === 'number' ? clamp10(o.handlingQuality) : undefined,
        });
      }
    }
  }

  const outcomeDiagnostic = typeof analysis.outcomeDiagnostic === 'string'
    ? analysis.outcomeDiagnostic.trim().slice(0, 3000)
    : '';

  const categoryFeedbackDetailed: Partial<Record<SalesCategoryId, CategoryScoreDetail>> = {};
  for (const { id } of SALES_CATEGORIES) {
    const raw = rawCategoryScores[id];
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const r = raw as Record<string, unknown>;
      categoryFeedbackDetailed[id as SalesCategoryId] = {
        score: typeof r.score === 'number' ? clamp10(r.score) : (categoryScores[id as SalesCategoryId] ?? 0),
        whyThisScore: typeof r.whyThisScore === 'string' ? r.whyThisScore.slice(0, 1000) : '',
        whatWasDoneWell: typeof r.whatWasDoneWell === 'string' ? r.whatWasDoneWell.slice(0, 1000) : '',
        whatWasMissing: typeof r.whatWasMissing === 'string' ? r.whatWasMissing.slice(0, 1000) : '',
        howItAffectedOutcome: typeof r.howItAffectedOutcome === 'string' ? r.howItAffectedOutcome.slice(0, 1000) : '',
      };
      if (!(id as SalesCategoryId in categoryScores)) {
        categoryScores[id as SalesCategoryId] = categoryFeedbackDetailed[id as SalesCategoryId]!.score;
      }
    }
  }

  const momentCoaching: MomentCoachingEntry[] = [];
  if (Array.isArray(analysis.momentCoaching)) {
    for (const m of analysis.momentCoaching) {
      momentCoaching.push({
        timestamp: String(m.timestamp ?? ''),
        whatHappened: String(m.whatHappened ?? ''),
        whatShouldHaveHappened: String(m.whatShouldHaveHappened ?? ''),
        affectedCategory: String(m.affectedCategory ?? ''),
        whyItMatters: String(m.whyItMatters ?? ''),
      });
    }
  }

  const enhancedPriorityFixes: EnhancedPriorityFix[] = [];
  if (Array.isArray(analysis.priorityFixes)) {
    for (const f of analysis.priorityFixes) {
      enhancedPriorityFixes.push({
        problem: String(f.problem ?? ''),
        whatToDoDifferently: String(f.whatToDoDifferently ?? ''),
        whenToApply: String(f.whenToApply ?? ''),
        whyItMatters: String(f.whyItMatters ?? ''),
      });
    }
  }

  let prospectDifficulty: ProspectDifficultyAssessment | undefined;
  if (analysis.prospectDifficulty) {
    const pd = analysis.prospectDifficulty;
    const tier = pd.difficultyTier || 'realistic';
    prospectDifficulty = {
      positionProblemAlignment: Math.max(0, Math.min(10, Math.round(pd.positionProblemAlignment || 5))),
      painAmbitionIntensity: Math.max(0, Math.min(10, Math.round(pd.painAmbitionIntensity || 5))),
      perceivedNeedForHelp: Math.max(0, Math.min(10, Math.round(pd.perceivedNeedForHelp || 5))),
      authorityLevel: pd.authorityLevel || 'peer',
      funnelContext: Math.max(0, Math.min(10, Math.round(pd.funnelContext || 5))),
      executionResistance: Math.max(0, Math.min(10, Math.round(pd.executionResistance || 5))),
      totalDifficultyScore: Math.max(0, Math.min(50, Math.round(pd.totalDifficultyScore || 25))),
      difficultyTier: (tier === 'near_impossible' || tier === 'elite') ? 'expert' : tier,
    };
  }

  const overallScore = clamp(analysis.overallScore || 0);

  let coachingRecommendations = Array.isArray(analysis.coachingRecommendations) ? analysis.coachingRecommendations : [];
  const timestampedFeedback = Array.isArray(analysis.timestampedFeedback) ? analysis.timestampedFeedback : [];

  const validResults = ['no_show', 'closed', 'lost', 'unqualified', 'deposit', 'payment_plan'] as const;
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

  const objectionAnalysis: ObjectionAnalysis[] = objections.map(o => ({
    objection: o.objection,
    pillar: o.pillar,
    howRepHandled: o.howRepHandled || o.handling || '',
    wasHandledWell: (o.handlingQuality ?? 5) >= 6,
    howCouldBeHandledBetter: o.preventionOpportunity || '',
  }));

  return {
    overallScore,
    categoryScores,
    categoryFeedbackDetailed: Object.keys(categoryFeedbackDetailed).length > 0 ? categoryFeedbackDetailed : undefined,
    outcomeDiagnostic: outcomeDiagnostic || undefined,
    objections,
    skillScores,
    coachingRecommendations,
    momentCoaching: momentCoaching.length > 0 ? momentCoaching : undefined,
    timestampedFeedback,
    prospectDifficulty,
    outcome,
    enhancedPriorityFixes: enhancedPriorityFixes.length > 0 ? enhancedPriorityFixes : undefined,
    objectionAnalysis: objectionAnalysis.length > 0 ? objectionAnalysis : undefined,
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
