// Seed data utility for creating default offers and prospects on signup

import { db } from '@/db';
import { offers, prospectAvatars } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Create default seed data: 5 offers (one per category) with 4 prospects each
 */
export async function createSeedData(organizationId: string, userId: string) {
  const defaultOffers = [
    {
      name: 'B2C Health Transformation',
      offerCategory: 'b2c_health' as const,
      whoItsFor: 'Men and women 30-55 who have struggled with weight loss, lack energy, and want to feel confident in their bodies again',
      coreOutcome: 'Sustainable weight loss and improved health with lasting lifestyle changes',
      mechanismHighLevel: 'Personalized nutrition plans, structured workout programs, accountability coaching, and habit transformation system',
      deliveryModel: 'dwy' as const,
      coreOfferPrice: '£5,000',
      customerStage: 'aspiring' as const,
      coreProblems: 'Failed multiple diets and weight loss attempts. Lack of time and energy for consistent exercise. Emotional eating and poor relationship with food. Low self-confidence and body image issues.',
      desiredOutcome: 'Complete body transformation with sustainable habits in 12-16 weeks',
      tangibleOutcomes: 'Lose 20-30lbs, improved energy levels, better sleep, reduced health markers',
      emotionalOutcomes: 'Increased confidence, body image improvement, sense of control, pride in achievement',
      deliverables: 'Personalized meal plans, workout programs, weekly coaching calls, accountability system, habit tracking tools',
      paymentOptions: 'One-time payment or 3-month payment plan available',
      timePerWeek: '5-7 hours',
      estimatedTimeToResults: '12-16 weeks for initial transformation',
      effortRequired: 'medium' as const,
      caseStudyStrength: 'strong' as const,
      guaranteesRefundTerms: '30-day money-back guarantee if you follow the program',
      primaryFunnelSource: 'warm_inbound' as const,
      funnelContextAdditional: 'Most prospects come from content marketing and referrals',
    },
    {
      name: 'B2C Relationships Coaching',
      offerCategory: 'b2c_relationships' as const,
      whoItsFor: 'Single men and women 25-45 who struggle with dating, want to find a meaningful relationship, or improve their current partnership',
      coreOutcome: 'Find and maintain healthy, fulfilling romantic relationships with confidence and authenticity',
      mechanismHighLevel: 'Dating strategy coaching, communication skills training, confidence building, and relationship frameworks',
      deliveryModel: 'dwy' as const,
      coreOfferPrice: '£3,000',
      customerStage: 'aspiring' as const,
      coreProblems: 'Struggling to attract quality partners. Repeated patterns of failed relationships. Lack of confidence in dating situations. Poor communication and conflict resolution.',
      desiredOutcome: 'Find a meaningful relationship or improve current partnership within 3-6 months',
      tangibleOutcomes: 'Increased dates, better quality matches, improved communication skills, successful relationship',
      emotionalOutcomes: 'Increased confidence, reduced loneliness, sense of self-worth, emotional safety',
      deliverables: 'Weekly coaching sessions, dating strategy guides, communication frameworks, confidence exercises, relationship assessment tools',
      paymentOptions: 'One-time payment or monthly payment plan',
      timePerWeek: '2-3 hours',
      estimatedTimeToResults: '3-6 months to see significant improvement',
      effortRequired: 'medium' as const,
      caseStudyStrength: 'moderate' as const,
      guaranteesRefundTerms: 'Conditional guarantee based on program completion',
      primaryFunnelSource: 'content_driven_inbound' as const,
      funnelContextAdditional: 'Prospects typically find us through content and social media',
    },
    {
      name: 'B2C Wealth Building Program',
      offerCategory: 'b2c_wealth' as const,
      whoItsFor: 'Aspiring entrepreneurs and career professionals 25-45 who want to increase their income, start a business, or escape the 9-to-5',
      coreOutcome: 'Build a profitable business or high-income career that provides financial freedom and lifestyle flexibility',
      mechanismHighLevel: 'Business strategy, sales training, marketing systems, and mentorship to build income-generating skills',
      deliveryModel: 'dwy' as const,
      coreOfferPrice: '£10,000',
      customerStage: 'aspiring' as const,
      coreProblems: 'Stuck in low-paying job with no growth. Want to start business but don\'t know how. Lack sales and marketing skills. No clear path to financial freedom.',
      desiredOutcome: 'Build a profitable business or high-income career within 6-12 months',
      tangibleOutcomes: 'Increased income, business revenue, new clients, scalable systems',
      emotionalOutcomes: 'Financial freedom, sense of achievement, independence, confidence',
      deliverables: 'Business strategy sessions, sales training, marketing frameworks, mentorship, implementation support',
      paymentOptions: 'One-time payment or 6-month payment plan',
      timePerWeek: '10-15 hours',
      estimatedTimeToResults: '6-12 months to build sustainable income',
      effortRequired: 'high' as const,
      caseStudyStrength: 'strong' as const,
      guaranteesRefundTerms: 'Conditional guarantee based on implementation',
      primaryFunnelSource: 'cold_ads' as const,
      funnelContextAdditional: 'Mix of cold ads and content-driven inbound',
    },
    {
      name: 'Mixed Wealth Closing Mastery',
      offerCategory: 'mixed_wealth' as const,
      whoItsFor: 'Both aspiring entrepreneurs starting from zero and current business owners who want to scale, learn high-ticket sales, or build a closing business',
      coreOutcome: 'Build a high-ticket closing business or agency that generates consistent 5-6 figure monthly revenue',
      mechanismHighLevel: 'High-ticket sales training, closing frameworks, client acquisition systems, and mentorship for building a closing business',
      deliveryModel: 'dwy' as const,
      coreOfferPrice: '£7,500',
      customerStage: 'mixed' as const,
      coreProblems: 'Want to become a high-ticket closer but lack skills. Current business needs better sales and closing. Want to add closing services to existing business.',
      desiredOutcome: 'Become a skilled closer and build a closing business within 6-12 months',
      tangibleOutcomes: 'Increased close rate, higher ticket sales, new clients, closing business revenue',
      emotionalOutcomes: 'Confidence in sales, financial growth, professional mastery, independence',
      deliverables: 'Closing frameworks, roleplay sessions, client acquisition systems, mentorship, business building support',
      paymentOptions: 'One-time payment or payment plan',
      timePerWeek: '8-12 hours',
      estimatedTimeToResults: '3-6 months to become proficient, 6-12 months to build business',
      effortRequired: 'high' as const,
      caseStudyStrength: 'strong' as const,
      guaranteesRefundTerms: 'Conditional guarantee',
      primaryFunnelSource: 'content_driven_inbound' as const,
      funnelContextAdditional: 'Mix of aspiring and current business owners',
    },
    {
      name: 'B2B Services Agency Partnership',
      offerCategory: 'b2b_services' as const,
      whoItsFor: 'Current business owners and agency operators who are stuck at a revenue plateau, want to scale, or need help with client acquisition',
      coreOutcome: 'Scale business revenue, improve client acquisition, and build systems for sustainable growth',
      mechanismHighLevel: 'Done-for-you services, agency partnerships, consulting frameworks, and proven client acquisition systems',
      deliveryModel: 'dfy' as const,
      coreOfferPrice: '£25,000',
      customerStage: 'current' as const,
      coreProblems: 'Revenue plateau and can\'t break through. Struggling to acquire new clients consistently. Lack systems and processes for scaling. Wearing too many hats and burning out.',
      desiredOutcome: 'Scale business revenue and improve client acquisition within 3-6 months',
      tangibleOutcomes: 'Increased revenue, new clients, scalable systems, improved processes',
      emotionalOutcomes: 'Reduced stress, business growth confidence, work-life balance, legacy building',
      deliverables: 'Done-for-you client acquisition, systems implementation, consulting sessions, team support',
      paymentOptions: 'One-time payment or quarterly payment plan',
      timePerWeek: '2-5 hours (mostly oversight)',
      estimatedTimeToResults: '3-6 months to see significant revenue impact',
      effortRequired: 'low' as const,
      caseStudyStrength: 'strong' as const,
      guaranteesRefundTerms: 'ROI-based guarantee',
      primaryFunnelSource: 'cold_outbound' as const,
      funnelContextAdditional: 'Target established businesses with existing revenue',
    },
  ];

  const createdOffers = [];

  // Create offers
  for (const offerData of defaultOffers) {
    const [offer] = await db
      .insert(offers)
      .values({
        organizationId,
        userId,
        name: offerData.name,
        offerCategory: offerData.offerCategory,
        whoItsFor: offerData.whoItsFor,
        coreOutcome: offerData.desiredOutcome,
        mechanismHighLevel: offerData.deliverables,
        deliveryModel: offerData.deliveryModel,
        coreOfferPrice: offerData.coreOfferPrice,
        customerStage: offerData.customerStage,
        coreProblems: offerData.coreProblems,
        desiredOutcome: offerData.desiredOutcome,
        tangibleOutcomes: offerData.tangibleOutcomes,
        emotionalOutcomes: offerData.emotionalOutcomes,
        deliverables: offerData.deliverables,
        paymentOptions: offerData.paymentOptions,
        timePerWeek: offerData.timePerWeek,
        estimatedTimeToResults: offerData.estimatedTimeToResults,
        effortRequired: offerData.effortRequired,
        caseStudyStrength: offerData.caseStudyStrength,
        guaranteesRefundTerms: offerData.guaranteesRefundTerms,
        primaryFunnelSource: offerData.primaryFunnelSource,
        funnelContextAdditional: offerData.funnelContextAdditional,
        // Legacy fields
        priceRange: offerData.coreOfferPrice,
        primaryProblemsSolved: JSON.stringify([offerData.coreProblems]),
        isTemplate: false,
        isActive: true,
      })
      .returning();

    createdOffers.push(offer);

    // Create 4 default prospects for each offer (Easy, Realistic, Hard, Expert)
    const prospectConfigs = [
      { name: 'Easy Prospect', tier: 'easy' as const, scores: { position: 8, pain: 9, need: 9, funnel: 9, ability: 9 } },
      { name: 'Realistic Prospect', tier: 'realistic' as const, scores: { position: 6, pain: 7, need: 7, funnel: 7, ability: 7 } },
      { name: 'Hard Prospect', tier: 'hard' as const, scores: { position: 4, pain: 5, need: 5, funnel: 5, ability: 5 } },
      { name: 'Expert Prospect', tier: 'expert' as const, scores: { position: 2, pain: 3, need: 3, funnel: 3, ability: 3 } },
    ];

    for (const prospectConfig of prospectConfigs) {
      const totalScore = 
        prospectConfig.scores.position +
        prospectConfig.scores.pain +
        prospectConfig.scores.need +
        prospectConfig.scores.funnel +
        prospectConfig.scores.ability;

      // Map scores to authority level (low need = advisor, high need = advisee)
      const authorityLevel = prospectConfig.scores.need <= 3 ? 'advisor' as const :
                            prospectConfig.scores.need <= 7 ? 'peer' as const : 'advisee' as const;

      await db
        .insert(prospectAvatars)
        .values({
          organizationId,
          offerId: offer.id,
          userId,
          name: `${offerData.name} - ${prospectConfig.name}`,
          sourceType: 'auto_generated',
          positionProblemAlignment: prospectConfig.scores.position,
          painAmbitionIntensity: prospectConfig.scores.pain,
          perceivedNeedForHelp: prospectConfig.scores.need,
          authorityLevel,
          funnelContext: prospectConfig.scores.funnel,
          executionResistance: prospectConfig.scores.ability,
          difficultyIndex: totalScore,
          difficultyTier: prospectConfig.tier,
          positionDescription: `Auto-generated ${prospectConfig.tier} difficulty prospect for ${offerData.name}`,
          problems: JSON.stringify(['Auto-generated prospect']),
          isTemplate: false,
          isActive: true,
        });
    }
  }

  return {
    offersCreated: createdOffers.length,
    prospectsCreated: createdOffers.length * 4,
  };
}
