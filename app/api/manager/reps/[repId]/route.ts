import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { users, userOrganizations, salesCalls, callAnalysis, roleplaySessions, roleplayAnalysis } from '@/db/schema';
import { eq, and, gte, desc } from 'drizzle-orm';

/**
 * GET - Get detailed performance data for a specific rep
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ repId: string }> }
) {
  try {
    const { repId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is manager or admin
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user[0] || (user[0].role !== 'manager' && user[0].role !== 'admin')) {
      return NextResponse.json(
        { error: 'Access denied. Manager or admin role required.' },
        { status: 403 }
      );
    }

    // Get rep user
    const repUser = await db
      .select()
      .from(users)
      .where(eq(users.id, repId))
      .limit(1);

    if (!repUser[0]) {
      return NextResponse.json(
        { error: 'Rep not found' },
        { status: 404 }
      );
    }

    // Verify rep is in same organization
    const userOrg = await db
      .select()
      .from(userOrganizations)
      .where(
        and(
          eq(userOrganizations.userId, session.user.id),
          eq(userOrganizations.isPrimary, true)
        )
      )
      .limit(1);

    const organizationId = userOrg[0]?.organizationId ?? user[0].organizationId ?? null;
    if (organizationId == null) {
      return NextResponse.json(
        { error: 'No organization context' },
        { status: 403 }
      );
    }

    const repOrg = await db
      .select()
      .from(userOrganizations)
      .where(eq(userOrganizations.userId, repId))
      .limit(1);

    if (!repOrg.some(ro => ro.organizationId === organizationId)) {
      return NextResponse.json(
        { error: 'Rep not in your organization' },
        { status: 403 }
      );
    }

    // Get date range from query params
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get recent call analyses
    const callAnalyses = await db
      .select({
        id: callAnalysis.id,
        callId: callAnalysis.callId,
        overallScore: callAnalysis.overallScore,
        valueScore: callAnalysis.valueScore,
        trustScore: callAnalysis.trustScore,
        fitScore: callAnalysis.fitScore,
        logisticsScore: callAnalysis.logisticsScore,
        skillScores: callAnalysis.skillScores,
        coachingRecommendations: callAnalysis.coachingRecommendations,
        createdAt: callAnalysis.createdAt,
        callFileName: salesCalls.fileName,
        callCreatedAt: salesCalls.createdAt,
      })
      .from(callAnalysis)
      .innerJoin(salesCalls, eq(callAnalysis.callId, salesCalls.id))
      .where(
        and(
          eq(salesCalls.userId, repId),
          eq(salesCalls.organizationId, organizationId),
          gte(callAnalysis.createdAt, startDate)
        )
      )
      .orderBy(desc(callAnalysis.createdAt))
      .limit(50);

    // Get recent roleplay analyses
    const roleplayAnalyses = await db
      .select({
        id: roleplayAnalysis.id,
        sessionId: roleplayAnalysis.roleplaySessionId,
        overallScore: roleplayAnalysis.overallScore,
        valueScore: roleplayAnalysis.valueScore,
        trustScore: roleplayAnalysis.trustScore,
        fitScore: roleplayAnalysis.fitScore,
        logisticsScore: roleplayAnalysis.logisticsScore,
        skillScores: roleplayAnalysis.skillScores,
        coachingRecommendations: roleplayAnalysis.coachingRecommendations,
        createdAt: roleplayAnalysis.createdAt,
        sessionCreatedAt: roleplaySessions.createdAt,
      })
      .from(roleplayAnalysis)
      .innerJoin(roleplaySessions, eq(roleplayAnalysis.roleplaySessionId, roleplaySessions.id))
      .where(
        and(
          eq(roleplaySessions.userId, repId),
          eq(roleplaySessions.organizationId, organizationId),
          gte(roleplayAnalysis.createdAt, startDate)
        )
      )
      .orderBy(desc(roleplayAnalysis.createdAt))
      .limit(50);

    // Calculate averages and trends
    const allAnalyses = [
      ...callAnalyses.map(ca => ({
        overallScore: ca.overallScore || 0,
        valueScore: ca.valueScore || 0,
        trustScore: ca.trustScore || 0,
        fitScore: ca.fitScore || 0,
        logisticsScore: ca.logisticsScore || 0,
        createdAt: ca.createdAt,
      })),
      ...roleplayAnalyses.map(ra => ({
        overallScore: ra.overallScore || 0,
        valueScore: ra.valueScore || 0,
        trustScore: ra.trustScore || 0,
        fitScore: ra.fitScore || 0,
        logisticsScore: ra.logisticsScore || 0,
        createdAt: ra.createdAt,
      })),
    ];

    const totalAnalyses = allAnalyses.length;
    const averageOverallScore = totalAnalyses > 0
      ? Math.round(allAnalyses.reduce((sum, a) => sum + (a.overallScore || 0), 0) / totalAnalyses)
      : 0;
    const averageValueScore = totalAnalyses > 0
      ? Math.round(allAnalyses.reduce((sum, a) => sum + (a.valueScore || 0), 0) / totalAnalyses)
      : 0;
    const averageTrustScore = totalAnalyses > 0
      ? Math.round(allAnalyses.reduce((sum, a) => sum + (a.trustScore || 0), 0) / totalAnalyses)
      : 0;
    const averageFitScore = totalAnalyses > 0
      ? Math.round(allAnalyses.reduce((sum, a) => sum + (a.fitScore || 0), 0) / totalAnalyses)
      : 0;
    const averageLogisticsScore = totalAnalyses > 0
      ? Math.round(allAnalyses.reduce((sum, a) => sum + (a.logisticsScore || 0), 0) / totalAnalyses)
      : 0;

    // Calculate trend
    let trend: 'improving' | 'declining' | 'neutral' = 'neutral';
    if (allAnalyses.length >= 4) {
      const sorted = allAnalyses.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      const midpoint = Math.floor(sorted.length / 2);
      const firstHalf = sorted.slice(0, midpoint);
      const secondHalf = sorted.slice(midpoint);

      const firstHalfAvg = firstHalf.reduce((sum, a) => sum + (a.overallScore || 0), 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, a) => sum + (a.overallScore || 0), 0) / secondHalf.length;

      const diff = secondHalfAvg - firstHalfAvg;
      if (diff > 3) trend = 'improving';
      else if (diff < -3) trend = 'declining';
    }

    // Parse skill scores to identify strengths/weaknesses
    const categoryScores: Record<string, { total: number; count: number }> = {};
    
    [...callAnalyses, ...roleplayAnalyses].forEach(analysis => {
      if (analysis.skillScores) {
        try {
          const skills = JSON.parse(analysis.skillScores as string);
          if (Array.isArray(skills)) {
            skills.forEach((skill: any) => {
              if (skill.category && skill.subSkills) {
                const categoryAvg = Object.values(skill.subSkills).reduce(
                  (sum: number, score: any) => sum + (Number(score) || 0),
                  0
                ) / Object.keys(skill.subSkills).length;

                if (!categoryScores[skill.category]) {
                  categoryScores[skill.category] = { total: 0, count: 0 };
                }
                categoryScores[skill.category].total += categoryAvg;
                categoryScores[skill.category].count += 1;
              }
            });
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    });

    const categoryAverages = Object.entries(categoryScores).map(([category, data]) => ({
      category,
      averageScore: Math.round(data.total / data.count),
    })).sort((a, b) => a.averageScore - b.averageScore);

    const strengths = categoryAverages.slice(-3).reverse();
    const weaknesses = categoryAverages.slice(0, 3);

    return NextResponse.json({
      rep: {
        id: repUser[0].id,
        name: repUser[0].name,
        email: repUser[0].email,
        profilePhoto: repUser[0].profilePhoto,
      },
      performance: {
        averageOverallScore,
        averageValueScore,
        averageTrustScore,
        averageFitScore,
        averageLogisticsScore,
        trend,
        totalCalls: callAnalyses.length,
        totalRoleplays: roleplayAnalyses.length,
        totalAnalyses,
      },
      strengths,
      weaknesses,
      recentCalls: callAnalyses.map(ca => ({
        id: ca.id,
        callId: ca.callId,
        fileName: ca.callFileName,
        overallScore: ca.overallScore,
        valueScore: ca.valueScore,
        trustScore: ca.trustScore,
        fitScore: ca.fitScore,
        logisticsScore: ca.logisticsScore,
        createdAt: ca.createdAt || ca.callCreatedAt,
        type: 'call',
      })),
      recentRoleplays: roleplayAnalyses.map(ra => ({
        id: ra.id,
        sessionId: ra.sessionId,
        overallScore: ra.overallScore,
        valueScore: ra.valueScore,
        trustScore: ra.trustScore,
        fitScore: ra.fitScore,
        logisticsScore: ra.logisticsScore,
        createdAt: ra.createdAt || ra.sessionCreatedAt,
        type: 'roleplay',
      })),
    });
  } catch (error: any) {
    console.error('Error fetching rep details:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch rep details' },
      { status: 500 }
    );
  }
}
