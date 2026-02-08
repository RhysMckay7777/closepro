import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { salesCalls, callAnalysis, roleplaySessions, roleplayAnalysis, offers } from '@/db/schema';
import { eq, and, gte, lt, lte, desc, sql } from 'drizzle-orm';
import { SALES_CATEGORIES, getCategoryLabel } from '@/lib/ai/scoring-framework';

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

    const userId = session.user.id;

    // Fetch call analyses (optionally with offer for breakdowns if column exists)
    const callAnalysesRaw = await db
      .select({
        id: callAnalysis.id,
        callId: salesCalls.id,
        overallScore: callAnalysis.overallScore,
        valueScore: callAnalysis.valueScore,
        trustScore: callAnalysis.trustScore,
        fitScore: callAnalysis.fitScore,
        logisticsScore: callAnalysis.logisticsScore,
        skillScores: callAnalysis.skillScores,
        objectionDetails: callAnalysis.objectionDetails,
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

    // Parse skillScores from JSON strings
    const callAnalyses = callAnalysesRaw.map(analysis => {
      let parsedSkillScores = null;
      if (analysis.skillScores) {
        try {
          parsedSkillScores = typeof analysis.skillScores === 'string'
            ? JSON.parse(analysis.skillScores)
            : analysis.skillScores;
        } catch (e) {
          // Invalid JSON, keep as null
        }
      }
      return {
        ...analysis,
        skillScores: parsedSkillScores,
      };
    });

    // Fetch roleplay analyses with offer and difficulty
    const roleplayAnalysesRaw = await db
      .select({
        id: roleplayAnalysis.id,
        sessionId: roleplaySessions.id,
        overallScore: roleplayAnalysis.overallScore,
        valueScore: roleplayAnalysis.valueScore,
        trustScore: roleplayAnalysis.trustScore,
        fitScore: roleplayAnalysis.fitScore,
        logisticsScore: roleplayAnalysis.logisticsScore,
        skillScores: roleplayAnalysis.skillScores,
        objectionAnalysis: roleplayAnalysis.objectionAnalysis,
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

    // Parse skillScores from JSON strings
    const roleplayAnalyses = roleplayAnalysesRaw.map(analysis => {
      let parsedSkillScores = null;
      if (analysis.skillScores) {
        try {
          parsedSkillScores = typeof analysis.skillScores === 'string'
            ? JSON.parse(analysis.skillScores)
            : analysis.skillScores;
        } catch (e) {
          // Invalid JSON, keep as null
        }
      }
      return {
        ...analysis,
        skillScores: parsedSkillScores,
      };
    });

    // Combine and sort all analyses
    const allAnalyses = [
      ...callAnalyses.map(a => ({ ...a, type: 'call' as const })),
      ...roleplayAnalyses.map(a => ({ ...a, type: 'roleplay' as const })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Calculate averages
    const totalAnalyses = allAnalyses.length;
    const averageOverall = totalAnalyses > 0
      ? Math.round(allAnalyses.reduce((sum, a) => sum + (a.overallScore || 0), 0) / totalAnalyses)
      : 0;
    const roleplayOnly = allAnalyses.filter(a => a.type === 'roleplay');
    const averageRoleplayScore = roleplayOnly.length > 0
      ? Math.round(roleplayOnly.reduce((sum, a) => sum + (a.overallScore || 0), 0) / roleplayOnly.length)
      : 0;
    const averageValue = totalAnalyses > 0
      ? Math.round(allAnalyses.reduce((sum, a) => sum + (a.valueScore || 0), 0) / totalAnalyses)
      : 0;
    const averageTrust = totalAnalyses > 0
      ? Math.round(allAnalyses.reduce((sum, a) => sum + (a.trustScore || 0), 0) / totalAnalyses)
      : 0;
    const averageFit = totalAnalyses > 0
      ? Math.round(allAnalyses.reduce((sum, a) => sum + (a.fitScore || 0), 0) / totalAnalyses)
      : 0;
    const averageLogistics = totalAnalyses > 0
      ? Math.round(allAnalyses.reduce((sum, a) => sum + (a.logisticsScore || 0), 0) / totalAnalyses)
      : 0;

    // Calculate trend (compare first half vs second half)
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

    // Group by time periods for chart data (last 12 weeks)
    const weeklyData: Array<{ week: string; score: number; count: number }> = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i * 7));
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekAnalyses = allAnalyses.filter(a => {
        const date = new Date(a.createdAt);
        return date >= weekStart && date < weekEnd;
      });

      const weekScore = weekAnalyses.length > 0
        ? Math.round(weekAnalyses.reduce((sum, a) => sum + (a.overallScore || 0), 0) / weekAnalyses.length)
        : 0;

      weeklyData.push({
        week: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        score: weekScore,
        count: weekAnalyses.length,
      });
    }

    // Calculate skill category averages
    const skillCategoryScores: Record<string, { total: number; count: number }> = {};

    allAnalyses.forEach(analysis => {
      const skillScoresData = analysis.skillScores;

      if (skillScoresData) {
        // Handle array format
        if (Array.isArray(skillScoresData)) {
          skillScoresData.forEach((skill: any) => {
            if (skill?.category) {
              const category = skill.category;
              const subSkills = skill.subSkills || {};
              const subSkillValues = Object.values(subSkills) as number[];
              const avg = subSkillValues.length > 0
                ? subSkillValues.reduce((sum, v) => sum + v, 0) / subSkillValues.length
                : 0;

              if (!skillCategoryScores[category]) {
                skillCategoryScores[category] = { total: 0, count: 0 };
              }
              skillCategoryScores[category].total += avg;
              skillCategoryScores[category].count += 1;
            }
          });
        } else if (typeof skillScoresData === 'object') {
          // Handle object format
          Object.values(skillScoresData).forEach((skill: any) => {
            if (skill?.category) {
              const category = skill.category;
              const subSkills = skill.subSkills || {};
              const subSkillValues = Object.values(subSkills) as number[];
              const avg = subSkillValues.length > 0
                ? subSkillValues.reduce((sum, v) => sum + v, 0) / subSkillValues.length
                : 0;

              if (!skillCategoryScores[category]) {
                skillCategoryScores[category] = { total: 0, count: 0 };
              }
              skillCategoryScores[category].total += avg;
              skillCategoryScores[category].count += 1;
            }
          });
        }
      }
    });

    // Average skill categories with trend (first half vs second half within period)
    const categoryScoresByAnalysis: Array<Record<string, number>> = [];
    allAnalyses.forEach(analysis => {
      const row: Record<string, number> = {};
      const skillScoresData = analysis.skillScores;
      if (skillScoresData && typeof skillScoresData === 'object' && !Array.isArray(skillScoresData)) {
        const entries = Object.entries(skillScoresData);
        if (entries.length > 0 && typeof entries[0][1] === 'number') {
          entries.forEach(([id, score]) => {
            const category = getCategoryLabel(id);
            row[category] = (typeof score === 'number' ? score : 0) * 10;
          });
        }
      }
      if (Object.keys(row).length === 0 && skillScoresData && Array.isArray(skillScoresData)) {
        skillScoresData.forEach((skill: { category?: string; subSkills?: Record<string, number> }) => {
          if (skill?.category) {
            const subSkillValues = Object.values(skill.subSkills || {}) as number[];
            row[skill.category] = subSkillValues.length > 0
              ? subSkillValues.reduce((s, v) => s + v, 0) / subSkillValues.length
              : 0;
          }
        });
      }
      categoryScoresByAnalysis.push(row);
    });
    const midpoint = Math.floor(allAnalyses.length / 2);
    const firstHalfRows = categoryScoresByAnalysis.slice(midpoint);
    const secondHalfRows = categoryScoresByAnalysis.slice(0, midpoint);
    const categoryTrends: Record<string, number> = {};
    Object.keys(skillCategoryScores).forEach(cat => {
      const firstAvg = firstHalfRows.filter(r => r[cat] != null).length > 0
        ? firstHalfRows.reduce((s, r) => s + (r[cat] ?? 0), 0) / firstHalfRows.filter(r => r[cat] != null).length
        : 0;
      const secondAvg = secondHalfRows.filter(r => r[cat] != null).length > 0
        ? secondHalfRows.reduce((s, r) => s + (r[cat] ?? 0), 0) / secondHalfRows.filter(r => r[cat] != null).length
        : 0;
      categoryTrends[cat] = Math.round((secondAvg - firstAvg) * 10) / 10;
    });

    const skillCategories = Object.entries(skillCategoryScores).map(([category, data]) => ({
      category,
      averageScore: Math.round(data.total / (data.count || 1)),
      trend: (categoryTrends[category] ?? 0) as number,
    })).sort((a, b) => b.averageScore - a.averageScore);

    // If no skill categories, use pillar scores as fallback
    let strengths: Array<{ category: string; averageScore: number }> = [];
    let weaknesses: Array<{ category: string; averageScore: number }> = [];

    if (skillCategories.length > 0) {
      strengths = skillCategories.slice(0, 3);
      weaknesses = skillCategories.slice(-3).reverse();
    } else if (totalAnalyses > 0) {
      const pillarScores = [
        { category: 'Value', averageScore: averageValue },
        { category: 'Trust', averageScore: averageTrust },
        { category: 'Fit', averageScore: averageFit },
        { category: 'Logistics', averageScore: averageLogistics },
      ].sort((a, b) => b.averageScore - a.averageScore);

      strengths = pillarScores.slice(0, 2).filter(p => p.averageScore > 0);
      weaknesses = pillarScores.slice(-2).reverse().filter(p => p.averageScore > 0);
    }

    // By offer type (offer category)
    const byOfferType: Record<string, { averageScore: number; count: number }> = {};
    allAnalyses.forEach(a => {
      const category = (a as any).offerType ?? (a as any).offerCategory ?? 'unknown';
      const key = typeof category === 'string' ? category : 'unknown';
      if (!byOfferType[key]) byOfferType[key] = { averageScore: 0, count: 0 };
      byOfferType[key].averageScore += a.overallScore ?? 0;
      byOfferType[key].count += 1;
    });
    Object.keys(byOfferType).forEach(k => {
      const d = byOfferType[k];
      d.averageScore = d.count > 0 ? Math.round(d.averageScore / d.count) : 0;
    });

    // By difficulty (roleplay only; calls don't have difficulty in this query)
    const byDifficulty: Record<string, { averageScore: number; count: number }> = {};
    allAnalyses.forEach(a => {
      if (a.type !== 'roleplay') return;
      const tier = (a as any).actualDifficultyTier ?? (a as any).selectedDifficulty ?? 'unknown';
      const key = typeof tier === 'string' ? tier : 'unknown';
      if (!byDifficulty[key]) byDifficulty[key] = { averageScore: 0, count: 0 };
      byDifficulty[key].averageScore += a.overallScore ?? 0;
      byDifficulty[key].count += 1;
    });
    Object.keys(byDifficulty).forEach(k => {
      const d = byDifficulty[k];
      d.averageScore = d.count > 0 ? Math.round(d.averageScore / d.count) : 0;
    });

    // By offer (specific offer)
    const byOffer: Array<{ offerId: string; offerName: string; averageScore: number; count: number }> = [];
    const byOfferMap: Record<string, { name: string; total: number; count: number }> = {};
    allAnalyses.forEach(a => {
      const offerId = (a as any).offerId;
      const name = (a as any).offerName ?? 'Unknown';
      const key = offerId ?? 'none';
      if (!byOfferMap[key]) byOfferMap[key] = { name, total: 0, count: 0 };
      byOfferMap[key].total += a.overallScore ?? 0;
      byOfferMap[key].count += 1;
    });
    Object.entries(byOfferMap).forEach(([id, d]) => {
      byOffer.push({
        offerId: id,
        offerName: d.name,
        averageScore: d.count > 0 ? Math.round(d.total / d.count) : 0,
        count: d.count,
      });
    });
    byOffer.sort((a, b) => b.averageScore - a.averageScore);

    // Objection insights — aggregate from objectionDetails (calls) and objectionAnalysis (roleplays)
    const objectionCounts: Record<string, { count: number; pillar: string }> = {};
    const pillarHandlingScores: Record<string, { total: number; count: number }> = {};

    const parseObjections = (raw: string | null | undefined): any[] => {
      if (!raw) return [];
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return Array.isArray(parsed) ? parsed : [];
      } catch { return []; }
    };

    // Process call objection data
    callAnalyses.forEach(a => {
      const objections = parseObjections((a as any).objectionDetails);
      objections.forEach((obj: any) => {
        const text = obj.objection || obj.text || 'Unknown';
        const pillar = obj.pillar || obj.classification || 'Unknown';
        const handling = typeof obj.handling === 'number' ? obj.handling : (typeof obj.score === 'number' ? obj.score : null);
        const key = text.toLowerCase().trim();
        if (!objectionCounts[key]) objectionCounts[key] = { count: 0, pillar };
        objectionCounts[key].count += 1;
        if (handling != null) {
          if (!pillarHandlingScores[pillar]) pillarHandlingScores[pillar] = { total: 0, count: 0 };
          pillarHandlingScores[pillar].total += handling;
          pillarHandlingScores[pillar].count += 1;
        }
      });
    });

    // Process roleplay objection data
    roleplayAnalyses.forEach(a => {
      const objections = parseObjections((a as any).objectionAnalysis);
      objections.forEach((obj: any) => {
        const text = obj.objection || obj.text || 'Unknown';
        const pillar = obj.pillar || obj.classification || 'Unknown';
        const handling = typeof obj.handling === 'number' ? obj.handling : (typeof obj.score === 'number' ? obj.score : null);
        const key = text.toLowerCase().trim();
        if (!objectionCounts[key]) objectionCounts[key] = { count: 0, pillar };
        objectionCounts[key].count += 1;
        if (handling != null) {
          if (!pillarHandlingScores[pillar]) pillarHandlingScores[pillar] = { total: 0, count: 0 };
          pillarHandlingScores[pillar].total += handling;
          pillarHandlingScores[pillar].count += 1;
        }
      });
    });

    // Build objection insights
    const topObjections = Object.entries(objectionCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([text, data]) => ({ text, count: data.count, pillar: data.pillar }));

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

    const objectionInsights = topObjections.length > 0 ? {
      topObjections,
      pillarBreakdown: pillarAverages,
      weakestArea: weakestPillar ? { pillar: weakestPillar.pillar, averageHandling: weakestPillar.averageHandling } : null,
      guidance: objectionGuidance,
    } : null;

    // AI insight (template-driven from top/bottom categories and difficulty)
    const bestCat = skillCategories[0];
    const worstCat = skillCategories[skillCategories.length - 1];
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

    // Weekly summary (last 7 days) and monthly summary (current month) - template-driven
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
      skillTrends: skillCategories.length > 0 ? `Top: ${skillCategories[0].category}. Focus: ${skillCategories[skillCategories.length - 1]?.category ?? 'N/A'}.` : '',
      actionPlan: ['Review lowest-scoring category', 'Practice objection handling', 'Book a roleplay session'].slice(0, 3),
    };
    const monthlySummary = {
      overview: `This month: ${monthAnalyses.length} session(s), average score ${monthAvg}.`,
      skillTrends: skillCategories.length > 0 ? `Best: ${skillCategories[0].category}. Improve: ${skillCategories[skillCategories.length - 1]?.category ?? 'N/A'}.` : '',
      actionPlan: ['Set a weekly practice goal', 'Compare scores by offer type', 'Export summary for coaching'].slice(0, 3),
    };

    const callOnly = allAnalyses.filter(a => a.type === 'call');
    const roleplayOnlyForSummary = allAnalyses.filter(a => a.type === 'roleplay');
    const salesCallsSummary = {
      totalCalls: callAnalyses.length,
      averageOverall: callOnly.length > 0 ? Math.round(callOnly.reduce((s, a) => s + (a.overallScore ?? 0), 0) / callOnly.length) : 0,
      bestCategory: skillCategories.length > 0 ? skillCategories[0].category : null,
      improvementOpportunity: skillCategories.length > 0 ? skillCategories[skillCategories.length - 1].category : null,
      trend,
    };
    const roleplaysSummary = {
      totalRoleplays: roleplayAnalyses.length,
      averageRoleplayScore: roleplayOnlyForSummary.length > 0 ? Math.round(roleplayOnlyForSummary.reduce((s, a) => s + (a.overallScore ?? 0), 0) / roleplayOnlyForSummary.length) : 0,
      bestCategory: skillCategories.length > 0 ? skillCategories[0].category : null,
      improvementOpportunity: skillCategories.length > 0 ? skillCategories[skillCategories.length - 1].category : null,
      trend,
    };

    return NextResponse.json({
      range: rangeLabel ?? rangeParam,
      period: periodLabel,
      totalAnalyses,
      totalCalls: callAnalyses.length,
      totalRoleplays: roleplayAnalyses.length,
      averageOverall,
      averageRoleplayScore,
      averageValue,
      averageTrust,
      averageFit,
      averageLogistics,
      trend,
      salesCallsSummary,
      roleplaysSummary,
      weeklyData,
      skillCategories,
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
        id: a.type === 'call' ? (a as any).callId : (a as any).sessionId ?? a.id,
        type: a.type,
        overallScore: a.overallScore,
        createdAt: a.createdAt,
        difficultyTier: (a as any).actualDifficultyTier ?? (a as any).selectedDifficulty ?? null,
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
