import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { roleplaySessions, roleplayMessages, offers, prospectAvatars } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { users } from '@/db/schema';
import { generateProspectResponse, RoleplayContext, RoleplayMessage } from '@/lib/ai/roleplay/roleplay-engine';
import { OfferProfile } from '@/lib/ai/roleplay/offer-intelligence';
import { ProspectAvatar } from '@/lib/ai/roleplay/prospect-avatar';
import { FunnelContext } from '@/lib/ai/roleplay/funnel-context';
import { BehaviourState, initializeBehaviourState } from '@/lib/ai/roleplay/behaviour-rules';

export const maxDuration = 60;

/**
 * POST - Send a message in roleplay and get AI response
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
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
    const { message, audioUrl } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Get roleplay session
    const roleplay = await db
      .select()
      .from(roleplaySessions)
      .where(
        and(
          eq(roleplaySessions.id, sessionId),
          eq(roleplaySessions.userId, session.user.id)
        )
      )
      .limit(1);

    if (!roleplay[0]) {
      return NextResponse.json(
        { error: 'Roleplay session not found' },
        { status: 404 }
      );
    }

    if (roleplay[0].status !== 'in_progress') {
      return NextResponse.json(
        { error: 'Session is not in progress' },
        { status: 400 }
      );
    }

    // Get existing messages in parallel with offer and prospect data
    // (these queries have no dependencies on each other after session validation)
    const existingMessages = await db
      .select()
      .from(roleplayMessages)
      .where(eq(roleplayMessages.sessionId, sessionId))
      .orderBy(roleplayMessages.createdAt);

    // Save rep message
    const sessionStartTime = roleplay[0].startedAt.getTime();
    const now = Date.now();
    const timestamp = now - sessionStartTime;

    const [repMessage] = await db.insert(roleplayMessages).values({
      sessionId,
      role: 'rep',
      content: message,
      messageType: audioUrl ? 'voice' : 'text',
      audioUrl: audioUrl || null,
      timestamp,
    }).returning({ id: roleplayMessages.id });

    // Get offer or create default
    let offerData = await db
      .select()
      .from(offers)
      .where(eq(offers.id, roleplay[0].offerId))
      .limit(1);

    if (!offerData[0]) {
      // Create default offer for this organization
      const [defaultOffer] = await db
        .insert(offers)
        .values({
          organizationId: roleplay[0].organizationId,
          userId: roleplay[0].userId,
          name: 'Default Practice Offer',
          offerCategory: 'b2c_wealth',
          whoItsFor: 'Aspiring entrepreneurs who want to build a high-ticket closing business',
          coreOutcome: 'Become a skilled high-ticket closer earning $10k+/month',
          mechanismHighLevel: '1-on-1 mentorship, roleplay practice, and real call analysis',
          deliveryModel: 'dwy',
          priceRange: '5000-15000',
          primaryProblemsSolved: JSON.stringify([
            'Lack of closing skills',
            'Fear of high-ticket sales',
            'No structured training',
            'Can\'t handle objections',
          ]),
        })
        .returning();

      // Update session with new offer ID
      await db
        .update(roleplaySessions)
        .set({ offerId: defaultOffer.id })
        .where(eq(roleplaySessions.id, sessionId));

      offerData = [defaultOffer];
    }

    // Build offer profile
    const offerProfile: OfferProfile = {
      offerCategory: offerData[0].offerCategory as any,
      whoItsFor: offerData[0].whoItsFor,
      coreOutcome: offerData[0].coreOutcome,
      mechanismHighLevel: offerData[0].mechanismHighLevel,
      deliveryModel: offerData[0].deliveryModel as any,
      priceRange: offerData[0].priceRange ?? '',
      primaryProblemsSolved: offerData[0].primaryProblemsSolved
        ? JSON.parse(offerData[0].primaryProblemsSolved)
        : [],
      emotionalDrivers: offerData[0].emotionalDrivers
        ? JSON.parse(offerData[0].emotionalDrivers)
        : undefined,
      logicalDrivers: offerData[0].logicalDrivers
        ? JSON.parse(offerData[0].logicalDrivers)
        : undefined,
      // M5: Wire guarantee and timeline fields into prompt context
      guaranteesRefundTerms: offerData[0].guaranteesRefundTerms ?? undefined,
      estimatedTimeToResults: offerData[0].estimatedTimeToResults ?? undefined,
    };

    // Get prospect avatar or create default
    let prospectAvatar: ProspectAvatar;
    let funnelContext: FunnelContext;

    if (roleplay[0].prospectAvatarId) {
      const avatarData = await db
        .select()
        .from(prospectAvatars)
        .where(eq(prospectAvatars.id, roleplay[0].prospectAvatarId))
        .limit(1);

      if (avatarData[0]) {
        prospectAvatar = {
          difficulty: {
            positionProblemAlignment: avatarData[0].positionProblemAlignment,
            painAmbitionIntensity: avatarData[0].painAmbitionIntensity,
            perceivedNeedForHelp: avatarData[0].perceivedNeedForHelp,
            authorityLevel: avatarData[0].authorityLevel as any,
            funnelContext: avatarData[0].funnelContext,
            executionResistance: avatarData[0].executionResistance ?? 5,
            difficultyIndex: avatarData[0].difficultyIndex,
            difficultyTier: avatarData[0].difficultyTier as any,
          },
          positionDescription: avatarData[0].positionDescription || undefined,
          problems: avatarData[0].problems ? JSON.parse(avatarData[0].problems) : undefined,
          painDrivers: avatarData[0].painDrivers ? JSON.parse(avatarData[0].painDrivers) : undefined,
          ambitionDrivers: avatarData[0].ambitionDrivers ? JSON.parse(avatarData[0].ambitionDrivers) : undefined,
        };

        funnelContext = {
          type: 'warm_inbound',
          score: avatarData[0].funnelContext,
        };
      } else {
        // Default prospect
        prospectAvatar = createDefaultProspect(roleplay[0].selectedDifficulty || 'intermediate');
        funnelContext = { type: 'warm_inbound', score: 5 };
      }
    } else {
      // Default prospect
      prospectAvatar = createDefaultProspect(roleplay[0].selectedDifficulty || 'intermediate');
      funnelContext = { type: 'warm_inbound', score: 5 };
    }

    // Build conversation history
    const conversationHistory: RoleplayMessage[] = existingMessages.map(msg => ({
      role: msg.role as 'rep' | 'prospect',
      content: msg.content,
      timestamp: msg.timestamp || 0,
    }));

    // Load persisted behaviour state from session metadata, or initialize on first message
    const sessionMetadata = roleplay[0].metadata ? JSON.parse(roleplay[0].metadata) : {};
    const behaviourState: BehaviourState = isValidBehaviourState(sessionMetadata.behaviourState)
      ? sessionMetadata.behaviourState
      : initializeBehaviourState(prospectAvatar.difficulty, funnelContext);

    // Create roleplay context (includes replay phase/context if this is a phase replay session)
    const roleplayContext: RoleplayContext = {
      offer: offerProfile,
      prospectAvatar,
      funnelContext,
      conversationHistory,
      behaviourState,
      replayPhase: roleplay[0].replayPhase ?? undefined,
      replayContext: roleplay[0].replayContext ?? undefined,
      userId: session.user.id,
    };

    // Generate prospect response
    const { response, updatedBehaviourState, metadata } = await generateProspectResponse(
      roleplayContext,
      message
    );

    // Save prospect message
    const prospectTimestamp = Date.now() - sessionStartTime;
    const [prospectMessage] = await db.insert(roleplayMessages).values({
      sessionId,
      role: 'prospect',
      content: response,
      messageType: 'text',
      timestamp: prospectTimestamp,
      metadata: metadata ? JSON.stringify(metadata) : null,
    }).returning({ id: roleplayMessages.id });

    // Update session metadata with behaviour state (store in metadata JSON)
    const currentMetadata = roleplay[0].metadata ? JSON.parse(roleplay[0].metadata) : {};
    currentMetadata.behaviourState = updatedBehaviourState;
    await db
      .update(roleplaySessions)
      .set({ metadata: JSON.stringify(currentMetadata) })
      .where(eq(roleplaySessions.id, sessionId));

    return NextResponse.json({
      response,
      metadata,
      behaviourState: updatedBehaviourState,
      repMessageId: repMessage?.id ?? null,
      prospectMessageId: prospectMessage?.id ?? null,
    });
  } catch (error: any) {
    console.error('Error sending roleplay message:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send message' },
      { status: 500 }
    );
  }
}

/**
 * Create default prospect based on difficulty
 */
