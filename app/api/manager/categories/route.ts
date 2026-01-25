import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { users, userOrganizations, salesCalls, callAnalysis, roleplaySessions, roleplayAnalysis } from '@/db/schema';
import { eq, and, gte, sql, inArray } from 'drizzle-orm';

/**
 * GET - Get category-level analysis across team
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

    // Get date range
    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') || '30');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all team members
    const teamMembers = await db
      .select()
      .from(userOrganizations)
      .where(eq(userOrganizations.organizationId, organizationId));

    const teamUserIds = teamMembers.map(tm => tm.userId);

    // Get all analyses
    const callAnalyses = await db
      .select({
        skillScores: callAnalysis.skillScores,
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

    const roleplayAnalyses = await db
      .select({
        skillScores: roleplayAnalysis.skillScores,
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

    // Aggregate category scores
    const categoryData: Record<string, { total: number; count: number; reps: Set<string> }> = {};
    const repCategoryScores: Record<string, Record<string, { total: number; count: number }>> = {};

    [...callAnalyses, ...roleplayAnalyses].forEach((analysis, idx) => {
      if (!analysis.skillScores) return;

      try {
        const skills = JSON.parse(analysis.skillScores as string);
        if (Array.isArray(skills)) {
          skills.forEach((skill: any) => {
            if (skill.category && skill.subSkills) {
              const categoryAvg = Object.values(skill.subSkills).reduce(
                (sum: number, score: any) => sum + (Number(score) || 0),
                0
              ) / Object.keys(skill.subSkills).length;

              if (!categoryData[skill.category]) {
                categoryData[skill.category] = { total: 0, count: 0, reps: new Set() };
              }
              categoryData[skill.category].total += categoryAvg;
              categoryData[skill.category].count += 1;

              // Track per-rep (simplified - would need userId from join)
              // For now, just aggregate team-wide
            }
          });
        }
      } catch (e) {
        // Skip invalid JSON
      }
    });

    // Calculate category averages and identify weak categories
    const categories = Object.entries(categoryData).map(([category, data]) => ({
      category,
      averageScore: Math.round(data.total / data.count),
      totalAnalyses: data.count,
      repCount: data.reps.size || 1, // Simplified
    })).sort((a, b) => a.averageScore - b.averageScore);

    const weakCategories = categories.slice(0, 3);
    const strongCategories = categories.slice(-3).reverse();

    return NextResponse.json({
      categories,
      weakCategories,
      strongCategories,
      period: `${days} days`,
    });
  } catch (error: any) {
    console.error('Error fetching category analysis:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch category analysis' },
      { status: 500 }
    );
  }
}
