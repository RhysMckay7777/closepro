import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { salesCalls, callAnalysis, users, organizations, userOrganizations, offers } from '@/db/schema';
import { eq, desc, and, notInArray, sql } from 'drizzle-orm';

/**
 * Get all calls for the current user.
 * Query: forFollowUp=true returns minimal list for follow-up dropdown: id, prospectName, offerName, createdAt.
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

    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user[0]) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    let organizationId = user[0].organizationId;
    if (!organizationId) {
      const firstOrg = await db
        .select()
        .from(userOrganizations)
        .where(eq(userOrganizations.userId, user[0].id))
        .limit(1);
      if (!firstOrg[0]) {
        return NextResponse.json(
          { error: 'No organization found' },
          { status: 404 }
        );
      }
      organizationId = firstOrg[0].organizationId;
    }

    const { searchParams } = new URL(request.url);
    const forFollowUp = searchParams.get('forFollowUp') === 'true';

    if (forFollowUp) {
      const list = await db
        .select({
          id: salesCalls.id,
          prospectName: salesCalls.prospectName,
          offerId: salesCalls.offerId,
          createdAt: salesCalls.createdAt,
          offerName: offers.name,
        })
        .from(salesCalls)
        .leftJoin(offers, eq(salesCalls.offerId, offers.id))
        .where(eq(salesCalls.organizationId, organizationId))
        .orderBy(desc(salesCalls.createdAt))
        .limit(50);
      return NextResponse.json({
        calls: list.map((row) => ({
          id: row.id,
          prospectName: row.prospectName ?? '',
          offerName: row.offerName ?? '—',
          createdAt: row.createdAt.toISOString(),
        })),
      });
    }

    const calls = await db
      .select({
        id: salesCalls.id,
        fileName: salesCalls.fileName,
        status: salesCalls.status,
        duration: salesCalls.duration,
        createdAt: salesCalls.createdAt,
        completedAt: salesCalls.completedAt,
        userId: salesCalls.userId,
        prospectName: salesCalls.prospectName,
        offerId: salesCalls.offerId,
        result: salesCalls.result,
        offerType: salesCalls.offerType,
        callType: salesCalls.callType,
        callDate: salesCalls.callDate,
        userName: users.name,
        userEmail: users.email,
        offerName: offers.name,
        overallScore: callAnalysis.overallScore,
        prospectDifficulty: callAnalysis.prospectDifficulty,
        prospectDifficultyTier: callAnalysis.prospectDifficultyTier,
      })
      .from(salesCalls)
      .innerJoin(users, eq(salesCalls.userId, users.id))
      .leftJoin(offers, eq(salesCalls.offerId, offers.id))
      .leftJoin(callAnalysis, eq(salesCalls.id, callAnalysis.callId))
      .where(
        and(
          eq(salesCalls.organizationId, organizationId),
          notInArray(salesCalls.status, ['pending_confirmation', 'transcribing', 'analyzing'])
        )
      )
      .orderBy(desc(sql`COALESCE(${salesCalls.callDate}, ${salesCalls.createdAt})`))
      .limit(50);

    return NextResponse.json({
      calls: calls.map((call) => ({
        id: call.id,
        fileName: call.fileName,
        status: call.status,
        duration: call.duration,
        createdAt: call.createdAt.toISOString(),
        completedAt: call.completedAt ? call.completedAt.toISOString() : null,
        userId: call.userId,
        prospectName: call.prospectName ?? undefined,
        offerId: call.offerId,
        result: call.result,
        offerType: call.offerType,
        callType: call.callType,
        date: call.callDate ? call.callDate.toISOString().slice(0, 10) : call.createdAt.toISOString().slice(0, 10),
        userName: call.userName,
        userEmail: call.userEmail,
        offerName: call.offerName ?? '—',
        overallScore: call.overallScore ?? undefined,
        prospectDifficulty: call.prospectDifficulty ?? undefined,
        difficultyTier: call.prospectDifficultyTier ?? undefined,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching calls:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calls' },
      { status: 500 }
    );
  }
}
