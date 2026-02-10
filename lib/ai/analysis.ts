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
  PROSPECT_DIFFICULTY_MODEL,
} from '@/lib/training';

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
  // Prospect difficulty dimensions (50-point model)
  positionProblemAlignment?: number; // 0-10
  painAmbitionIntensity?: number; // 0-10
  perceivedNeedForHelp?: number; // 0-10
  authorityLevel?: 'advisee' | 'peer' | 'advisor';
  funnelContext?: number; // 0-10
  executionResistance?: number; // 0-10 (ability to proceed)
  totalDifficultyScore?: number; // 0-50
  difficultyTier?: 'easy' | 'realistic' | 'hard' | 'expert';
}

/** AI-suggested outcome for sales figures (when addToFigures is true) */
export interface CallOutcomeSuggestion {
  result?: 'no_show' | 'closed' | 'lost' | 'unqualified' | 'deposit';
  qualified?: boolean;
  cashCollected?: number; // cents
  revenueGenerated?: number; // cents
  reasonForOutcome?: string;
}

/** Moment-by-moment coaching entry (Connor Section 4) */
export interface MomentCoachingEntry {
  timestamp: string; // e.g. "12:34" or "~15 min mark"
  whatHappened: string;
  whatShouldHaveHappened: string;
  affectedCategory: string; // one of the 10 category IDs
  whyItMatters: string;
}

/** Enhanced priority fix (Connor Section 6) */
export interface EnhancedPriorityFix {
  problem: string;
  whatToDoDifferently: string;
  whenToApply: string;
  whyItMatters: string;
}

export interface CallAnalysisResult {
  overallScore: number; // 0-100

  /** 10 category scores (each 0-10). Primary scoring per Sales Call Scoring Framework. */
  categoryScores: CategoryScores;

  /** Detailed per-category feedback with explanation fields (Connor Section 3). */
  categoryFeedbackDetailed?: Partial<Record<SalesCategoryId, CategoryScoreDetail>>;

  /** Outcome diagnostic narrative (Connor Section 2) — 5-7 sentences. */
  outcomeDiagnostic?: string;

  /** Objections with pillar classification only (not primary scores). */
  objections: ObjectionEntry[];

  /** Legacy: skill scores as array for backward compat; derived from categoryScores when persisting. */
  skillScores: SkillScore[];

  // Coaching recommendations
  coachingRecommendations: CoachingRecommendation[];

  // Moment-by-moment coaching (Connor Section 4)
  momentCoaching?: MomentCoachingEntry[];

  // Timestamped feedback
  timestampedFeedback: TimestampedFeedback[];

  // Prospect difficulty assessment (for call list and reporting)
  prospectDifficulty?: ProspectDifficultyAssessment;

  // Optional outcome suggestion for sales figures (when analysisIntent is update_figures)
  outcome?: CallOutcomeSuggestion;

