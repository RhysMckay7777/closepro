// AI Analysis service using Anthropic Claude
// Alternative: Groq (faster, cheaper) or Together AI (flexible)

import Anthropic from '@anthropic-ai/sdk';
import Groq from 'groq-sdk';
import { SALES_CATEGORIES, type SalesCategoryId } from './scoring-framework';
import { getCondensedExamples } from './knowledge/real-call-examples';
import {
  PROSPECT_DIFFICULTY_KNOWLEDGE,
  SALES_PHILOSOPHY_KNOWLEDGE,
  COACHING_OUTPUT_RULES,
} from './knowledge';
import {
  SCORING_CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_DESCRIPTIONS,
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

/** Structured limitation item (v3 format) */
export interface WhatLimitedImpactItem {
  description: string;
  timestamp: string;
  whatShouldHaveDone: string;
}

/** Phase detail for intro, discovery, pitch, close */
export interface PhaseDetail {
  summary: string;
  whatWorked: string[];
  whatLimitedImpact: string | WhatLimitedImpactItem[];
  timestampedFeedback: PhaseTimestampedFeedback[];
}

/** Overall phase detail */
export interface OverallPhaseDetail {
  // v3 3-paragraph format
  callOutcomeAndWhy?: string;
  whatLimited?: string;
  primaryImprovementFocus?: string;
  // Legacy fields (kept for backward compat with existing analyses)
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

/** Phase timing for timeline bar */
export interface PhaseTiming {
  start: string;
  end: string;
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
  phaseTimings?: {
    intro?: PhaseTiming;
    discovery?: PhaseTiming;
    pitch?: PhaseTiming;
    objections?: PhaseTiming | PhaseTiming[];
    close?: PhaseTiming;
  };
  totalDuration?: string;
}

/** Action point (replaces priority fixes in v2) — max 3 */
export interface ActionPoint {
  label?: string;
  thePattern: string;
  whyItsCostingYou: string;
  whatToDoInstead: string;
  microDrill: string;
}

/** Per-dimension difficulty justifications */
export interface ProspectDifficultyJustifications {
  icpAlignment: string;
  motivationIntensity: string;
  funnelContext: string;
  authorityAndCoachability: string;
  abilityToProceed: string;
  prospectContextSummary?: string;
  dimensionScores?: {
    icpAlignment: number;
    motivationIntensity: number;
    funnelContext: number;
    authorityAndCoachability: number;
    abilityToProceed: number;
  };
}

/** v2 prospect difficulty (5 dimensions, higher = easier) */
export interface ProspectDifficultyV2 {
  icpAlignment: number;
  motivationIntensity: number;
  funnelContext: number;
  authorityAndCoachability: number;
  abilityToProceed: number;
  totalDifficultyScore: number;
  difficultyTier: 'easy' | 'realistic' | 'hard' | 'expert' | 'near_impossible';
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
  if (difficultyTotal >= 41) {
    // Easy prospect (41-50)
    if (overallScore >= 90) return 'above_expectation';
    if (overallScore >= 75) return 'at_expectation';
    return 'below_expectation';
  }
  if (difficultyTotal >= 32) {
    // Realistic prospect (32-40)
    if (overallScore >= 80) return 'above_expectation';
    if (overallScore >= 60) return 'at_expectation';
    return 'below_expectation';
  }
  if (difficultyTotal >= 20) {
    // Hard/Expert prospect (20-31)
    if (overallScore >= 70) return 'above_expectation';
    if (overallScore >= 50) return 'at_expectation';
    return 'below_expectation';
  }
  // Near Impossible (<20)
  if (overallScore >= 60) return 'above_expectation';
  if (overallScore >= 40) return 'at_expectation';
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
  const systemPrompt = buildSystemPrompt();

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
// System Prompt (knowledge docs + scoring rules + tone + caps)
// ═══════════════════════════════════════════════════════════

function buildSystemPrompt(): string {
  return `You are an elite sales performance analyst and high-performance sales coach. You analyze sales call transcripts and roleplay transcripts to produce structured, actionable coaching feedback.

You are NOT a transcript analyst, critic, summarizer, or generic advice generator. You are a coach focused on behavior change.

PRIORITY: Actionable coaching > descriptive analysis.

Always return valid JSON. No markdown, no explanation outside the JSON object.

═══ KNOWLEDGE DOCUMENT 1: SALES PHILOSOPHY & SCORING FRAMEWORK ═══
${SALES_PHILOSOPHY_KNOWLEDGE}

═══ KNOWLEDGE DOCUMENT 2: PROSPECT DIFFICULTY MODEL ═══
${PROSPECT_DIFFICULTY_KNOWLEDGE}

═══ KNOWLEDGE DOCUMENT 3: AI COACHING OUTPUT RULES ═══
${COACHING_OUTPUT_RULES}

═══ TONE ADAPTATION ═══

Adapt your coaching tone based on outcome:

STRONG CLOSE (PIF + High Score):
- Tone: Reinforcing, strategic, optimizing
- Focus: What worked, what to repeat, marginal gains
- The "What Limited" section becomes "Optimization Opportunities" framing

PAYMENT PLAN / DEPOSIT:
- Tone: Constructive, margin-focused
- Focus: What limited PIF conversion, authority or urgency gaps

LOSS / NO SALE:
- Tone: Direct, calm, clear
- Focus: Structural breakdown, controllable factors, one dominant fix
- No emotional language. No shaming.

ROLEPLAY:
- Treat as real call performance
- No "it was just practice" tone
- Focus more on structure than outcome

Prospect Difficulty must be referenced in the overall analysis to contextualize performance — not to excuse weakness.

═══ SCORE CAP ENFORCEMENT ═══

When scoring each phase, you MUST apply automatic score caps. These caps are defined in the Sales Philosophy knowledge document under each phase's scoring section.

If a cap condition is met, the phase score CANNOT exceed the cap value, regardless of other strengths.

Apply the LOWEST applicable cap if multiple conditions are met.

Examples:
- Discovery under 10 minutes → max 50, even if what was covered was good
- No value confirmation before price → max 70 for Close, even if delivery was strong
- Feature dumping in pitch → max 65, even if personalization was present elsewhere

State which caps were applied (if any) in the phase summary.`;
}

// ═══════════════════════════════════════════════════════════
// User Prompt Builder
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

  // Locked contextual variables from confirm form — placed at top of prompt for maximum salience
  const lockedContext = confirmFormContext ? `
╔══════════════════════════════════════════════════════════════════╗
║  CRITICAL — LOGGED OUTCOME OVERRIDE (ABSOLUTE SOURCE OF TRUTH)  ║
╚══════════════════════════════════════════════════════════════════╝
The user has logged this call's outcome. These values are FINAL and IMMUTABLE:

${confirmFormContext.callDate ? `Call Date: ${confirmFormContext.callDate}` : ''}
${confirmFormContext.offerName ? `Offer: ${confirmFormContext.offerName}` : ''}
${confirmFormContext.prospectName ? `Prospect Name: ${confirmFormContext.prospectName}` : ''}
${confirmFormContext.callType ? `Call Type: ${confirmFormContext.callType}` : ''}
${confirmFormContext.result ? `Outcome: ${confirmFormContext.result}` : ''}
${confirmFormContext.cashCollected !== undefined ? `Deal Value / Cash Collected: £${(confirmFormContext.cashCollected / 100).toFixed(2)}` : ''}
${confirmFormContext.revenueGenerated !== undefined ? `Revenue Generated: £${(confirmFormContext.revenueGenerated / 100).toFixed(2)}` : ''}
${confirmFormContext.reasonForOutcome ? `Reason for Outcome: ${confirmFormContext.reasonForOutcome}` : ''}

YOUR ANALYSIS MUST ALIGN WITH THIS OUTCOME. Do NOT contradict the logged outcome
based on transcript inference. If the transcript is ambiguous about the outcome,
ALWAYS defer to the user's logged result.

This applies to:
- Your overall analysis summary (callOutcomeAndWhy)
- Phase-by-phase summaries
- Performance rating and overallScore
- Any mention of whether the deal closed or not
- Objection handling assessment (if closed, objections were ultimately overcome)
${confirmFormContext.result === 'closed' ? `- The deal DID close. Analyze HOW the rep achieved the close, not whether they did.` : ''}
${confirmFormContext.result === 'lost' ? `- The deal was LOST. Analyze what went wrong structurally.` : ''}
${confirmFormContext.result === 'deposit' ? `- A deposit was taken. Analyze what prevented a full close.` : ''}
══════════════════════════════════════════════════════════════════
` : '';

  return `Analyze this sales call transcript using the knowledge documents provided in the system prompt.
${lockedContext}
${categoryGuidance}
${realExamplesSection}
TIMESTAMP ACCURACY RULE:
When referencing specific moments from the transcript, you MUST use the EXACT [MM:SS]
timestamp from the transcript data provided. Do NOT approximate, round, or estimate
timestamps. Every timestamp you reference must correspond to an actual line in the
transcript. Format: Always use [MM:SS] format (e.g., [04:23], [12:07], [45:31]).

TRANSCRIPT:
${transcript.length > 6000 ? transcript.substring(0, 6000) + '\n... (truncated for faster analysis)' : transcript}

SPEAKER TIMESTAMPS (sample):
${JSON.stringify(transcriptJson.utterances.slice(0, 30), null, 2)}${transcriptJson.utterances.length > 30 ? `\n... (${transcriptJson.utterances.length - 30} more utterances)` : ''}

Return your analysis as a single JSON object with the following structure:

1. OVERALL SCORE (0-100):
   "overallScore": number — calculated using weighted formula: Discovery×0.30 + Objections×0.25 + Pitch×0.20 + Close×0.15 + Intro×0.10

2. PHASE SCORES (each 0-100):
   "phaseScores": {
     "overall": number (same as overallScore),
     "intro": number,
     "discovery": number,
     "pitch": number,
     "close": number,
     "objections": number
   }

3. PHASE ANALYSIS:
   "phaseAnalysis": {
     "overall": {
       "callOutcomeAndWhy": string (PARAGRAPH 1 — "Call Outcome & Why This Happened"
         Explain: what the result was, how prospect difficulty impacted the situation,
         the main structural reason the call resulted this way.
         Connect: execution → psychological effect → outcome.
         Must feel decisive, not vague.
         If PIF: what created inevitability, where authority was strongest.
         If Payment Plan/Deposit: was value strong but urgency weaker? Authority soft at close?
         If Loss: was discovery weak? Value unstabilized? Objection mishandled?),

       "whatLimited": string (PARAGRAPH 2 — "What Limited This Call"
         The main structural weakness, highest-impact flaw across phases.
         This is a SYNTHESIS — not a repeat of phase feedback.
         Identify dominant pattern, show how it compounded, explain why it mattered.
         If strong close: frame as "Optimization Opportunities".
         If weak call: clear but calm identification of breakdown.),

       "primaryImprovementFocus": string (PARAGRAPH 3 — "Primary Improvement Focus"
         The #1 highest-leverage improvement. Why it matters.
         Specific behavioral shift. Tie to revenue impact.
         ONE core theme, not a list. Answer: "If you fixed this one thing, what would change?"
         Structure: The Pattern → Why It Costs You → What To Do Instead.)
     },
     "intro": {
       "summary": string (structure + performance overview paragraph. State any score caps applied.),
       "whatWorked": string[] (max 3 bullet points of what was done well),
       "whatLimitedImpact": [
         {
           "description": string (PROBLEM — 3-4 sentences: Describe exactly what the closer said or did
             that was suboptimal. Explain WHY this was a problem — what psychological or strategic effect
             it had on the prospect. Reference the specific transcript moment with [MM:SS] timestamp.
             Explain what the prospect likely felt or thought in that moment.),
           "timestamp": string (e.g. "1:23" or "Early in intro"),
           "whatShouldHaveDone": string (CORRECTION — 5-6 sentences: Explain the exact correction.
             Provide the SPECIFIC alternative phrase or approach the closer should have used — write it
             out as a quote they can practice. Explain WHY this alternative is better — connect it to
             the framework principle it addresses (authority, discovery depth, objection handling calm,
             pre-setting, etc.). Give context for when to deploy this technique. If relevant, reference
             how this connects to other phases e.g. "This pre-setting question in discovery would have
             given you ammunition for the 'think about it' objection that came later".)
         }
       ] (MINIMUM 2 items per phase, MAXIMUM 5),
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
           "whySurfaced": string (what earlier failure caused this — pre-emption analysis),
           "howHandled": string (what the rep actually did),
           "higherLeverageAlternative": string (better response with specific language)
         }
       ]
     }
   }

   OBJECTION SCORING RULE: 50% of the objection phase score is based on pre-emption
   (were objections surfaced/prevented earlier in discovery/pitch?), 50% on live handling quality.

4. OUTCOME DIAGNOSTIC (backward compat — populate from overall analysis above):
   "outcomeDiagnosticP1": string (copy of phaseAnalysis.overall.callOutcomeAndWhy)
   "outcomeDiagnosticP2": string (copy of phaseAnalysis.overall.whatLimited)

5. PROSPECT DIFFICULTY (v2.0 — 5 dimensions, higher = easier/more favorable):
   "prospectDifficulty": {
     "icpAlignment": number (0-10, 10=perfect fit),
     "motivationIntensity": number (0-10, 10=highly motivated),
     "funnelContext": number (0-10, 10=hot/referral),
     "authorityAndCoachability": number (0-10, 10=very coachable),
     "abilityToProceed": number (0-10, 10=fully able),
     "totalDifficultyScore": number (sum of above, 0-50),
     "difficultyTier": "easy" | "realistic" | "hard" | "expert" | "near_impossible"
   }

6. PROSPECT CONTEXT & DIFFICULTY JUSTIFICATIONS:
   "prospectContextSummary": string (2-3 sentence natural-language description of who this prospect
     appears to be based on the transcript. Include their apparent job/situation, motivation level,
     and demeanor. Example: "A 34-year-old warehouse worker from Manchester who has been looking at
     online business opportunities for 6 weeks. Previously tried dropshipping but lost £500. Skeptical
     but motivated by wanting financial freedom for his young family."),
   "prospectDifficultyJustifications": {
     "icpAlignment": string (2-4 sentence explanation analyzing ICP fit),
     "motivationIntensity": string (2-4 sentence explanation analyzing motivation signals),
     "funnelContext": string (2-4 sentence explanation analyzing funnel position),
     "authorityAndCoachability": string (2-4 sentence explanation analyzing authority dynamics),
     "abilityToProceed": string (2-4 sentence explanation analyzing logistics/ability)
   }

7. ACTION STEPS (minimum 2, maximum 3 — 3rd is optional "Suggested Optimization"):
   "actionPoints": [
     {
       "label": string (short label, e.g. "Authority Drop at Price", "Weak Urgency Close"),
       "thePattern": string (timestamp/moment + observable behavior from this call),
       "whyItsCostingYou": string (behavior → effect → outcome. Revenue/authority/margin impact),
       "whatToDoInstead": string (clear replacement behavior with language example),
       "microDrill": string (specific behavioral drill, not generic advice)
     }
   ]
   Every action step MUST reference specific moments from this call. No abstract feedback.

8. PHASE TIMING DETECTION:
   Analyze the transcript and identify the start and end timestamp of each phase.
   "phaseTimings": {
     "intro": { "start": "00:00", "end": "MM:SS" },
     "discovery": { "start": "MM:SS", "end": "MM:SS" },
     "pitch": { "start": "MM:SS", "end": "MM:SS" },
     "objections": { "start": "MM:SS", "end": "MM:SS" },
     "close": { "start": "MM:SS", "end": "MM:SS" }
   },
   "totalDuration": "MM:SS"

   Phase boundaries:
   - Intro: From call start until first substantive discovery question
   - Discovery: From first situational question until goal setting / transition to pitch
   - Pitch: From when the closer starts presenting the solution/program
   - Objections: From first objection raised until resolved (may have multiple segments —
     use array: [{ "start": "MM:SS", "end": "MM:SS" }, ...])
   - Close: From close attempt through to end of call

Return ONLY valid JSON. No markdown, no explanation outside the JSON object.`;
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
    whatLimitedImpact: Array.isArray(raw?.whatLimitedImpact)
      ? raw.whatLimitedImpact.slice(0, 5).map((item: any) => ({
          description: String(item?.description || '').slice(0, 1000),
          timestamp: String(item?.timestamp || '').slice(0, 50),
          whatShouldHaveDone: String(item?.whatShouldHaveDone || '').slice(0, 1000),
        }))
      : (typeof raw?.whatLimitedImpact === 'string' ? raw.whatLimitedImpact.slice(0, 2000) : ''),
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
    // New 3-paragraph format
    callOutcomeAndWhy: typeof rawPA.overall?.callOutcomeAndWhy === 'string'
      ? rawPA.overall.callOutcomeAndWhy.slice(0, 3000) : '',
    whatLimited: typeof rawPA.overall?.whatLimited === 'string'
      ? rawPA.overall.whatLimited.slice(0, 3000) : '',
    primaryImprovementFocus: typeof rawPA.overall?.primaryImprovementFocus === 'string'
      ? rawPA.overall.primaryImprovementFocus.slice(0, 3000) : '',
    // Legacy fallbacks
    summary: typeof rawPA.overall?.summary === 'string' ? rawPA.overall.summary.slice(0, 3000)
      : (rawPA.overall?.callOutcomeAndWhy ?? '').slice(0, 3000),
    biggestImprovementTheme: typeof rawPA.overall?.biggestImprovementTheme === 'string'
      ? rawPA.overall.biggestImprovementTheme.slice(0, 1000)
      : (rawPA.overall?.primaryImprovementFocus ?? '').slice(0, 1000),
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

  // Phase timings (from AI section 8)
  const rawTimings = rawPA.phaseTimings || analysis.phaseTimings;
  const normalizeTimingEntry = (t: any): PhaseTiming | undefined => {
    if (!t || typeof t !== 'object' || !t.start) return undefined;
    return { start: String(t.start), end: String(t.end || '') };
  };
  const parsedPhaseTimings = rawTimings && typeof rawTimings === 'object' ? {
    intro: normalizeTimingEntry(rawTimings.intro),
    discovery: normalizeTimingEntry(rawTimings.discovery),
    pitch: normalizeTimingEntry(rawTimings.pitch),
    objections: Array.isArray(rawTimings.objections)
      ? rawTimings.objections.map(normalizeTimingEntry).filter(Boolean) as PhaseTiming[]
      : normalizeTimingEntry(rawTimings.objections),
    close: normalizeTimingEntry(rawTimings.close),
  } : undefined;
  const parsedTotalDuration = typeof (rawPA.totalDuration || analysis.totalDuration) === 'string'
    ? String(rawPA.totalDuration || analysis.totalDuration) : undefined;

  const phaseAnalysis: PhaseAnalysis = {
    overall: overallDetail,
    intro: normalizePhaseDetail(rawPA.intro),
    discovery: normalizePhaseDetail(rawPA.discovery),
    pitch: normalizePhaseDetail(rawPA.pitch),
    close: normalizePhaseDetail(rawPA.close),
    objections: { blocks: objectionBlocks },
    ...(parsedPhaseTimings && { phaseTimings: parsedPhaseTimings }),
    ...(parsedTotalDuration && { totalDuration: parsedTotalDuration }),
  };

  // Outcome diagnostics (prefer new overall fields, fall back to top-level)
  const outcomeDiagnosticP1 = (typeof rawPA.overall?.callOutcomeAndWhy === 'string' && rawPA.overall.callOutcomeAndWhy.trim())
    || (typeof analysis.outcomeDiagnosticP1 === 'string' ? analysis.outcomeDiagnosticP1.trim().slice(0, 3000) : '');
  const outcomeDiagnosticP2 = (typeof rawPA.overall?.whatLimited === 'string' && rawPA.overall.whatLimited.trim())
    || (typeof analysis.outcomeDiagnosticP2 === 'string' ? analysis.outcomeDiagnosticP2.trim().slice(0, 3000) : '');

  // Prospect difficulty v2 (with backward compat fallbacks for old key names)
  const rawPD = analysis.prospectDifficulty || {};
  const pdScores = {
    icpAlignment: clamp10(rawPD.icpAlignment),
    motivationIntensity: clamp10(rawPD.motivationIntensity ?? rawPD.painAndAmbition),
    funnelContext: clamp10(rawPD.funnelContext ?? rawPD.funnelWarmth),
    authorityAndCoachability: clamp10(rawPD.authorityAndCoachability),
    abilityToProceed: clamp10(rawPD.abilityToProceed ?? rawPD.executionResistance),
  };
  const totalDifficulty = Math.min(50, pdScores.icpAlignment + pdScores.motivationIntensity + pdScores.funnelContext + pdScores.authorityAndCoachability + pdScores.abilityToProceed);
  const difficultyBand = getDifficultyBandV2(totalDifficulty);

  const prospectDifficultyV2: ProspectDifficultyV2 = {
    ...pdScores,
    totalDifficultyScore: totalDifficulty,
    difficultyTier: difficultyBand.label.toLowerCase().replace(/ /g, '_') as ProspectDifficultyV2['difficultyTier'],
  };

  // Difficulty justifications (with backward compat fallbacks)
  const rawJust = analysis.prospectDifficultyJustifications || {};
  const prospectDifficultyJustifications: ProspectDifficultyJustifications = {
    icpAlignment: typeof rawJust.icpAlignment === 'string' ? rawJust.icpAlignment.slice(0, 2000) : '',
    motivationIntensity: typeof (rawJust.motivationIntensity ?? rawJust.painAndAmbition) === 'string' ? (rawJust.motivationIntensity ?? rawJust.painAndAmbition).slice(0, 2000) : '',
    funnelContext: typeof (rawJust.funnelContext ?? rawJust.funnelWarmth) === 'string' ? (rawJust.funnelContext ?? rawJust.funnelWarmth).slice(0, 2000) : '',
    authorityAndCoachability: typeof rawJust.authorityAndCoachability === 'string' ? rawJust.authorityAndCoachability.slice(0, 2000) : '',
    abilityToProceed: typeof (rawJust.abilityToProceed ?? rawJust.executionResistance) === 'string' ? (rawJust.abilityToProceed ?? rawJust.executionResistance).slice(0, 2000) : '',
    prospectContextSummary: typeof analysis.prospectContextSummary === 'string' ? analysis.prospectContextSummary.slice(0, 2000) : undefined,
    dimensionScores: pdScores,
  };

  // Closer effectiveness (deterministic)
  const closerEffectiveness = calculateCloserEffectiveness(totalDifficulty, overallScore);

  // Action points (hard cap at 3)
  const rawAP = Array.isArray(analysis.actionPoints) ? analysis.actionPoints.slice(0, 3) : [];
  const actionPoints: ActionPoint[] = rawAP.map((ap: any) => ({
    label: String(ap.label || '').slice(0, 200),
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
    executionResistance: pdScores.abilityToProceed,
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
