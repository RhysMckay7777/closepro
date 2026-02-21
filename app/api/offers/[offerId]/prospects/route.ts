import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { offers, prospectAvatars, userOrganizations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * GET - List all prospects for an offer
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ offerId: string }> }
) {
  try {
    const { offerId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify offer exists and user has access
    const offer = await db
      .select()
      .from(offers)
      .where(eq(offers.id, offerId))
      .limit(1);

    if (!offer[0]) {
      return NextResponse.json(
        { error: 'Offer not found' },
        { status: 404 }
      );
    }

    const userOrg = await db
      .select()
      .from(userOrganizations)
      .where(eq(userOrganizations.userId, session.user.id))
      .limit(1);

    const userOrgIds = userOrg.map(uo => uo.organizationId);
    if (!userOrgIds.includes(offer[0].organizationId)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get all prospects for this offer
    const prospects = await db
      .select()
      .from(prospectAvatars)
      .where(
        and(
          eq(prospectAvatars.offerId, offerId),
          eq(prospectAvatars.isActive, true)
        )
      )
      .orderBy(prospectAvatars.createdAt);

    return NextResponse.json({
      prospects,
    });
  } catch (error: any) {
    logger.error('PROSPECT_BUILDER', 'Failed to fetch prospects', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch prospects' },
      { status: 500 }
    );
  }
}
