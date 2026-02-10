import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { salesCalls, callAnalysis, roleplaySessions, roleplayAnalysis, offers } from '@/db/schema';
import { eq, and, gte, lt, lte, desc, sql } from 'drizzle-orm';
import { SCORING_CATEGORIES, CATEGORY_LABELS, type ScoringCategoryId } from '@/lib/training/scoring-categories';

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

  for (const analysis of analyses) {
    const scores = parseSkillScoresFlat(analysis.skillScores);
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
    // Support both 'range=this_month' and 'month=2026-02' formats
    const monthParam = searchParams.get('month');
    const rangeParam = monthParam || searchParams.get('range') || searchParams.get('days') || 'this_month';
    const rangeLabel =
      ['this_week', 'this_month', 'last_month', 'last_quarter', 'last_year'].includes(rangeParam)
        ? rangeParam
        : undefined;
    const { start: startDate, end: endDate, label: periodLabel } = getRangeDates(rangeParam);
    const sourceParam = searchParams.get('source'); // 'calls' | 'roleplays' | null (all)
    console.log('[Performance API] Params:', { monthParam, rangeParam, sourceParam, startDate: startDate.toISOString(), endDate: endDate.toISOString(), periodLabel });

    const userId = session.user.id;

    // ── Fetch call analyses (with categoryFeedback + priorityFixes) ──
    const callAnalysesRaw = await db
      .select({
        id: callAnalysis.id,
        callId: salesCalls.id,
        overallScore: callAnalysis.overallScore,
        skillScores: callAnalysis.skillScores,
        categoryFeedback: callAnalysis.categoryFeedback,
        objectionDetails: callAnalysis.objectionDetails,
        priorityFixes: callAnalysis.priorityFixes,
        createdAt: salesCalls.createdAt,
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

    // Parse JSON fields
    const callAnalyses: AnalysisRow[] = callAnalysesRaw.map(a => ({
      overallScore: a.overallScore,
      skillScores: safeParse(a.skillScores as any),
      categoryFeedback: safeParse(a.categoryFeedback as any),
      objectionData: a.objectionDetails,
      priorityFixesData: a.priorityFixes,
      createdAt: a.createdAt,
      type: 'call' as const,
      entityId: a.callId,
      analysisId: a.id,
    }));

    // ── Fetch roleplay analyses (with categoryFeedback + priorityFixes) ──
    const roleplayAnalysesRaw = await db
      .select({
        id: roleplayAnalysis.id,
        sessionId: roleplaySessions.id,
        overallScore: roleplayAnalysis.overallScore,
        skillScores: roleplayAnalysis.skillScores,
        categoryFeedback: roleplayAnalysis.categoryFeedback,
        objectionAnalysis: roleplayAnalysis.objectionAnalysis,
        priorityFixes: roleplayAnalysis.priorityFixes,
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

    // Parse JSON fields
    const roleplayAnalyses: AnalysisRow[] = roleplayAnalysesRaw.map(a => ({
      overallScore: a.overallScore,
      skillScores: safeParse(a.skillScores as any),
      categoryFeedback: safeParse(a.categoryFeedback as any),
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
    }));

    // ── Combine and sort (respect source filter) ──
    const filteredCalls = sourceParam === 'roleplays' ? [] : callAnalyses;
    const filteredRoleplays = sourceParam === 'calls' ? [] : roleplayAnalyses;
    const allAnalyses = [...filteredCalls, ...filteredRoleplays]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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
    });
  } catch (error) {
    console.error('Error fetching performance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch performance data' },
      { status: 500 }
    );
  }
}
