import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { salesCalls, callAnalysis, roleplaySessions, roleplayAnalysis } from '@/db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';

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
    const days = parseInt(searchParams.get('days') || '30');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const userId = session.user.id;

    // Fetch call analyses
    const callAnalysesRaw = await db
      .select({
        id: callAnalysis.id,
        overallScore: callAnalysis.overallScore,
        valueScore: callAnalysis.valueScore,
        trustScore: callAnalysis.trustScore,
        fitScore: callAnalysis.fitScore,
        logisticsScore: callAnalysis.logisticsScore,
        skillScores: callAnalysis.skillScores,
        createdAt: salesCalls.createdAt,
      })
      .from(callAnalysis)
      .innerJoin(salesCalls, eq(callAnalysis.callId, salesCalls.id))
      .where(
        and(
          eq(salesCalls.userId, userId),
          gte(salesCalls.createdAt, startDate)
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

    // Fetch roleplay analyses
    const roleplayAnalysesRaw = await db
      .select({
        id: roleplayAnalysis.id,
        overallScore: roleplayAnalysis.overallScore,
        valueScore: roleplayAnalysis.valueScore,
        trustScore: roleplayAnalysis.trustScore,
        fitScore: roleplayAnalysis.fitScore,
        logisticsScore: roleplayAnalysis.logisticsScore,
        skillScores: roleplayAnalysis.skillScores,
        createdAt: roleplaySessions.createdAt,
      })
      .from(roleplayAnalysis)
      .innerJoin(roleplaySessions, eq(roleplayAnalysis.roleplaySessionId, roleplaySessions.id))
      .where(
        and(
          eq(roleplaySessions.userId, userId),
          gte(roleplaySessions.createdAt, startDate)
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

    // Group by time periods for chart data
    const weeklyData: Array<{ week: string; score: number; count: number }> = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
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

    // Average skill categories
    const skillCategories = Object.entries(skillCategoryScores).map(([category, data]) => ({
      category,
      averageScore: Math.round(data.total / (data.count || 1)),
    })).sort((a, b) => b.averageScore - a.averageScore);

    // If no skill categories, use pillar scores as fallback
    let strengths: Array<{ category: string; averageScore: number }> = [];
    let weaknesses: Array<{ category: string; averageScore: number }> = [];

    if (skillCategories.length > 0) {
      strengths = skillCategories.slice(0, 3);
      weaknesses = skillCategories.slice(-3).reverse();
    } else if (totalAnalyses > 0) {
      // Fallback to pillar-based strengths/weaknesses
      const pillarScores = [
        { category: 'Value', averageScore: averageValue },
        { category: 'Trust', averageScore: averageTrust },
        { category: 'Fit', averageScore: averageFit },
        { category: 'Logistics', averageScore: averageLogistics },
      ].sort((a, b) => b.averageScore - a.averageScore);

      strengths = pillarScores.slice(0, 2).filter(p => p.averageScore > 0);
      weaknesses = pillarScores.slice(-2).reverse().filter(p => p.averageScore > 0);
    }

    return NextResponse.json({
      period: `${days} days`,
      totalAnalyses,
      totalCalls: callAnalyses.length,
      totalRoleplays: roleplayAnalyses.length,
      averageOverall,
      averageValue,
      averageTrust,
      averageFit,
      averageLogistics,
      trend,
      weeklyData,
      skillCategories,
      strengths,
      weaknesses,
      recentAnalyses: allAnalyses.slice(0, 10).map(a => ({
        id: a.id,
        type: a.type,
        overallScore: a.overallScore,
        createdAt: a.createdAt,
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
