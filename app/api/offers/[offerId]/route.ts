import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { offers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { userOrganizations } from '@/db/schema';
import { validateOfferProfile } from '@/lib/ai/roleplay/offer-intelligence';

/**
 * GET - Get offer details
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

    // Get offer
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

    // Verify user has access (same organization)
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

    return NextResponse.json({
      offer: offer[0],
    });
  } catch (error: any) {
    logger.error('OFFERS', 'Failed to fetch offer', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch offer' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update offer
 */
export async function PATCH(
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

    const body = await request.json();

    // Get offer
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

    // Verify user owns the offer or has access
    if (offer[0].userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Only the creator can edit this offer' },
        { status: 403 }
      );
    }

    // Build update object
    const updateData: any = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.offerCategory !== undefined) updateData.offerCategory = body.offerCategory;
    if (body.whoItsFor !== undefined) updateData.whoItsFor = body.whoItsFor;
    if (body.coreOutcome !== undefined) updateData.coreOutcome = body.coreOutcome;
    if (body.mechanismHighLevel !== undefined) updateData.mechanismHighLevel = body.mechanismHighLevel;
    if (body.deliveryModel !== undefined) updateData.deliveryModel = body.deliveryModel;
    if (body.supportChannels !== undefined) updateData.supportChannels = JSON.stringify(body.supportChannels);
    if (body.touchpointsFrequency !== undefined) updateData.touchpointsFrequency = body.touchpointsFrequency;
    if (body.implementationResponsibility !== undefined) updateData.implementationResponsibility = body.implementationResponsibility;
    if (body.priceRange !== undefined) updateData.priceRange = body.priceRange;
    if (body.paymentOptions !== undefined) updateData.paymentOptions = JSON.stringify(body.paymentOptions);
    if (body.timeToResult !== undefined) updateData.timeToResult = body.timeToResult;
    if (body.effortRequired !== undefined) updateData.effortRequired = body.effortRequired;
    if (body.primaryProblemsSolved !== undefined) updateData.primaryProblemsSolved = JSON.stringify(body.primaryProblemsSolved);
    if (body.emotionalDrivers !== undefined) updateData.emotionalDrivers = JSON.stringify(body.emotionalDrivers);
    if (body.logicalDrivers !== undefined) updateData.logicalDrivers = JSON.stringify(body.logicalDrivers);
    if (body.proofAssetsAvailable !== undefined) updateData.proofAssetsAvailable = JSON.stringify(body.proofAssetsAvailable);
    if (body.proofRelevanceNotes !== undefined) updateData.proofRelevanceNotes = body.proofRelevanceNotes;
    if (body.riskReversal !== undefined) updateData.riskReversal = body.riskReversal;
    if (body.commonSkepticismTriggers !== undefined) updateData.commonSkepticismTriggers = JSON.stringify(body.commonSkepticismTriggers);
    if (body.mustHaveConditions !== undefined) updateData.mustHaveConditions = JSON.stringify(body.mustHaveConditions);
    if (body.disqualifiers !== undefined) updateData.disqualifiers = JSON.stringify(body.disqualifiers);
    if (body.softDisqualifiers !== undefined) updateData.softDisqualifiers = JSON.stringify(body.softDisqualifiers);
    if (body.bestFitNotes !== undefined) updateData.bestFitNotes = body.bestFitNotes;
    if (body.isTemplate !== undefined) updateData.isTemplate = body.isTemplate;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    // New-schema fields
    if (body.coreOfferPrice !== undefined) updateData.coreOfferPrice = body.coreOfferPrice;
    if (body.customerStage !== undefined) updateData.customerStage = body.customerStage;
    if (body.coreProblems !== undefined) updateData.coreProblems = body.coreProblems;
    if (body.desiredOutcome !== undefined) updateData.desiredOutcome = body.desiredOutcome;
    if (body.tangibleOutcomes !== undefined) updateData.tangibleOutcomes = body.tangibleOutcomes;
    if (body.emotionalOutcomes !== undefined) updateData.emotionalOutcomes = body.emotionalOutcomes;
    if (body.goals !== undefined) updateData.goals = body.goals;
    if (body.deliverables !== undefined) updateData.deliverables = body.deliverables;
    if (body.paymentOptions !== undefined) updateData.paymentOptions = body.paymentOptions;
    if (body.timePerWeek !== undefined) updateData.timePerWeek = body.timePerWeek;
    if (body.estimatedTimeToResults !== undefined) updateData.estimatedTimeToResults = body.estimatedTimeToResults;
    if (body.caseStudyStrength !== undefined) updateData.caseStudyStrength = body.caseStudyStrength;
    if (body.guaranteesRefundTerms !== undefined) updateData.guaranteesRefundTerms = body.guaranteesRefundTerms;
    if (body.primaryFunnelSource !== undefined) updateData.primaryFunnelSource = body.primaryFunnelSource;
    if (body.funnelContextAdditional !== undefined) updateData.funnelContextAdditional = body.funnelContextAdditional;

    updateData.updatedAt = new Date();

    // Validate if critical fields are being updated
    const updatedOffer = { ...offer[0], ...updateData };
    const validation = validateOfferProfile({
      offerCategory: updatedOffer.offerCategory,
      whoItsFor: updatedOffer.whoItsFor,
      coreOutcome: updatedOffer.coreOutcome,
      mechanismHighLevel: updatedOffer.mechanismHighLevel,
      deliveryModel: updatedOffer.deliveryModel,
      priceRange: updatedOffer.priceRange,
      primaryProblemsSolved: updatedOffer.primaryProblemsSolved ? JSON.parse(updatedOffer.primaryProblemsSolved) : [],
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: `Invalid offer: ${validation.missing.join(', ')}` },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(offers)
      .set(updateData)
      .where(eq(offers.id, offerId))
      .returning();

    return NextResponse.json({
      offer: updated,
      message: 'Offer updated successfully',
    });
  } catch (error: any) {
    logger.error('OFFERS', 'Failed to update offer', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update offer' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete offer
 */
export async function DELETE(
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

    // Get offer
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

    // Verify user owns the offer
    if (offer[0].userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Only the creator can delete this offer' },
        { status: 403 }
      );
    }

    // Soft delete by setting isActive to false
    await db
      .update(offers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(offers.id, offerId));

    return NextResponse.json({
      message: 'Offer deleted successfully',
    });
  } catch (error: any) {
    logger.error('OFFERS', 'Failed to delete offer', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete offer' },
      { status: 500 }
    );
  }
}
