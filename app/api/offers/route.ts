import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { offers } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
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

    // Get all offers for user's organizations
    const offersList = await db
      .select()
      .from(offers)
      .where(
        and(
          orgIds.length > 0 ? eq(offers.organizationId, orgIds[0]) : undefined
        )
      )
      .orderBy(desc(offers.createdAt));

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
      whoItsFor,
      coreOutcome,
      mechanismHighLevel,
      deliveryModel,
      supportChannels,
      touchpointsFrequency,
      implementationResponsibility,
      priceRange,
      paymentOptions,
      timeToResult,
      effortRequired,
      primaryProblemsSolved,
      emotionalDrivers,
      logicalDrivers,
      proofAssetsAvailable,
      proofRelevanceNotes,
      riskReversal,
      commonSkepticismTriggers,
      mustHaveConditions,
      disqualifiers,
      softDisqualifiers,
      bestFitNotes,
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

    // Validate offer profile
    const validation = validateOfferProfile({
      offerCategory,
      whoItsFor,
      coreOutcome,
      mechanismHighLevel,
      deliveryModel,
      priceRange,
      primaryProblemsSolved,
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: `Missing required fields: ${validation.missing.join(', ')}` },
        { status: 400 }
      );
    }

    // Create offer
    const [newOffer] = await db
      .insert(offers)
      .values({
        organizationId,
        userId: session.user.id,
        name: name || `${offerCategory} Offer`,
        offerCategory,
        whoItsFor,
        coreOutcome,
        mechanismHighLevel,
        deliveryModel,
        supportChannels: supportChannels ? JSON.stringify(supportChannels) : null,
        touchpointsFrequency,
        implementationResponsibility,
        priceRange,
        paymentOptions: paymentOptions ? JSON.stringify(paymentOptions) : null,
        timeToResult,
        effortRequired,
        primaryProblemsSolved: JSON.stringify(primaryProblemsSolved),
        emotionalDrivers: emotionalDrivers ? JSON.stringify(emotionalDrivers) : null,
        logicalDrivers: logicalDrivers ? JSON.stringify(logicalDrivers) : null,
        proofAssetsAvailable: proofAssetsAvailable ? JSON.stringify(proofAssetsAvailable) : null,
        proofRelevanceNotes,
        riskReversal,
        commonSkepticismTriggers: commonSkepticismTriggers ? JSON.stringify(commonSkepticismTriggers) : null,
        mustHaveConditions: mustHaveConditions ? JSON.stringify(mustHaveConditions) : null,
        disqualifiers: disqualifiers ? JSON.stringify(disqualifiers) : null,
        softDisqualifiers: softDisqualifiers ? JSON.stringify(softDisqualifiers) : null,
        bestFitNotes,
        isTemplate,
        isActive: true,
      })
      .returning();

    return NextResponse.json({
      offer: newOffer,
      message: 'Offer created successfully',
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating offer:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create offer' },
      { status: 500 }
    );
  }
}
