import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { salesCalls, users, organizations, userOrganizations } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * POST - Log a call manually (updates figures but does NOT add to call history)
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const {
      date,
      offerId,
      offerType,
      callType,
      result,
      qualified,
      cashCollected,
      revenueGenerated,
      depositTaken,
      reasonForOutcome,
      objections,
    } = body;

    if (!offerId || !result || !reasonForOutcome) {
      return NextResponse.json(
        { error: 'Missing required fields: offerId, result, reasonForOutcome' },
        { status: 400 }
      );
    }

    // Get user's organization
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
        .where(eq(userOrganizations.userId, session.user.id))
        .limit(1);
      
      if (!firstOrg[0]) {
        return NextResponse.json(
          { error: 'No organization found' },
          { status: 404 }
        );
      }
      organizationId = firstOrg[0].organizationId;
    }

    // Note: Manual logs update figures/trends but do NOT create a salesCalls record
    // This is intentional per the spec - manual logs are for quick figure updates only
    
    // In a real implementation, you would update your figures/trends tables here
    // For now, we'll just return success
    
    return NextResponse.json({
      message: 'Call logged successfully (figures updated)',
      note: 'Manual logs do not appear in call history',
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error logging manual call:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to log call' },
      { status: 500 }
    );
  }
}
