import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { users, userOrganizations, salesCalls, callAnalysis, roleplaySessions, roleplayAnalysis } from '@/db/schema';
import { eq, and, gte, sql, desc, inArray } from 'drizzle-orm';

/**
 * GET - Get aggregated team performance metrics
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

    // Get user's organization
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

    const organizationId = userOrg[0]?.organizationId || user[0].organizationId;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 400 }
      );
    }

    // Get date range from query params (default: last 30 days)
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all team members in organization
    const teamMembers = await db
      .select()
      .from(userOrganizations)
      .where(eq(userOrganizations.organizationId, organizationId));

    const teamUserIds = teamMembers.map(tm => tm.userId);

    if (teamUserIds.length === 0) {
      return NextResponse.json({
        totalReps: 0,
        totalCalls: 0,
        totalRoleplays: 0,
        averageOverallScore: 0,
        averageValueScore: 0,
        averageTrustScore: 0,
        averageFitScore: 0,
        averageLogisticsScore: 0,
        trend: 'neutral',
      });
    }

    // Get all call analyses for team (real calls)
    const callAnalyses = await db
      .select({
        overallScore: callAnalysis.overallScore,
        valueScore: callAnalysis.valueScore,
        trustScore: callAnalysis.trustScore,
        fitScore: callAnalysis.fitScore,
        logisticsScore: callAnalysis.logisticsScore,
        createdAt: callAnalysis.createdAt,
      })
      .from(callAnalysis)
      .innerJoin(salesCalls, eq(callAnalysis.callId, salesCalls.id))
      .where(
        and(
          inArray(salesCalls.userId, teamUserIds),
          eq(salesCalls.organizationId, organizationId),
          gte(callAnalysis.createdAt, startDate)
        )
      );

    // Get all roleplay analyses for team
    const roleplayAnalyses = await db
      .select({
        overallScore: roleplayAnalysis.overallScore,
        valueScore: roleplayAnalysis.valueScore,
        trustScore: roleplayAnalysis.trustScore,
        fitScore: roleplayAnalysis.fitScore,
        logisticsScore: roleplayAnalysis.logisticsScore,
        createdAt: roleplayAnalysis.createdAt,
      })
      .from(roleplayAnalysis)
      .innerJoin(roleplaySessions, eq(roleplayAnalysis.roleplaySessionId, roleplaySessions.id))
      .where(
        and(
          inArray(roleplaySessions.userId, teamUserIds),
          eq(roleplaySessions.organizationId, organizationId),
          gte(roleplayAnalysis.createdAt, startDate)
        )
      );

    // Combine all analyses
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

    // Calculate averages
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

    // Calculate trend (compare first half vs second half of period)
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

    // Get total counts
    const totalCalls = await db
      .select({ count: sql<number>`count(*)` })
      .from(salesCalls)
      .where(
        and(
          inArray(salesCalls.userId, teamUserIds),
          eq(salesCalls.organizationId, organizationId),
          gte(salesCalls.createdAt, startDate)
        )
      );

    const totalRoleplays = await db
      .select({ count: sql<number>`count(*)` })
      .from(roleplaySessions)
      .where(
        and(
          inArray(roleplaySessions.userId, teamUserIds),
          eq(roleplaySessions.organizationId, organizationId),
          gte(roleplaySessions.createdAt, startDate)
        )
      );

    return NextResponse.json({
      totalReps: teamUserIds.length,
      totalCalls: Number(totalCalls[0]?.count || 0),
      totalRoleplays: Number(totalRoleplays[0]?.count || 0),
      averageOverallScore,
      averageValueScore,
      averageTrustScore,
      averageFitScore,
      averageLogisticsScore,
      trend,
      period: `${days} days`,
    });
  } catch (error: any) {
    console.error('Error fetching team performance:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch team performance' },
      { status: 500 }
    );
  }
}
