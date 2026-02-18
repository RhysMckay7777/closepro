import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { offers, prospectAvatars } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { users, organizations, userOrganizations } from '@/db/schema';
import { validateOfferProfile, getOfferTemplates, OFFER_TEMPLATES } from '@/lib/ai/roleplay/offer-intelligence';

/**
 * GET - List all offers for user's organization, or return templates
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const templatesOnly = searchParams.get('templates') === 'true';

    // If requesting templates, return them without auth (they're public templates)
    if (templatesOnly) {
      const templates = getOfferTemplates();
      const templateKeys = Object.keys(OFFER_TEMPLATES);
      return NextResponse.json({
        templates: templates.map((t, index) => ({
          id: `template_${templateKeys[index]}`,
          key: templateKeys[index],
          name: t.name,
          offerCategory: t.offerCategory,
          whoItsFor: t.whoItsFor,
          coreOutcome: t.coreOutcome,
          mechanismHighLevel: t.mechanismHighLevel,
          deliveryModel: t.deliveryModel,
          priceRange: t.priceRange,
          primaryProblemsSolved: t.primaryProblemsSolved,
          emotionalDrivers: t.emotionalDrivers,
          logicalDrivers: t.logicalDrivers,
          commonSkepticismTriggers: t.commonSkepticismTriggers,
          effortRequired: t.effortRequired,
          timeToResult: t.timeToResult,
          riskReversal: t.riskReversal,
          bestFitNotes: t.bestFitNotes,
          isTemplate: true,
        })),
      });
    }

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
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

    // Get user's organizations
    const userOrgs = await db
      .select()
      .from(userOrganizations)
      .where(eq(userOrganizations.userId, session.user.id));

    const orgIds = userOrgs.map(uo => uo.organizationId);

    // Get all offers for user's organizations with prospect counts
    // Note: prospectCount query will fail if offer_id column doesn't exist in prospect_avatars
    // In that case, we'll catch the error and return 0 for prospectCount
    let offersList;
    try {
      offersList = await db
        .select({
          id: offers.id,
          name: offers.name,
          offerCategory: offers.offerCategory,
          priceRange: offers.priceRange,
          coreOfferPrice: offers.coreOfferPrice,
          deliveryModel: offers.deliveryModel,
          coreOutcome: offers.coreOutcome,
          mechanismHighLevel: offers.mechanismHighLevel,
          isTemplate: offers.isTemplate,
          isActive: offers.isActive,
          createdAt: offers.createdAt,
          organizationId: offers.organizationId,
          prospectCount: sql<number>`(
            SELECT COUNT(*)::int
            FROM ${prospectAvatars}
            WHERE ${prospectAvatars.offerId} = ${offers.id}
            AND ${prospectAvatars.isActive} = true
          )`.as('prospectCount'),
        })
        .from(offers)
        .where(
          and(
            orgIds.length > 0 ? eq(offers.organizationId, orgIds[0]) : undefined
          )
        )
        .orderBy(desc(offers.createdAt));
    } catch (error: any) {
      // If offer_id column doesn't exist, fetch offers without prospect count
      if (error.message && error.message.includes('offer_id') && error.message.includes('does not exist')) {
        console.warn('offer_id column not found in prospect_avatars, fetching offers without prospect count');
        offersList = await db
          .select({
            id: offers.id,
            name: offers.name,
            offerCategory: offers.offerCategory,
            priceRange: offers.priceRange,
            coreOfferPrice: offers.coreOfferPrice,
            deliveryModel: offers.deliveryModel,
            coreOutcome: offers.coreOutcome,
            mechanismHighLevel: offers.mechanismHighLevel,
            isTemplate: offers.isTemplate,
            isActive: offers.isActive,
            createdAt: offers.createdAt,
            organizationId: offers.organizationId,
            prospectCount: sql<number>`0`.as('prospectCount'),
          })
          .from(offers)
          .where(
            and(
              orgIds.length > 0 ? eq(offers.organizationId, orgIds[0]) : undefined
            )
          )
          .orderBy(desc(offers.createdAt));
      } else {
        throw error;
      }
    }

    // Filter by organization IDs if multiple
    const filteredOffers = orgIds.length > 1
      ? offersList.filter(o => orgIds.includes(o.organizationId))
      : offersList;

    return NextResponse.json({
      offers: filteredOffers,
    });
  } catch (error: any) {
    console.error('Error fetching offers:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch offers' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new offer
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
      name,
      offerCategory,
      deliveryModel,
      coreOfferPrice,
      whoItsFor,
      customerStage,
      coreProblems,
      desiredOutcome,
      tangibleOutcomes,
      emotionalOutcomes,
      goals,
      deliverables,
      paymentOptions,
      timePerWeek,
      estimatedTimeToResults,
      effortRequired,
      caseStudyStrength,
      guaranteesRefundTerms,
      primaryFunnelSource,
      funnelContextAdditional,
      // Legacy fields for backward compatibility
      coreOutcome,
      mechanismHighLevel,
      priceRange,
      primaryProblemsSolved,
      supportChannels,
      touchpointsFrequency,
      implementationResponsibility,
      timeToResult,
      emotionalDrivers,
      logicalDrivers,
      proofAssetsAvailable,
      proofRelevanceNotes,
      riskReversal,
      riskReversalDetails,
      commonSkepticismTriggers,
      downsellOptions,
      mustHaveConditions,
      disqualifiers,
      softDisqualifiers,
      bestFitNotes,
      funnelContext,
      isTemplate = false,
    } = body;

    // Get user's primary organization
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

    // Get primary organization
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
        { error: 'No organization found. Please create an organization first.' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!name || !offerCategory || !deliveryModel || !coreOfferPrice || !whoItsFor || !coreProblems || !desiredOutcome) {
      return NextResponse.json(
        { error: 'Missing required fields: name, offerCategory, deliveryModel, coreOfferPrice, whoItsFor, coreProblems, desiredOutcome' },
        { status: 400 }
      );
    }

    // Create offer - try with new fields first, fallback to legacy if columns don't exist
    let newOffer;
    try {
      // Try inserting with new fields
      [newOffer] = await db
        .insert(offers)
        .values({
          organizationId,
          userId: session.user.id,
          name: name || `${offerCategory} Offer`,
          offerCategory,
          whoItsFor,
          coreOutcome: desiredOutcome || coreOutcome || '',
          mechanismHighLevel: deliverables || mechanismHighLevel || '',
          deliveryModel,
          // New fields
          coreOfferPrice: coreOfferPrice || priceRange || '',
          customerStage: customerStage || null,
          coreProblems: coreProblems || (primaryProblemsSolved ? JSON.stringify(primaryProblemsSolved) : null),
          desiredOutcome: desiredOutcome || coreOutcome || null,
          tangibleOutcomes: tangibleOutcomes || null,
          emotionalOutcomes: emotionalOutcomes || null,
          goals: goals || null,
          deliverables: deliverables || mechanismHighLevel || null,
          paymentOptions: paymentOptions || null,
          timePerWeek: timePerWeek || null,
          estimatedTimeToResults: estimatedTimeToResults || timeToResult || null,
          effortRequired: effortRequired || 'medium',
          caseStudyStrength: caseStudyStrength || null,
          guaranteesRefundTerms: guaranteesRefundTerms || riskReversalDetails || null,
          primaryFunnelSource: primaryFunnelSource || funnelContext || null,
          funnelContextAdditional: funnelContextAdditional || null,
          // Legacy fields for backward compatibility
          supportChannels: supportChannels ? JSON.stringify(supportChannels) : null,
          touchpointsFrequency,
          implementationResponsibility,
          priceRange: coreOfferPrice || priceRange || '',
          timeToResult: estimatedTimeToResults || timeToResult || null,
          primaryProblemsSolved: coreProblems ? JSON.stringify([coreProblems]) : (primaryProblemsSolved ? JSON.stringify(primaryProblemsSolved) : null),
          emotionalDrivers: emotionalOutcomes ? JSON.stringify({ ambition: [emotionalOutcomes] }) : (emotionalDrivers ? JSON.stringify(emotionalDrivers) : null),
          logicalDrivers: tangibleOutcomes ? JSON.stringify([tangibleOutcomes]) : (logicalDrivers ? JSON.stringify(logicalDrivers) : null),
          proofAssetsAvailable: caseStudyStrength ? JSON.stringify({ strength: caseStudyStrength }) : (proofAssetsAvailable ? JSON.stringify(proofAssetsAvailable) : null),
          proofRelevanceNotes,
          riskReversal: guaranteesRefundTerms || riskReversal || null,
          commonSkepticismTriggers: commonSkepticismTriggers ? JSON.stringify(commonSkepticismTriggers) : null,
          mustHaveConditions: mustHaveConditions ? JSON.stringify(mustHaveConditions) : null,
          disqualifiers: disqualifiers ? JSON.stringify(disqualifiers) : null,
          softDisqualifiers: softDisqualifiers ? JSON.stringify(softDisqualifiers) : null,
          bestFitNotes: bestFitNotes || (downsellOptions && downsellOptions.length > 0 ? JSON.stringify({ downsellOptions, riskReversalDetails }) : null),
          isTemplate,
          isActive: true,
        })
        .returning();
    } catch (insertError: any) {
      // If new columns don't exist, fallback to legacy columns only
      if (insertError.message && insertError.message.includes('does not exist')) {
        console.warn('New columns not found, using legacy schema:', insertError.message);
        [newOffer] = await db
          .insert(offers)
          .values({
            organizationId,
            userId: session.user.id,
            name: name || `${offerCategory} Offer`,
            offerCategory,
            whoItsFor,
            coreOutcome: desiredOutcome || coreOutcome || '',
            mechanismHighLevel: deliverables || mechanismHighLevel || '',
            deliveryModel,
            priceRange: coreOfferPrice || priceRange || '',
            timeToResult: estimatedTimeToResults || timeToResult || null,
            primaryProblemsSolved: coreProblems ? JSON.stringify([coreProblems]) : (primaryProblemsSolved ? JSON.stringify(primaryProblemsSolved) : null),
            emotionalDrivers: emotionalOutcomes ? JSON.stringify({ ambition: [emotionalOutcomes] }) : (emotionalDrivers ? JSON.stringify(emotionalDrivers) : null),
            logicalDrivers: tangibleOutcomes ? JSON.stringify([tangibleOutcomes]) : (logicalDrivers ? JSON.stringify(logicalDrivers) : null),
            supportChannels: supportChannels ? JSON.stringify(supportChannels) : null,
            touchpointsFrequency,
            implementationResponsibility,
            proofAssetsAvailable: caseStudyStrength ? JSON.stringify({ strength: caseStudyStrength }) : (proofAssetsAvailable ? JSON.stringify(proofAssetsAvailable) : null),
            proofRelevanceNotes,
            riskReversal: guaranteesRefundTerms || riskReversal || null,
            commonSkepticismTriggers: commonSkepticismTriggers ? JSON.stringify(commonSkepticismTriggers) : null,
            mustHaveConditions: mustHaveConditions ? JSON.stringify(mustHaveConditions) : null,
            disqualifiers: disqualifiers ? JSON.stringify(disqualifiers) : null,
            softDisqualifiers: softDisqualifiers ? JSON.stringify(softDisqualifiers) : null,
            bestFitNotes: bestFitNotes || (downsellOptions && downsellOptions.length > 0 ? JSON.stringify({ downsellOptions, riskReversalDetails }) : null),
            isTemplate,
            isActive: true,
          })
          .returning();
      } else {
        // Re-throw if it's a different error
        throw insertError;
      }
    }

    return NextResponse.json({
      offer: newOffer,
      message: 'Offer created successfully',
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating offer:', error);

    // Check if it's a missing column error
    if (error.message && error.message.includes('does not exist')) {
      return NextResponse.json(
        {
          error: `Database schema error: ${error.message}. Please run the migration: ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "core_offer_price" text;`
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create offer' },
      { status: 500 }
    );
  }
}
