import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { salesCalls, callAnalysis, roleplaySessions, roleplayAnalysis, offers } from '@/db/schema';
import { eq, and, gte, lt, lte, desc, sql } from 'drizzle-orm';
import { SCORING_CATEGORIES, CATEGORY_LABELS, type ScoringCategoryId } from '@/lib/training/scoring-categories';
import { CORE_PRINCIPLES } from '@/lib/training/core-principles';

// ── Category ID mapping (old → new canonical) ────────────────
const VALID_IDS = new Set<string>(SCORING_CATEGORIES);
const DISPLAY_NAMES: Record<string, string> = { ...CATEGORY_LABELS };

/** Map legacy / alternate category IDs to the 10 canonical IDs.
 *  Every key that has ever appeared in skillScores JSON must be here. */
const OLD_TO_NEW: Record<string, ScoringCategoryId> = {
  // Exact canonical IDs
  authority: 'authority',
  structure: 'structure',
  communication: 'communication',
  discovery: 'discovery',
  gap: 'gap',
  value: 'value',
  trust: 'trust',
  adaptation: 'adaptation',
  objection_handling: 'objection_handling',
  closing: 'closing',
  // Old compound snake_case IDs (v1 AI format)
  authority_leadership: 'authority',
  structure_framework: 'structure',
  communication_storytelling: 'communication',
  discovery_diagnosis: 'discovery',
  gap_urgency: 'gap',
  value_offer_positioning: 'value',
  trust_safety_ethics: 'trust',
  adaptation_calibration: 'adaptation',
  closing_commitment: 'closing',
  // Other old / AI-generated aliases
  emotional_intelligence: 'trust',
  tonality_delivery: 'adaptation',
  rapport_building: 'trust',
  needs_analysis: 'discovery',
  pain_point_discovery: 'discovery',
  objection_prevention: 'objection_handling',
  close_techniques: 'closing',
  value_proposition: 'value',
  pricing_negotiation: 'value',
  active_listening: 'discovery',
  follow_up: 'closing',
  presentation: 'communication',
  qualifying: 'gap',
};