function createDefaultProspect(selectedDifficulty: string): ProspectAvatar {
  const difficultyMap: Record<string, { index: number; tier: any }> = {
    easy: { index: 35, tier: 'easy' },
    intermediate: { index: 32, tier: 'realistic' },
    hard: { index: 27, tier: 'hard' },
    expert: { index: 22, tier: 'expert' },
  };

  const { index, tier } = difficultyMap[selectedDifficulty] || difficultyMap.intermediate;

  return {
    difficulty: {
      positionProblemAlignment: 8,
      painAmbitionIntensity: 7,
      perceivedNeedForHelp: 7,
      authorityLevel: 'peer',
      funnelContext: 5,
      executionResistance: 5,
      difficultyIndex: index,
      difficultyTier: tier,
    },
  };
}

/**
 * Validate that a loaded behaviourState object has the expected shape
 */
function isValidBehaviourState(obj: unknown): obj is BehaviourState {
  if (!obj || typeof obj !== 'object') return false;
  const state = obj as Record<string, unknown>;
  const requiredKeys: (keyof BehaviourState)[] = [
    'objectionFrequency', 'objectionIntensity', 'currentResistance',
    'answerDepth', 'openness', 'engagement',
    'willingnessToBeChallenged', 'responseSpeed', 'talkTimeRatio',
    'trustLevel', 'valuePerception',
  ];
  return requiredKeys.every(key => key in state);
}