  // Enhanced priority fixes (Connor Section 6)
  enhancedPriorityFixes?: EnhancedPriorityFix[];

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

CONNOR'S PROSPECT DIFFICULTY MODEL (reference for evaluation):
${PROSPECT_DIFFICULTY_MODEL}

EVALUATION FRAMEWORK (Sales Call Scoring – 10 Category Framework):

1. OVERALL SCORE (0-100) and 10 CATEGORY SCORES (each 0-10). Use these exact category IDs:
${SCORING_CATEGORIES.map(id => `   - ${id}: ${CATEGORY_LABELS[id]} — ${CATEGORY_DESCRIPTIONS[id]}`).join('\n')}
   For each category, return an object with:
   - score (0-10)
   - whyThisScore: explain why this score was given, referencing specific moments
   - whatWasDoneWell: what the rep did well in this area
   - whatWasMissing: what was missing or misaligned
   - howItAffectedOutcome: how this category's performance affected the call outcome
   All explanations must map back to the subcategory evaluation questions. Reference specific moments in the call.

2. OUTCOME DIAGNOSTIC:
   Write a narrative paragraph (5-7 sentences) explaining why this call ended the way it did.
   Cover: primary outcome drivers, what was done well, what was missing or mis-executed,
   how prospect difficulty influenced (but did not excuse) the result.
   Use clear, specific language — not generic filler.

3. OBJECTIONS (pillar classification). For each objection raised:
   - exactObjection: the verbatim text from the transcript
   - objectionType: "Value" | "Trust" | "Fit" | "Logistics"
   - rootCause: what was missing earlier in the call that caused this objection
   - preventionOpportunity: where in the call it could have been pre-empted
   - handlingQuality: 0-10, how well the rep handled the objection
   - handling: brief description of how the rep responded

4. PROSPECT DIFFICULTY ASSESSMENT (50-point model):
   Analyze the PROSPECT's difficulty to contextualize the rep's performance.
   Score each dimension per the model above.
   - positionProblemAlignment (0-10)
   - painAmbitionIntensity (0-10)
   - perceivedNeedForHelp (0-10)
   - authorityLevel: "advisee" | "peer" | "advisor"
   - funnelContext (0-10)
   - executionResistance (0-10)
   - totalDifficultyScore (0-50)
   - difficultyTier: "easy" | "realistic" | "hard" | "expert"
   Never return "near_impossible" or "elite" — use "expert" for the hardest prospects.
   IMPORTANT: Execution resistance must be reported separately. It increases difficulty but does not excuse poor sales skill.

5. MOMENT-BY-MOMENT COACHING:
   Identify specific moments where execution broke down or opportunities were missed.
   For each moment, return:
   - timestamp: e.g. "12:34" or "~15 min mark" (formatted as minutes:seconds)
   - whatHappened: description of what the rep did
   - whatShouldHaveHappened: the correct action
   - affectedCategory: which of the 10 category IDs this relates to
   - whyItMatters: impact explanation
   Focus on CORRECTIVE feedback — missed opportunities, poor execution, incorrect sequencing,
   failure to adapt. Do NOT overload with positives — this section is corrective.

6. PRIORITY FIXES (3-5 maximum, ordered by impact — most impactful first):
   For each fix:
   - problem: what went wrong
   - whatToDoDifferently: specific behavioral change
   - whenToApply: at what point in the call
   - whyItMatters: why this matters for this type of prospect
   Must be: actionable, behavioural, context-aware.

7. COACHING RECOMMENDATIONS:
   - Priority (high/medium/low)
   - Specific issue identified
   - Explanation of why it matters
   - Actionable guidance
   - Timestamp if applicable
   - Note: Separate skill issues from lead quality/execution resistance issues

8. TIMESTAMPED FEEDBACK:
   - Specific moments in the call (with timestamps)
   - Type: strength, weakness, opportunity, warning
   - Relevant transcript segment

9. OUTCOME (for sales figures – important):
   Infer from the transcript whether an agreement was reached and what money was involved.
   - result: "closed" if they bought/committed, "deposit" if only deposit taken, "lost" / "unqualified" / "no_show" otherwise.
   - qualified: true if prospect was a fit and moved forward (or closed), false otherwise.
   - cashCollected: amount actually collected on this call IN CENTS (e.g. $50 → 5000, $1,200 → 120000).
   - revenueGenerated: total value of the deal IN CENTS.
   - reasonForOutcome: one sentence on why this outcome.
   Always include the "outcome" object. When result is "closed" or "deposit" you MUST set cashCollected and/or revenueGenerated in CENTS.

Return your analysis as JSON in this exact format:
{
  "overallScore": 75,
  "outcomeDiagnostic": "This call resulted in a loss primarily due to insufficient gap creation and a lack of urgency. While discovery uncovered surface-level problems, the rep did not fully explore the emotional or practical consequences of inaction. The prospect was moderately difficult (realistic tier) but the rep failed to adapt their approach accordingly. Strong authority was established early but was undermined by poor structure in the middle third. Objection handling was reactive rather than pre-emptive, suggesting earlier trust-building gaps. With better gap creation and urgency framing, this call had a reasonable chance of closing.",
  "categoryScores": {
${SCORING_CATEGORIES.map(id => `    "${id}": { "score": 7, "whyThisScore": "...", "whatWasDoneWell": "...", "whatWasMissing": "...", "howItAffectedOutcome": "..." }`).join(',\n')}
  },
  "objections": [
    { "objection": "I need to think about it", "pillar": "trust", "rootCause": "Insufficient gap creation — prospect didn't feel urgency", "preventionOpportunity": "During discovery, could have explored consequences of inaction", "handlingQuality": 5, "handling": "Rep acknowledged and asked what specifically to think about." }
  ],
  "momentCoaching": [
    { "timestamp": "12:34", "whatHappened": "Rep moved to pitch without completing discovery", "whatShouldHaveHappened": "Should have asked 2-3 more questions about the emotional impact of the problem", "affectedCategory": "discovery", "whyItMatters": "Skipping deep discovery means the value proposition has no emotional anchor" }
  ],
  "priorityFixes": [
    { "problem": "Moved to pitch before completing discovery", "whatToDoDifferently": "Ask at least 3 consequence questions before transitioning to the offer", "whenToApply": "After identifying the core problem, before presenting the solution", "whyItMatters": "For this type of prospect, emotional buy-in is essential before logical presentation" }
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
    "difficultyTier": "expert"
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

  // Alias map: old IDs and label names → canonical category IDs
  const idAliasMap: Record<string, SalesCategoryId> = {
    // Old snake_case IDs from v1 → new canonical IDs
    'authority_leadership': 'authority',
    'structure_framework': 'structure',
    'communication_storytelling': 'communication',
    'discovery_diagnosis': 'discovery',
    'gap_urgency': 'gap',
    'value_offer_positioning': 'value',
    'emotional_intelligence': 'trust',
    'closing_commitment': 'closing',
    'tonality_delivery': 'adaptation',
    // Other old aliases AI may return
    'trust_safety_ethics': 'trust',
    'adaptation_calibration': 'adaptation',
    // Old label name aliases
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

  // First pass: direct canonical ID match
  for (const { id } of SALES_CATEGORIES) {
    const v = rawCategoryScores[id];
    if (typeof v === 'number') categoryScores[id as SalesCategoryId] = clamp10(v);
  }
  // Second pass: resolve old/aliased keys that didn't match canonical IDs
  for (const [key, val] of Object.entries(rawCategoryScores)) {
    if (typeof val === 'number') {
      const canonicalId = idAliasMap[key];
      if (canonicalId && !(canonicalId in categoryScores)) {
        categoryScores[canonicalId] = clamp10(val);
      }
    }
  }

  // Fallback: if still empty, try extracting from legacy skillScores array
  if (Object.keys(categoryScores).length === 0 && Array.isArray(analysis.skillScores) && analysis.skillScores.length > 0) {
    for (const s of analysis.skillScores.slice(0, 10)) {
      const id = idAliasMap[s.category];
      if (id) {
        const score = typeof s.subSkills === 'object' ? (Object.values(s.subSkills) as number[]).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0) / Math.max(1, Object.keys(s.subSkills).length) : 0;
        categoryScores[id] = clamp10(score);
      }
    }
  }

  // Objections (pillar classification + enhanced fields)
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

  // Outcome diagnostic (Connor Section 2)
  const outcomeDiagnostic = typeof analysis.outcomeDiagnostic === 'string'
    ? analysis.outcomeDiagnostic.trim().slice(0, 3000)
    : '';

  // Category feedback detailed (Connor Section 3 — per-category explanations)
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
      // Also set the flat score if not already set
      if (!(id as SalesCategoryId in categoryScores)) {
        categoryScores[id as SalesCategoryId] = categoryFeedbackDetailed[id as SalesCategoryId]!.score;
      }
    }
  }

  // Moment-by-moment coaching (Connor Section 4)
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

  // Priority fixes (Connor Section 6)
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

  // Prospect difficulty
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