function resolveCategory(raw: string): ScoringCategoryId | null {
  // 1. Try exact match first (preserves underscores)
  if (OLD_TO_NEW[raw]) return OLD_TO_NEW[raw];
  // 2. Try lowercase with underscores preserved
  const lower = raw.toLowerCase().trim();
  if (OLD_TO_NEW[lower]) return OLD_TO_NEW[lower];
  // 3. Try normalizing spaces/hyphens to underscores (for display-name-style keys)
  const normalized = lower.replace(/[\s\-&/,]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  if (VALID_IDS.has(normalized)) return normalized as ScoringCategoryId;
  if (OLD_TO_NEW[normalized]) return OLD_TO_NEW[normalized];
  return null;
}

export const maxDuration = 60;

export type PerformanceRange = 'this_week' | 'this_month' | 'last_month' | 'last_quarter' | 'last_year';

function getRangeDates(range: string): { start: Date; end: Date; label: string } {
  const now = new Date();
  const start = new Date(now);
  let end = new Date(now);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  // Check for YYYY-MM format (specific month selection)
  const monthMatch = range.match(/^(\d{4})-(\d{2})$/);
  if (monthMatch) {
    const year = parseInt(monthMatch[1], 10);
    const month = parseInt(monthMatch[2], 10) - 1; // JS months are 0-indexed
    start.setFullYear(year);
    start.setMonth(month);
    start.setDate(1);
    end = new Date(year, month + 1, 0, 23, 59, 59, 999); // Last day of the month
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return { start, end, label: `${monthNames[month]} ${year}` };
  }

  switch (range) {
    case 'this_week': {
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      return { start, end, label: 'This Week' };
    }
    case 'this_month':
      start.setDate(1);
      return { start, end, label: 'This Month' };
    case 'last_month': {
      start.setMonth(start.getMonth() - 1);
      start.setDate(1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start, end, label: 'Last Month' };
    }
    case 'last_quarter': {
      const q = Math.floor(now.getMonth() / 3) + 1;
      const prevQ = q - 1;
      const year = prevQ <= 0 ? now.getFullYear() - 1 : now.getFullYear();
      const quarterStartMonth = prevQ <= 0 ? (prevQ + 4) * 3 - 3 : prevQ * 3 - 3;
      start.setFullYear(year);
      start.setMonth(quarterStartMonth);
      start.setDate(1);
      end.setFullYear(year);
      end.setMonth(quarterStartMonth + 2);
      end.setDate(new Date(year, quarterStartMonth + 3, 0).getDate());
      end.setHours(23, 59, 59, 999);
      return { start, end, label: 'Last Quarter' };
    }
    case 'last_year':
      start.setFullYear(start.getFullYear() - 1);
      start.setMonth(0);
      start.setDate(1);
      end.setFullYear(now.getFullYear() - 1);
      end.setMonth(11);
      end.setDate(31);
      end.setHours(23, 59, 59, 999);
      return { start, end, label: 'Last Year' };
    case 'all_time':
      start.setFullYear(2020);
      start.setMonth(0);
      start.setDate(1);
      return { start, end, label: 'All Time' };
    default: {
      const days = parseInt(range, 10) || 30;
      start.setDate(start.getDate() - days);
      return { start, end, label: `${days} days` };
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────

/** Safe JSON parse */
function safeParse(raw: string | null | undefined): any {
  if (!raw) return null;
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return null; }
}

/** Derive 10-category skill scores from v2 phaseScores when skillScores is empty.
 *  Phase scores are 0-100; we convert to 0-10 scale to match v1 format. */
function deriveSkillScoresFromPhases(phaseScores: any): Record<string, number> | null {
  if (!phaseScores || typeof phaseScores !== 'object') return null;
  const ps = phaseScores as Record<string, number>;
  // Only proceed if at least one phase has a score
  const hasData = ['intro', 'discovery', 'pitch', 'close', 'objections'].some(k => typeof ps[k] === 'number' && ps[k] > 0);
  if (!hasData) return null;
  const toScale10 = (v: number) => Math.round(Math.max(0, Math.min(10, (v || 0) / 10)));
  return {
    authority: toScale10(ps.intro),
    structure: toScale10(ps.intro),
    communication: toScale10(ps.discovery),
    discovery: toScale10(ps.discovery),
    gap: toScale10(ps.discovery),
    value: toScale10(ps.pitch),
    trust: toScale10(ps.pitch),
    objection_handling: toScale10(ps.objections),
    adaptation: toScale10(ps.objections),
    closing: toScale10(ps.close),
  };
}

/** Parse skill scores from a single analysis record.
 *  Returns { displayName: score0to100 } map filtered to only the 10 valid categories. */
function parseSkillScoresFlat(rawSkillScores: any): Record<string, number> {
  const out: Record<string, number> = {};
  if (!rawSkillScores) return out;

  if (typeof rawSkillScores === 'object' && !Array.isArray(rawSkillScores)) {
    for (const [key, val] of Object.entries(rawSkillScores)) {
      const resolved = resolveCategory(key);
      if (!resolved) continue; // skip unknown / legacy IDs that don't map to the 10
      const displayName = DISPLAY_NAMES[resolved] ?? resolved;
      let score = 0;
      if (typeof val === 'number') {
        score = val * 10; // 0-10 → display scale 0-100
      } else if (val && typeof val === 'object' && 'score' in (val as any)) {
        score = ((val as any).score ?? 0) * 10;
      } else {
        continue;
      }
      // If two old IDs map to the same canonical category, average them
      if (out[displayName] != null) {
        out[displayName] = Math.round((out[displayName] + score) / 2);
      } else {
        out[displayName] = score;
      }
    }
  } else if (Array.isArray(rawSkillScores)) {
    for (const skill of rawSkillScores) {
      if (skill?.category) {
        const resolved = resolveCategory(skill.category);
        if (!resolved) continue;
        const displayName = DISPLAY_NAMES[resolved] ?? resolved;
        const subSkills = skill.subSkills || {};
        const vals = Object.values(subSkills) as number[];
        const avg = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
        out[displayName] = avg * 10;
      }
    }
  }
  return out;
}

/** Parse category feedback JSON into per-category text fields (keyed by display name). */
function parseCategoryFeedbackText(raw: any): Record<string, { whatWasDoneWell: string; whatWasMissing: string; howItAffectedOutcome: string }> {
  const out: Record<string, { whatWasDoneWell: string; whatWasMissing: string; howItAffectedOutcome: string }> = {};
  if (!raw || typeof raw !== 'object') return out;

  for (const [key, val] of Object.entries(raw)) {
    if (val && typeof val === 'object') {
      const v = val as any;
      const resolved = resolveCategory(key);
      const displayName = resolved ? (DISPLAY_NAMES[resolved] ?? resolved) : key;
      out[displayName] = {
        whatWasDoneWell: typeof v.whatWasDoneWell === 'string' ? v.whatWasDoneWell : '',
        whatWasMissing: typeof v.whatWasMissing === 'string' ? v.whatWasMissing : '',
        howItAffectedOutcome: typeof v.howItAffectedOutcome === 'string' ? v.howItAffectedOutcome : '',
      };
    }
  }
  return out;
}

interface AnalysisRow {
  overallScore: number | null;
  skillScores: any;
  categoryFeedback: any;
  createdAt: Date;
  type: 'call' | 'roleplay';
  // Join fields
  offerId?: string | null;
  offerCategory?: string | null;
  offerName?: string | null;
  actualDifficultyTier?: string | null;
  selectedDifficulty?: string | null;
  objectionData?: any;
  priorityFixesData?: any;
  // IDs for recent analyses
  entityId?: string | null;
  analysisId?: string | null;
  // V2 phase-based data
  phaseScoresData?: any;
  phaseAnalysisData?: any;
  actionPointsData?: any;
  prospectDifficultyScore?: number | null;
}

/** Compute per-category averages, trends, and text summaries from a set of analyses. */
function computeSkillBreakdown(
  analyses: AnalysisRow[],
  endDate: Date,
) {
  const categoryScores: Record<string, { total: number; count: number }> = {};
  const categoryTexts: Record<string, { strengths: string[]; weaknesses: string[]; actionPoints: string[] }> = {};

  // Per-analysis per-category scores for trend computation
  const perAnalysisScores: Array<{ createdAt: Date; scores: Record<string, number> }> = [];

  let loggedSample = false;
  for (const analysis of analyses) {
    const scores = parseSkillScoresFlat(analysis.skillScores);
    if (!loggedSample) {
      console.log('[Performance API] parseSkillScoresFlat sample:', {
        inputType: typeof analysis.skillScores,
        inputIsNull: analysis.skillScores === null || analysis.skillScores === undefined,
        inputKeys: analysis.skillScores && typeof analysis.skillScores === 'object' ? Object.keys(analysis.skillScores).slice(0, 5) : 'N/A',
        inputSample: typeof analysis.skillScores === 'string' ? analysis.skillScores.slice(0, 200) : undefined,
        outputKeys: Object.keys(scores),
        outputSample: Object.entries(scores).slice(0, 3).map(([k, v]) => `${k}=${v}`),
      });
      loggedSample = true;
    }
    if (Object.keys(scores).length > 0) {
      perAnalysisScores.push({ createdAt: new Date(analysis.createdAt), scores });
    }

    for (const [cat, score] of Object.entries(scores)) {
      if (!categoryScores[cat]) categoryScores[cat] = { total: 0, count: 0 };
      categoryScores[cat].total += score;
      categoryScores[cat].count += 1;
    }

    // Parse category feedback text
    const feedback = parseCategoryFeedbackText(analysis.categoryFeedback);
    for (const [cat, fb] of Object.entries(feedback)) {
      if (!categoryTexts[cat]) categoryTexts[cat] = { strengths: [], weaknesses: [], actionPoints: [] };
      if (fb.whatWasDoneWell) categoryTexts[cat].strengths.push(fb.whatWasDoneWell);
      if (fb.whatWasMissing) categoryTexts[cat].weaknesses.push(fb.whatWasMissing);
      if (fb.howItAffectedOutcome) categoryTexts[cat].actionPoints.push(fb.howItAffectedOutcome);
    }
  }

  // Compute trend (first half vs second half)
  const midpoint = Math.floor(perAnalysisScores.length / 2);
  const firstHalf = perAnalysisScores.slice(midpoint); // older
  const secondHalf = perAnalysisScores.slice(0, midpoint); // newer
  const categoryTrends: Record<string, number> = {};
  for (const cat of Object.keys(categoryScores)) {
    const f = firstHalf.filter(r => r.scores[cat] != null);
    const s = secondHalf.filter(r => r.scores[cat] != null);
    const fAvg = f.length > 0 ? f.reduce((sum, r) => sum + (r.scores[cat] ?? 0), 0) / f.length : 0;
    const sAvg = s.length > 0 ? s.reduce((sum, r) => sum + (r.scores[cat] ?? 0), 0) / s.length : 0;
    categoryTrends[cat] = Math.round((sAvg - fAvg) * 10) / 10;
  }

  // Compute per-category weekly trend data (12 weeks ending at endDate)
  const categoryTrendData: Record<string, number[]> = {};
  for (const cat of Object.keys(categoryScores)) {
    const weeklyScores: number[] = [];
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(endDate);
      weekStart.setDate(weekStart.getDate() - (i * 7));
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekAnalyses = perAnalysisScores.filter(a => a.createdAt >= weekStart && a.createdAt < weekEnd && a.scores[cat] != null);
      if (weekAnalyses.length > 0) {
        weeklyScores.push(Math.round(weekAnalyses.reduce((s, a) => s + (a.scores[cat] ?? 0), 0) / weekAnalyses.length) / 10);
      } else {
        weeklyScores.push(0);
      }
    }
    categoryTrendData[cat] = weeklyScores;
  }

  // Build sorted skill categories with fallback text when categoryFeedback is null
  const skillCategories = Object.entries(categoryScores).map(([category, data]) => {
    const texts = categoryTexts[category] || { strengths: [], weaknesses: [], actionPoints: [] };
    const dedup = (arr: string[]) => [...new Set(arr)].slice(-3);

    const avgScore = Math.round(data.total / (data.count || 1));
    const sessionCount = data.count;
    let strengths = dedup(texts.strengths);
    let weaknesses = dedup(texts.weaknesses);
    let actionPoints = dedup(texts.actionPoints);

    // Issue 2 fix: Generate fallback text when no categoryFeedback exists
    if (strengths.length === 0 && weaknesses.length === 0 && actionPoints.length === 0 && sessionCount > 0) {
      const trendArr = categoryTrendData[category] ?? [];
      const nonZero = trendArr.filter(v => v > 0);
      const trendDir = nonZero.length >= 2
        ? (nonZero[nonZero.length - 1] > nonZero[0] ? 'improving' : 'declining')
        : 'stable';

      if (avgScore >= 70) {
        strengths = [`Averaging ${avgScore}/100 across ${sessionCount} session(s) — above target`];
      }
      if (avgScore < 50) {
        weaknesses = [`Averaging ${avgScore}/100 across ${sessionCount} session(s) — needs focused practice`];
      } else if (avgScore < 70) {
        weaknesses = [`Averaging ${avgScore}/100 — room for improvement`];
      }
      actionPoints = [`Review ${category} techniques in your lowest-scoring sessions`];
      if (trendDir === 'declining') {
        actionPoints.push(`Trend is declining — revisit recent ${category} feedback`);
      }
    }

    return {
      category,
      averageScore: avgScore,
      trend: categoryTrends[category] ?? 0,
      trendData: categoryTrendData[category] ?? [],
      strengths,
      weaknesses,
      actionPoints,
    };
  }).sort((a, b) => b.averageScore - a.averageScore);

  return skillCategories;
}

/** Compute best and worst categories from skill breakdown. */
function computeBestWorst(skillCategories: ReturnType<typeof computeSkillBreakdown>) {
  if (skillCategories.length === 0) return { bestCategory: null, bestCategoryScore: null, improvementOpportunity: null, improvementOpportunityScore: null };
  return {
    bestCategory: skillCategories[0].category,
    bestCategoryScore: skillCategories[0].averageScore,
    improvementOpportunity: skillCategories[skillCategories.length - 1].category,
    improvementOpportunityScore: skillCategories[skillCategories.length - 1].averageScore,
  };
}

// ── Main GET handler ─────────────────────────────────────────

/**
 * Get current user's performance data
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    // Separate month/year handling from named range params
    const monthParam = searchParams.get('month'); // YYYY-MM format from month mode
    const rangeParam = searchParams.get('range') || searchParams.get('days'); // Named range like 'all_time'
    const sourceParam = searchParams.get('source'); // 'calls' | 'roleplays' | null (all)

    let startDate: Date;
    let endDate: Date;
    let periodLabel: string;

    if (monthParam) {
      // Month-specific selection (YYYY-MM format)
      const result = getRangeDates(monthParam);
      startDate = result.start;
      endDate = result.end;
      periodLabel = result.label;
    } else {
      // Named range — default to all_time so users always see data
      const effectiveRange = rangeParam || 'all_time';
      const result = getRangeDates(effectiveRange);
      startDate = result.start;
      endDate = result.end;
      periodLabel = result.label;
    }

    const rangeLabel =
      ['all_time', 'this_week', 'this_month', 'last_month', 'last_quarter', 'last_year'].includes(rangeParam || '')
        ? rangeParam
        : undefined;
    console.log('[Performance API] Params:', { monthParam, rangeParam, sourceParam, startDate: startDate.toISOString(), endDate: endDate.toISOString(), periodLabel });

    const userId = session.user.id;

    // ── Fetch call analyses (with categoryFeedback + priorityFixes + v2 phase data) ──
    const callAnalysesRaw = await db
      .select({
        id: callAnalysis.id,
        callId: salesCalls.id,
        overallScore: callAnalysis.overallScore,
        skillScores: callAnalysis.skillScores,
        categoryFeedback: callAnalysis.categoryFeedback,
        phaseScores: callAnalysis.phaseScores,
        phaseAnalysis: callAnalysis.phaseAnalysis,
        actionPoints: callAnalysis.actionPoints,
        objectionDetails: callAnalysis.objectionDetails,
        priorityFixes: callAnalysis.priorityFixes,
        prospectDifficulty: callAnalysis.prospectDifficulty,
        createdAt: salesCalls.createdAt,
        callResult: salesCalls.result,
      })
      .from(callAnalysis)
      .innerJoin(salesCalls, eq(callAnalysis.callId, salesCalls.id))
      .where(
        and(
          eq(salesCalls.userId, userId),
          gte(salesCalls.createdAt, startDate),
          lte(salesCalls.createdAt, endDate)
        )
      )
      .orderBy(desc(salesCalls.createdAt));

    // Parse JSON fields — with v2 fallback chain for skillScores
    const callAnalyses: AnalysisRow[] = callAnalysesRaw.map(a => {
      const parsedSkillScores = safeParse(a.skillScores as any);
      const parsedCategoryFeedback = safeParse(a.categoryFeedback as any);
      const parsedPhaseScores = safeParse(a.phaseScores as any);
      // Fallback chain: skillScores → categoryFeedback (has .score per cat) → derived from phaseScores
      const isEmpty = (obj: any) => !obj || typeof obj !== 'object' || Object.keys(obj).length === 0;
      let effectiveSkillScores = parsedSkillScores;
      if (isEmpty(effectiveSkillScores) && !isEmpty(parsedCategoryFeedback)) {
        effectiveSkillScores = parsedCategoryFeedback; // parseSkillScoresFlat handles { score: X } objects
      }
      if (isEmpty(effectiveSkillScores) && parsedPhaseScores) {
        effectiveSkillScores = deriveSkillScoresFromPhases(parsedPhaseScores);
      }
      return {
        overallScore: a.overallScore,
        skillScores: effectiveSkillScores,
        categoryFeedback: parsedCategoryFeedback,
        objectionData: a.objectionDetails,
        priorityFixesData: a.priorityFixes,
        createdAt: a.createdAt,
        type: 'call' as const,
        entityId: a.callId,
        analysisId: a.id,
        phaseScoresData: parsedPhaseScores,
        phaseAnalysisData: safeParse(a.phaseAnalysis as any),
        actionPointsData: safeParse(a.actionPoints as any),
        prospectDifficultyScore: a.prospectDifficulty ?? null,
        callResult: (a as any).callResult ?? null,
      };
    });

    // ── Fetch roleplay analyses (with categoryFeedback + priorityFixes + v2 phase data) ──
    const roleplayAnalysesRaw = await db
      .select({
        id: roleplayAnalysis.id,
        sessionId: roleplaySessions.id,
        overallScore: roleplayAnalysis.overallScore,
        skillScores: roleplayAnalysis.skillScores,
        categoryFeedback: roleplayAnalysis.categoryFeedback,
        phaseScores: roleplayAnalysis.phaseScores,
        phaseAnalysis: roleplayAnalysis.phaseAnalysis,
        actionPoints: roleplayAnalysis.actionPoints,
        objectionAnalysis: roleplayAnalysis.objectionAnalysis,
        priorityFixes: roleplayAnalysis.priorityFixes,
        prospectDifficulty: roleplayAnalysis.prospectDifficulty,
        createdAt: roleplaySessions.createdAt,
        offerId: roleplaySessions.offerId,
        offerCategory: offers.offerCategory,
        offerName: offers.name,
        selectedDifficulty: roleplaySessions.selectedDifficulty,
        actualDifficultyTier: roleplaySessions.actualDifficultyTier,
      })
      .from(roleplayAnalysis)
      .innerJoin(roleplaySessions, eq(roleplayAnalysis.roleplaySessionId, roleplaySessions.id))
      .leftJoin(offers, eq(roleplaySessions.offerId, offers.id))
      .where(
        and(
          eq(roleplaySessions.userId, userId),
          gte(roleplaySessions.createdAt, startDate),
          lte(roleplaySessions.createdAt, endDate)
        )
      )
      .orderBy(desc(roleplaySessions.createdAt));

    // Parse JSON fields — with v2 fallback chain for skillScores
    const roleplayAnalyses: AnalysisRow[] = roleplayAnalysesRaw.map(a => {
      const parsedSkillScores = safeParse(a.skillScores as any);
      const parsedCategoryFeedback = safeParse(a.categoryFeedback as any);
      const parsedPhaseScores = safeParse(a.phaseScores as any);
      const isEmpty = (obj: any) => !obj || typeof obj !== 'object' || Object.keys(obj).length === 0;
      let effectiveSkillScores = parsedSkillScores;
      if (isEmpty(effectiveSkillScores) && !isEmpty(parsedCategoryFeedback)) {
        effectiveSkillScores = parsedCategoryFeedback;
      }
      if (isEmpty(effectiveSkillScores) && parsedPhaseScores) {
        effectiveSkillScores = deriveSkillScoresFromPhases(parsedPhaseScores);
      }
      return {
        overallScore: a.overallScore,
        skillScores: effectiveSkillScores,
        categoryFeedback: parsedCategoryFeedback,
        objectionData: a.objectionAnalysis,
        priorityFixesData: a.priorityFixes,
        createdAt: a.createdAt,
        type: 'roleplay' as const,
        offerId: a.offerId,
        offerCategory: a.offerCategory,
        offerName: a.offerName,
        selectedDifficulty: a.selectedDifficulty,
        actualDifficultyTier: a.actualDifficultyTier,
        entityId: a.sessionId,
        analysisId: a.id,
        phaseScoresData: parsedPhaseScores,
        phaseAnalysisData: safeParse(a.phaseAnalysis as any),
        actionPointsData: safeParse(a.actionPoints as any),
        prospectDifficultyScore: a.prospectDifficulty ?? null,
      };
    });

    // ── Combine and sort (respect source filter) ──
    const filteredCalls = sourceParam === 'roleplays' ? [] : callAnalyses;
    const filteredRoleplays = sourceParam === 'calls' ? [] : roleplayAnalyses;
    const allAnalyses = [...filteredCalls, ...filteredRoleplays]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    console.log('[Performance API] FULL DEBUG:', {
      rangeParam,
      monthParam,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalAnalyses: allAnalyses.length,
      callCount: filteredCalls.length,
      roleplayCount: filteredRoleplays.length,
      analysesSample: allAnalyses.slice(0, 2).map(a => ({
        type: a.type,
        createdAt: a.createdAt,
        overallScore: a.overallScore,
        hasSkillScores: !!a.skillScores,
        skillScoresType: typeof a.skillScores,
        skillScoresKeys: a.skillScores && typeof a.skillScores === 'object' ? Object.keys(a.skillScores).slice(0, 5) : [],
        hasCategoryFeedback: !!a.categoryFeedback,
        source: 'derived from phaseScores or categoryFeedback fallback if v2',
      })),
    });

    // ── Calculate overall averages ──
    const totalAnalyses = allAnalyses.length;
    const averageOverall = totalAnalyses > 0
      ? Math.round(allAnalyses.reduce((sum, a) => sum + (a.overallScore || 0), 0) / totalAnalyses)
      : 0;
    const roleplayOnly = allAnalyses.filter(a => a.type === 'roleplay');
    const averageRoleplayScore = roleplayOnly.length > 0
      ? Math.round(roleplayOnly.reduce((sum, a) => sum + (a.overallScore || 0), 0) / roleplayOnly.length)
      : 0;

    // ── Calculate trend ──
    let trend: 'improving' | 'declining' | 'neutral' = 'neutral';
    if (allAnalyses.length >= 4) {
      const midpoint = Math.floor(allAnalyses.length / 2);
      const firstHalf = allAnalyses.slice(midpoint);
      const secondHalf = allAnalyses.slice(0, midpoint);
      const firstHalfAvg = firstHalf.reduce((sum, a) => sum + (a.overallScore || 0), 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, a) => sum + (a.overallScore || 0), 0) / secondHalf.length;
      const diff = secondHalfAvg - firstHalfAvg;
      if (diff > 2) trend = 'improving';
      else if (diff < -2) trend = 'declining';
    }

    // ── FIX P10: Weekly chart data anchored to endDate, not now ──
    const generateWeeklyData = (analyses: AnalysisRow[]) => {
      const weekly: Array<{ week: string; score: number; count: number }> = [];
      for (let i = 11; i >= 0; i--) {
        const weekStart = new Date(endDate);
        weekStart.setDate(weekStart.getDate() - (i * 7));
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const weekAnalyses = analyses.filter(a => {
          const date = new Date(a.createdAt);
          return date >= weekStart && date < weekEnd;
        });
        const weekScore = weekAnalyses.length > 0
          ? Math.round(weekAnalyses.reduce((sum, a) => sum + (a.overallScore || 0), 0) / weekAnalyses.length)
          : 0;
        weekly.push({
          week: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          score: weekScore,
          count: weekAnalyses.length,
        });
      }
      return weekly;
    };

    const weeklyData = generateWeeklyData(allAnalyses);
    const callWeeklyData = generateWeeklyData(callAnalyses);
    const roleplayWeeklyData = generateWeeklyData(roleplayAnalyses);

    // ── FIX P4 + P7: Compute SEPARATE skill breakdowns ──
    const allSkillCategories = computeSkillBreakdown(allAnalyses, endDate);
    const callSkillCategories = computeSkillBreakdown(callAnalyses, endDate);
    const roleplaySkillCategories = computeSkillBreakdown(roleplayAnalyses, endDate);

    const callBestWorst = computeBestWorst(callSkillCategories);
    const roleplayBestWorst = computeBestWorst(roleplaySkillCategories);

    // Strengths / weaknesses (from combined for backward compat)
    const strengths = allSkillCategories.length > 0 ? allSkillCategories.slice(0, 3) : [];
    const weaknesses = allSkillCategories.length > 0 ? allSkillCategories.slice(-3).reverse() : [];

    // ── By offer type ──
    const byOfferType: Record<string, { averageScore: number; count: number }> = {};
    allAnalyses.forEach(a => {
      const category = a.offerCategory ?? 'unknown';
      const key = typeof category === 'string' ? category : 'unknown';
      if (!byOfferType[key]) byOfferType[key] = { averageScore: 0, count: 0 };
      byOfferType[key].averageScore += a.overallScore ?? 0;
      byOfferType[key].count += 1;
    });
    Object.keys(byOfferType).forEach(k => {
      const d = byOfferType[k];
      d.averageScore = d.count > 0 ? Math.round(d.averageScore / d.count) : 0;
    });

    // ── By difficulty ──
    const byDifficulty: Record<string, { averageScore: number; count: number }> = {};
    allAnalyses.forEach(a => {
      if (a.type !== 'roleplay') return;
      const tier = a.actualDifficultyTier ?? a.selectedDifficulty ?? 'unknown';
      const key = typeof tier === 'string' ? tier : 'unknown';
      if (!byDifficulty[key]) byDifficulty[key] = { averageScore: 0, count: 0 };
      byDifficulty[key].averageScore += a.overallScore ?? 0;
      byDifficulty[key].count += 1;
    });
    Object.keys(byDifficulty).forEach(k => {
      const d = byDifficulty[k];
      d.averageScore = d.count > 0 ? Math.round(d.averageScore / d.count) : 0;
    });

    // ── By offer (specific) ──
    const byOfferMap: Record<string, { name: string; total: number; count: number }> = {};
    allAnalyses.forEach(a => {
      const offerId = a.offerId;
      const name = a.offerName ?? 'Unknown';
      const key = offerId ?? 'none';
      if (!byOfferMap[key]) byOfferMap[key] = { name, total: 0, count: 0 };
      byOfferMap[key].total += a.overallScore ?? 0;
      byOfferMap[key].count += 1;
    });
    const byOffer = Object.entries(byOfferMap).map(([id, d]) => ({
      offerId: id,
      offerName: d.name,
      averageScore: d.count > 0 ? Math.round(d.total / d.count) : 0,
      count: d.count,
    })).sort((a, b) => b.averageScore - a.averageScore);

    // ── FIX P9: Objection insights with rootCause, preventionOpportunity, handlingQuality ──
    const parseObjections = (raw: string | null | undefined): any[] => {
      if (!raw) return [];
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return Array.isArray(parsed) ? parsed : [];
      } catch { return []; }
    };

    // Aggregate objection data — track extra fields per objection
    const objectionAgg: Record<string, {
      count: number;
      pillar: string;
      rootCause: string | null;
      preventionOpportunity: string | null;
      handlingQuality: number | null;
      handlingQualityTotal: number;
      handlingQualityCount: number;
    }> = {};
    const pillarHandlingScores: Record<string, { total: number; count: number }> = {};

    const processObjections = (objections: any[], source: string) => {
      for (const obj of objections) {
        const text = obj.objection || obj.text || 'Unknown';
        const pillar = obj.pillar || obj.classification || obj.objectionType || 'Unknown';
        // Extract numeric handling: call analysis has handlingQuality (0-10), roleplay has wasHandledWell (boolean)
        let handling: number | null = null;
        if (typeof obj.handlingQuality === 'number') handling = obj.handlingQuality;
        else if (typeof obj.handling === 'number') handling = obj.handling;
        else if (typeof obj.score === 'number') handling = obj.score;
        else if (typeof obj.wasHandledWell === 'boolean') handling = obj.wasHandledWell ? 7 : 3; // convert boolean to approx score
        const key = text.toLowerCase().trim();

        if (!objectionAgg[key]) {
          objectionAgg[key] = {
            count: 0,
            pillar,
            rootCause: null,
            preventionOpportunity: null,
            handlingQuality: null,
            handlingQualityTotal: 0,
            handlingQualityCount: 0,
          };
        }
        objectionAgg[key].count += 1;
        // Carry through the most recent non-null rootCause, preventionOpportunity
        if (obj.rootCause) objectionAgg[key].rootCause = obj.rootCause;
        if (obj.preventionOpportunity) objectionAgg[key].preventionOpportunity = obj.preventionOpportunity;
        // Also check roleplay's howCouldBeHandledBetter as a form of prevention/improvement
        if (!objectionAgg[key].preventionOpportunity && obj.howCouldBeHandledBetter) {
          objectionAgg[key].preventionOpportunity = obj.howCouldBeHandledBetter;
        }
        if (handling != null) {
          objectionAgg[key].handlingQualityTotal += handling;
          objectionAgg[key].handlingQualityCount += 1;
          if (!pillarHandlingScores[pillar]) pillarHandlingScores[pillar] = { total: 0, count: 0 };
          pillarHandlingScores[pillar].total += handling;
          pillarHandlingScores[pillar].count += 1;
        }
      }
    };

    // Process call and roleplay objections
    callAnalyses.forEach(a => processObjections(parseObjections(a.objectionData), 'call'));
    roleplayAnalyses.forEach(a => processObjections(parseObjections(a.objectionData), 'roleplay'));

    // Fallback root cause by pillar (for older data without rootCause)
    const PILLAR_FALLBACK_ROOT_CAUSE: Record<string, string> = {
      value: 'Value not established strongly enough before pricing discussion',
      Value: 'Value not established strongly enough before pricing discussion',
      trust: 'Insufficient rapport or credibility built earlier in the conversation',
      Trust: 'Insufficient rapport or credibility built earlier in the conversation',
      fit: 'Prospect\'s specific situation not fully explored during discovery',
      Fit: 'Prospect\'s specific situation not fully explored during discovery',
      logistics: 'Practical concerns not proactively addressed during the pitch',
      Logistics: 'Practical concerns not proactively addressed during the pitch',
    };

    // Build top objections with enriched fields
    const topObjections = Object.entries(objectionAgg)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([text, data]) => ({
        text,
        count: data.count,
        pillar: data.pillar,
        rootCause: data.rootCause ?? PILLAR_FALLBACK_ROOT_CAUSE[data.pillar] ?? undefined,
        preventionOpportunity: data.preventionOpportunity ?? undefined,
        handlingQuality: data.handlingQualityCount > 0
          ? Math.round((data.handlingQualityTotal / data.handlingQualityCount) * 10) / 10
          : undefined,
      }));

    const pillarAverages = Object.entries(pillarHandlingScores).map(([pillar, data]) => ({
      pillar,
      averageHandling: data.count > 0 ? Math.round((data.total / data.count) * 10) / 10 : 0,
      count: data.count,
    })).sort((a, b) => a.averageHandling - b.averageHandling);

    const weakestPillar = pillarAverages.length > 0 ? pillarAverages[0] : null;
    let objectionGuidance = '';
    if (weakestPillar) {
      objectionGuidance = `Your weakest objection handling is in ${weakestPillar.pillar} objections (avg ${weakestPillar.averageHandling}/10). Focus on building stronger responses to ${weakestPillar.pillar.toLowerCase()}-based concerns.`;
    } else if (topObjections.length > 0) {
      objectionGuidance = `You encounter "${topObjections[0].text}" most often (${topObjections[0].count}x). Prepare a stronger script for this objection.`;
    }

    // FIX P9: Aggregate priorityFixes into improvementActions
    // Call analysis uses: { problem, whatToDoDifferently, whenToApply, whyItMatters }
    // Roleplay uses: { whatWentWrong, whyItMattered, whatToDoDifferently, category }
    const improvementActions: Array<{ problem: string; whatToDoDifferently: string; whenToApply: string; whyItMatters: string }> = [];
    const seenProblems = new Set<string>();
    for (const analysis of allAnalyses) {
      const fixes = parseObjections(analysis.priorityFixesData); // reuse generic JSON array parser
      for (const fix of fixes) {
        // Normalize field names across call/roleplay formats
        const problem = fix.problem || fix.whatWentWrong || '';
        const whatToDo = fix.whatToDoDifferently || fix.whatToDo || '';
        const whenToApply = fix.whenToApply || (fix.category ? `During ${fix.category}` : '');
        const whyItMatters = fix.whyItMatters || fix.whyItMattered || '';
        if (problem && !seenProblems.has(problem)) {
          seenProblems.add(problem);
          improvementActions.push({ problem, whatToDoDifferently: whatToDo, whenToApply, whyItMatters });
          if (improvementActions.length >= 5) break;
        }
      }
      if (improvementActions.length >= 5) break;
    }

    const objectionInsights = topObjections.length > 0 ? {
      topObjections,
      pillarBreakdown: pillarAverages,
      weakestArea: weakestPillar ? { pillar: weakestPillar.pillar, averageHandling: weakestPillar.averageHandling } : null,
      guidance: objectionGuidance,
      improvementActions: improvementActions.length > 0 ? improvementActions : undefined,
    } : null;

    console.log('[Performance API] SkillCategories debug:', {
      totalAnalyses: allAnalyses.length,
      skillCategoriesCount: allSkillCategories.length,
      categories: allSkillCategories.map(c => ({ name: c.category, avg: c.averageScore })),
    });

    // ── Principle Summaries (B1) ──
    // Build a lookup from category display name → canonical ID
    const DISPLAY_NAME_TO_ID: Record<string, string> = {};
    for (const [id, name] of Object.entries(DISPLAY_NAMES)) {
      DISPLAY_NAME_TO_ID[name] = id;
    }

    console.log('[Performance API] DISPLAY_NAME_TO_ID mapping:', {
      mapping: Object.entries(DISPLAY_NAME_TO_ID).slice(0, 5),
      skillCatNames: allSkillCategories.map(c => c.category),
      principleRelatedCats: CORE_PRINCIPLES.map(p => ({ id: p.id, related: p.relatedCategories })),
    });

    const principleSummaries = CORE_PRINCIPLES.map((p) => {
      // Find matching skillCategories for this principle's related categories
      const matchingCats = allSkillCategories.filter((sc) => {
        const catId = DISPLAY_NAME_TO_ID[sc.category] || sc.category.toLowerCase().replace(/\s+/g, '_');
        return p.relatedCategories.includes(catId);
      });

      const score = matchingCats.length > 0
        ? Math.round(matchingCats.reduce((s, c) => s + c.averageScore, 0) / matchingCats.length)
        : 0;

      const trend = matchingCats.length > 0
        ? Math.round(matchingCats.reduce((s, c) => s + (c.trend ?? 0), 0) / matchingCats.length * 10) / 10
        : 0;

      const strengths = matchingCats.flatMap((c) => c.strengths ?? []).filter(Boolean);
      const weaknesses = matchingCats.flatMap((c) => c.weaknesses ?? []).filter(Boolean);
      const improvements = matchingCats.flatMap((c) => c.actionPoints ?? []).filter(Boolean);

      // Generate summary without AI call
      let summary: string;
      if (score === 0) {
        summary = `No data yet for ${p.name}. Complete more calls or roleplays to see insights.`;
      } else if (score >= 80) {
        summary = `Strong performance in ${p.name}. ${strengths[0] || 'Consistently scoring above target.'}`;
      } else if (score >= 60) {
        summary = `Developing competency in ${p.name}. ${strengths[0] || 'Showing progress'}, but ${weaknesses[0] || 'room for improvement remains'}.`;
      } else {
        summary = `Needs focus on ${p.name}. ${weaknesses[0] || 'Scores below target'}. Priority: ${improvements[0] || 'review techniques and practice'}.`;
      }

      return {
        id: p.id,
        name: p.name,
        description: p.description,
        score,
        trend,
        summary,
        strengths: [...new Set(strengths)].slice(0, 3),
        weaknesses: [...new Set(weaknesses)].slice(0, 3),
        improvements: [...new Set(improvements)].slice(0, 3),
      };
    });

    // ── Priority Action Steps (B2) ──
    // Extract ALL action steps from every analysis
    const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those', 'it', 'its', 'you', 'your', 'they', 'their', 'more', 'not', 'no', 'so', 'if', 'than', 'from', 'up', 'out', 'when', 'how', 'what', 'which', 'who', 'about']);

    interface ActionStepEntry {
      action: string;
      reason: string;
      source: string;
    }

    const allActionSteps: ActionStepEntry[] = [];

    for (const analysis of allAnalyses) {
      // Extract action steps from categoryFeedback
      const feedback = parseCategoryFeedbackText(analysis.categoryFeedback);
      for (const [, fb] of Object.entries(feedback)) {
        if (fb.howItAffectedOutcome) {
          const sourceName = analysis.type === 'call'
            ? `Call: ${new Date(analysis.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}`
            : `Roleplay: ${new Date(analysis.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}`;
          allActionSteps.push({
            action: fb.howItAffectedOutcome,
            reason: fb.whatWasMissing || '',
            source: sourceName,
          });
        }
      }

      // Extract from priorityFixes
      const fixes = (() => {
        if (!analysis.priorityFixesData) return [];
        try {
          const parsed = typeof analysis.priorityFixesData === 'string'
            ? JSON.parse(analysis.priorityFixesData)
            : analysis.priorityFixesData;
          return Array.isArray(parsed) ? parsed : [];
        } catch { return []; }
      })();

      for (const fix of fixes) {
        const action = fix.whatToDoDifferently || fix.whatToDo || '';
        const reason = fix.whyItMatters || fix.whyItMattered || fix.problem || '';
        if (action) {
          const sourceName = analysis.type === 'call'
            ? `Call: ${new Date(analysis.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}`
            : `Roleplay: ${new Date(analysis.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}`;
          allActionSteps.push({ action, reason, source: sourceName });
        }
      }
    }

    // Group by similarity (3+ common words after removing stop words)
    const getKeywords = (text: string): Set<string> => {
      return new Set(
        text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w))
      );
    };

    interface ActionGroup {
      action: string;
      reason: string;
      frequency: number;
      sources: Set<string>;
    }

    const groups: ActionGroup[] = [];

    for (const step of allActionSteps) {
      const stepKeywords = getKeywords(step.action);
      let matched = false;

      for (const group of groups) {
        const groupKeywords = getKeywords(group.action);
        let commonCount = 0;
        for (const kw of stepKeywords) {
          if (groupKeywords.has(kw)) commonCount++;
        }
        if (commonCount >= 3) {
          group.frequency++;
          group.sources.add(step.source);
          // Use the longer phrasing as representative
          if (step.action.length > group.action.length) {
            group.action = step.action;
          }
          if (step.reason && (!group.reason || step.reason.length > group.reason.length)) {
            group.reason = step.reason;
          }
          matched = true;
          break;
        }
      }

      if (!matched) {
        groups.push({
          action: step.action,
          reason: step.reason,
          frequency: 1,
          sources: new Set([step.source]),
        });
      }
    }

    const priorityActionSteps = groups
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 3)
      .map((g) => ({
        action: g.action,
        reason: g.reason,
        frequency: g.frequency,
        sources: [...g.sources].slice(0, 3),
      }));

    // ── AI insight ──
    const bestCat = allSkillCategories[0];
    const worstCat = allSkillCategories[allSkillCategories.length - 1];
    const difficultyKeys = Object.keys(byDifficulty);
    let aiInsight = '';
    if (bestCat && worstCat) {
      aiInsight = `You perform strongest in ${bestCat.category} (${bestCat.averageScore}) and have the most room to improve in ${worstCat.category} (${worstCat.averageScore}).`;
      if (difficultyKeys.length > 0) {
        const hardest = difficultyKeys.reduce((prev, k) =>
          (byDifficulty[k].averageScore ?? 0) < (byDifficulty[prev].averageScore ?? 0) ? k : prev
        );
        aiInsight += ` Scores are lowest on ${hardest} prospects.`;
      }
    } else if (totalAnalyses > 0) {
      aiInsight = `You have ${totalAnalyses} session(s) in this period. Keep practicing to see skill breakdowns.`;
    }

    // ── Summaries ──
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);
    const weekAnalyses = allAnalyses.filter(a => new Date(a.createdAt) >= weekAgo);
    const monthAnalyses = allAnalyses.filter(a => new Date(a.createdAt) >= thisMonthStart);
    const weekAvg = weekAnalyses.length > 0
      ? Math.round(weekAnalyses.reduce((s, a) => s + (a.overallScore ?? 0), 0) / weekAnalyses.length)
      : 0;
    const monthAvg = monthAnalyses.length > 0
      ? Math.round(monthAnalyses.reduce((s, a) => s + (a.overallScore ?? 0), 0) / monthAnalyses.length)
      : 0;
    const weeklySummary = {
      overview: `Last 7 days: ${weekAnalyses.length} session(s), average score ${weekAvg}.`,
      skillTrends: allSkillCategories.length > 0 ? `Top: ${allSkillCategories[0].category}. Focus: ${allSkillCategories[allSkillCategories.length - 1]?.category ?? 'N/A'}.` : '',
      actionPlan: ['Review lowest-scoring category', 'Practice objection handling', 'Book a roleplay session'].slice(0, 3),
    };
    const monthlySummary = {
      overview: `This month: ${monthAnalyses.length} session(s), average score ${monthAvg}.`,
      skillTrends: allSkillCategories.length > 0 ? `Best: ${allSkillCategories[0].category}. Improve: ${allSkillCategories[allSkillCategories.length - 1]?.category ?? 'N/A'}.` : '',
      actionPlan: ['Set a weekly practice goal', 'Compare scores by offer type', 'Export summary for coaching'].slice(0, 3),
    };

    // ── FIX P4: Separate summaries for calls vs roleplays ──
    const callOnly = allAnalyses.filter(a => a.type === 'call');
    const roleplayOnlyForSummary = allAnalyses.filter(a => a.type === 'roleplay');

    // Compute separate trends for calls and roleplays
    const computeTrend = (analyses: AnalysisRow[]): 'improving' | 'declining' | 'neutral' => {
      if (analyses.length < 4) return 'neutral';
      const mp = Math.floor(analyses.length / 2);
      const fh = analyses.slice(mp);
      const sh = analyses.slice(0, mp);
      const fhAvg = fh.reduce((s, a) => s + (a.overallScore || 0), 0) / fh.length;
      const shAvg = sh.reduce((s, a) => s + (a.overallScore || 0), 0) / sh.length;
      const d = shAvg - fhAvg;
      if (d > 2) return 'improving';
      if (d < -2) return 'declining';
      return 'neutral';
    };

    const salesCallsSummary = {
      totalCalls: callAnalyses.length,
      averageOverall: callOnly.length > 0 ? Math.round(callOnly.reduce((s, a) => s + (a.overallScore ?? 0), 0) / callOnly.length) : 0,
      ...callBestWorst,
      trend: computeTrend(callOnly),
    };
    const roleplaysSummary = {
      totalRoleplays: roleplayAnalyses.length,
      averageRoleplayScore: roleplayOnlyForSummary.length > 0 ? Math.round(roleplayOnlyForSummary.reduce((s, a) => s + (a.overallScore ?? 0), 0) / roleplayOnlyForSummary.length) : 0,
      ...roleplayBestWorst,
      trend: computeTrend(roleplayOnlyForSummary),
    };

    // ══════════════════════════════════════════════════════════
    // V2: Phase-based aggregation engine
    // ══════════════════════════════════════════════════════════

    const PHASE_KEYS = ['intro', 'discovery', 'pitch', 'close', 'objections'] as const;
    type PhaseKey = typeof PHASE_KEYS[number];

    // ── V2 Snapshot ─────────────────────────────────────────
    // Close rate: calls with result='closed' / total calls with a result
    const callsWithResult = allAnalyses.filter(a => a.type === 'call' && (a as any).callResult);
    const closedCalls = callsWithResult.filter(a => (a as any).callResult === 'closed');
    const closeRate = callsWithResult.length > 0
      ? Math.round((closedCalls.length / callsWithResult.length) * 100)
      : null;

    // Avg difficulty
    const diffScores = allAnalyses.filter(a => typeof a.prospectDifficultyScore === 'number' && a.prospectDifficultyScore > 0).map(a => a.prospectDifficultyScore!);
    const avgDifficulty = diffScores.length > 0 ? Math.round(diffScores.reduce((s, d) => s + d, 0) / diffScores.length) : null;
    const avgDifficultyTier = avgDifficulty !== null
      ? (avgDifficulty >= 41 ? 'easy' : avgDifficulty >= 32 ? 'realistic' : avgDifficulty >= 20 ? 'hard' : 'expert')
      : null;

    // Objection conversion rate: calls WITH objections that still closed
    const analysesWithObjections = allAnalyses.filter(a => {
      const objs = parseObjections(a.objectionData);
      return objs.length > 0;
    });
    const objectionCallsThatClosed = analysesWithObjections.filter(a => a.type === 'call' && (a as any).callResult === 'closed');
    const objectionConversionRate = analysesWithObjections.length > 0
      ? Math.round((objectionCallsThatClosed.length / analysesWithObjections.length) * 100)
      : null;

    const v2Snapshot = {
      overallScore: averageOverall,
      closeRate,
      avgDifficulty,
      avgDifficultyTier,
      objectionConversionRate,
      totalSessions: totalAnalyses,
    };

    // ── V2 Phase tabs ───────────────────────────────────────
    interface V2PhaseTab {
      phase: string;
      averageScore: number;
      sessionCount: number;
      summary: string;
      strengthPatterns: Array<{ text: string; frequency: number }>;
      weaknessPatterns: Array<{ text: string; frequency: number; whyItMatters?: string; whatToChange?: string }>;
      scoreGuidance: string;
    }

    function buildPhaseTab(phase: PhaseKey | 'overall', analyses: AnalysisRow[]): V2PhaseTab {
      // Collect scores for this phase
      const scores: number[] = [];
      const summaries: string[] = [];
      const strengths: string[] = [];
      const weaknesses: Array<{ text: string; why?: string; change?: string }> = [];

      for (const a of analyses) {
        const ps = a.phaseScoresData;
        const pa = a.phaseAnalysisData;
        if (!ps && !pa) continue;

        // Score
        if (ps && typeof ps === 'object') {
          const score = phase === 'overall' ? (ps.overall ?? a.overallScore) : ps[phase];
          if (typeof score === 'number' && score > 0) scores.push(score);
        }

        // Phase analysis
        if (pa && typeof pa === 'object') {
          const phaseDetail = phase === 'overall' ? pa.overall : pa[phase];
          if (!phaseDetail) continue;

          if (phase === 'overall') {
            // Overall has callOutcomeAndWhy, whatLimited, primaryImprovementFocus
            if (phaseDetail.primaryImprovementFocus) {
              weaknesses.push({ text: phaseDetail.primaryImprovementFocus });
            }
            if (phaseDetail.summary) summaries.push(phaseDetail.summary);
          } else if (phase === 'objections') {
            // Objections have blocks
            if (phaseDetail.blocks && Array.isArray(phaseDetail.blocks)) {
              for (const block of phaseDetail.blocks) {
                if (block.higherLeverageAlternative) {
                  weaknesses.push({ text: block.howHandled || 'Objection handling', why: block.whySurfaced, change: block.higherLeverageAlternative });
                }
              }
            }
          } else {
            // Intro/Discovery/Pitch/Close have whatWorked, whatLimitedImpact, summary
            if (phaseDetail.summary) summaries.push(phaseDetail.summary);

            if (Array.isArray(phaseDetail.whatWorked)) {
              for (const item of phaseDetail.whatWorked) {
                if (typeof item === 'string' && item.length > 10) strengths.push(item);
              }
            }

            if (Array.isArray(phaseDetail.whatLimitedImpact)) {
              for (const item of phaseDetail.whatLimitedImpact) {
                if (typeof item === 'string') {
                  weaknesses.push({ text: item });
                } else if (item && typeof item === 'object') {
                  weaknesses.push({
                    text: item.description || '',
                    change: item.whatShouldHaveDone || '',
                  });
                }
              }
            }
          }
        }
      }

      const avgScore = scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;

      // Frequency-count strength patterns (group by semantic similarity using keyword overlap)
      const strengthGroups = groupByKeywords(strengths);
      const weaknessGroups = groupWeaknessByKeywords(weaknesses);

      // Generate guidance
      let scoreGuidance = '';
      if (avgScore === 0) {
        scoreGuidance = `No data yet for ${phase === 'overall' ? 'overall performance' : phase}. Complete more sessions to see insights.`;
      } else if (avgScore >= 80) {
        scoreGuidance = `Strong ${phase} performance averaging ${avgScore}/100. Focus on consistency and marginal gains.`;
      } else if (avgScore >= 60) {
        scoreGuidance = `Developing ${phase} skills at ${avgScore}/100. Address the top weakness pattern to push above 80.`;
      } else {
        scoreGuidance = `${phase === 'overall' ? 'Overall' : phase.charAt(0).toUpperCase() + phase.slice(1)} needs focused practice at ${avgScore}/100. Prioritize the most frequent weakness below.`;
      }

      // Pick best summary (most recent non-empty)
      const bestSummary = summaries.filter(s => s.length > 20)[0] || '';

      return {
        phase,
        averageScore: avgScore,
        sessionCount: scores.length,
        summary: bestSummary,
        strengthPatterns: strengthGroups.slice(0, 5),
        weaknessPatterns: weaknessGroups.slice(0, 5),
        scoreGuidance,
      };
    }

    // Keyword grouping helpers
    const V2_STOP = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'it', 'its', 'you', 'your', 'they', 'their', 'not', 'so', 'if', 'from']);
    const getKW = (text: string) => new Set(text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !V2_STOP.has(w)));

    function groupByKeywords(items: string[]): Array<{ text: string; frequency: number }> {
      const groups: Array<{ text: string; frequency: number }> = [];
      for (const item of items) {
        if (!item || item.length < 10) continue;
        const kw = getKW(item);
        let matched = false;
        for (const g of groups) {
          const gkw = getKW(g.text);
          let common = 0;
          for (const k of kw) { if (gkw.has(k)) common++; }
          if (common >= 3) {
            g.frequency++;
            if (item.length > g.text.length) g.text = item;
            matched = true;
            break;
          }
        }
        if (!matched) groups.push({ text: item, frequency: 1 });
      }
      return groups.sort((a, b) => b.frequency - a.frequency);
    }

    function groupWeaknessByKeywords(items: Array<{ text: string; why?: string; change?: string }>): Array<{ text: string; frequency: number; whyItMatters?: string; whatToChange?: string }> {
      const groups: Array<{ text: string; frequency: number; whyItMatters?: string; whatToChange?: string }> = [];
      for (const item of items) {
        if (!item.text || item.text.length < 10) continue;
        const kw = getKW(item.text);
        let matched = false;
        for (const g of groups) {
          const gkw = getKW(g.text);
          let common = 0;
          for (const k of kw) { if (gkw.has(k)) common++; }
          if (common >= 3) {
            g.frequency++;
            if (item.text.length > g.text.length) g.text = item.text;
            if (item.why && (!g.whyItMatters || item.why.length > g.whyItMatters.length)) g.whyItMatters = item.why;
            if (item.change && (!g.whatToChange || item.change.length > g.whatToChange.length)) g.whatToChange = item.change;
            matched = true;
            break;
          }
        }
        if (!matched) groups.push({ text: item.text, frequency: 1, whyItMatters: item.why, whatToChange: item.change });
      }
      return groups.sort((a, b) => b.frequency - a.frequency);
    }

    // Build phase tabs
    const v2Phases: Record<string, V2PhaseTab> = {};
    v2Phases['overall'] = buildPhaseTab('overall', allAnalyses);
    for (const phase of PHASE_KEYS) {
      v2Phases[phase] = buildPhaseTab(phase, allAnalyses);
    }

    // ── V2 Objections tab (grouped by category) ─────────────
    const v2ObjGrouped: Record<string, Array<{ text: string; frequency: number; howHandled?: string; whySurfaced?: string; higherLeverageAlt?: string }>> = {
      value: [], trust: [], fit: [], logistics: [],
    };
    for (const a of allAnalyses) {
      const pa = a.phaseAnalysisData;
      if (!pa?.objections?.blocks) continue;
      for (const block of pa.objections.blocks) {
        const cat = block.type || 'value';
        if (!v2ObjGrouped[cat]) v2ObjGrouped[cat] = [];

        // Try to group with existing
        const existing = v2ObjGrouped[cat].find(o => {
          const ok = getKW(o.text);
          const bk = getKW(block.quote || '');
          let common = 0;
          for (const k of bk) { if (ok.has(k)) common++; }
          return common >= 2;
        });
        if (existing) {
          existing.frequency++;
          if (block.higherLeverageAlternative && (!existing.higherLeverageAlt || block.higherLeverageAlternative.length > existing.higherLeverageAlt.length)) {
            existing.higherLeverageAlt = block.higherLeverageAlternative;
          }
        } else {
          v2ObjGrouped[cat].push({
            text: block.quote || 'Unnamed objection',
            frequency: 1,
            howHandled: block.howHandled,
            whySurfaced: block.whySurfaced,
            higherLeverageAlt: block.higherLeverageAlternative,
          });
        }
      }
    }
    // Sort each category by frequency
    for (const cat of Object.keys(v2ObjGrouped)) {
      v2ObjGrouped[cat].sort((a, b) => b.frequency - a.frequency);
    }

    // ── V2 Priority Action Plan (max 3, deduped across all calls) ──
    const v2ActionPlan: Array<{ title: string; observedCount: number; impact: string; whatToChange: string; microDrill?: string }> = [];
    const actionSeen = new Set<string>();
    for (const a of allAnalyses) {
      const ap = Array.isArray(a.actionPointsData) ? a.actionPointsData : [];
      for (const point of ap) {
        const label = point.label || point.thePattern?.slice(0, 60) || 'Unnamed';
        const labelKey = label.toLowerCase().replace(/[^a-z]/g, '').slice(0, 30);
        if (actionSeen.has(labelKey)) continue;
        actionSeen.add(labelKey);
        v2ActionPlan.push({
          title: label,
          observedCount: 1,
          impact: point.whyItsCostingYou || '',
          whatToChange: point.whatToDoInstead || '',
          microDrill: point.microDrill || undefined,
        });
        if (v2ActionPlan.length >= 3) break;
      }
      if (v2ActionPlan.length >= 3) break;
    }

    // Fallback: if no v2 actionPoints, fall back to existing priorityActionSteps
    if (v2ActionPlan.length === 0 && priorityActionSteps.length > 0) {
      for (const step of priorityActionSteps.slice(0, 3)) {
        v2ActionPlan.push({
          title: step.action.slice(0, 80),
          observedCount: step.frequency,
          impact: step.reason,
          whatToChange: step.action,
        });
      }
    }

    const v2Data = {
      snapshot: v2Snapshot,
      phases: v2Phases,
      objectionsGrouped: v2ObjGrouped,
      priorityActionPlan: v2ActionPlan,
    };

    return NextResponse.json({
      range: rangeLabel ?? rangeParam,
      period: periodLabel,
      totalAnalyses,
      totalCalls: callAnalyses.length,
      totalRoleplays: roleplayAnalyses.length,
      averageOverall,
      averageRoleplayScore,
      trend,
      salesCallsSummary,
      roleplaysSummary,
      weeklyData,
      callWeeklyData,
      roleplayWeeklyData,
      skillCategories: allSkillCategories,
      principleSummaries,
      priorityActionSteps,
      strengths,
      weaknesses,
      byOfferType,
      byDifficulty,
      byOffer,
      objectionInsights,
      aiInsight,
      weeklySummary,
      monthlySummary,
      recentAnalyses: allAnalyses.slice(0, 10).map(a => ({
        id: a.entityId ?? a.analysisId ?? '',
        type: a.type,
        overallScore: a.overallScore,
        createdAt: a.createdAt,
        difficultyTier: a.actualDifficultyTier ?? a.selectedDifficulty ?? null,
      })),
      // V2 Performance data — phase-based analysis engine
      v2: v2Data,
    });
  } catch (error) {
    console.error('Error fetching performance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch performance data' },
      { status: 500 }
    );
  }
}
