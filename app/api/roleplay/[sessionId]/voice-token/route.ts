import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { roleplaySessions, offers, prospectAvatars } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { buildVoiceSystemPrompt, generateInitialProspectMessage, RoleplayContext } from '@/lib/ai/roleplay/roleplay-engine';
import { OfferProfile } from '@/lib/ai/roleplay/offer-intelligence';
import { ProspectAvatar } from '@/lib/ai/roleplay/prospect-avatar';
import { FunnelContext } from '@/lib/ai/roleplay/funnel-context';
import { initializeBehaviourState } from '@/lib/ai/roleplay/behaviour-rules';
import { getVoiceIdFromProspect, getProspectVoiceConfig } from '@/lib/ai/roleplay/voice-mapping';
import { getTranscriptPatternsForUser } from '@/lib/ai/roleplay/transcript-patterns';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID;

export const maxDuration = 30;

/**
 * GET - Generate signed URL + overrides for ElevenLabs Conversational AI
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!ELEVENLABS_API_KEY || !ELEVENLABS_AGENT_ID) {
      return NextResponse.json(
        { error: 'Voice agent not configured. Set ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID.' },
        { status: 503 }
      );
    }

    // Load session and verify ownership
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
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (roleplay[0].status !== 'in_progress') {
      return NextResponse.json({ error: 'Session is not in progress' }, { status: 400 });
    }

    // Load offer (or create default — mirrors message route pattern)
    let offerData = await db
      .select()
      .from(offers)
      .where(eq(offers.id, roleplay[0].offerId))
      .limit(1);

    if (!offerData[0]) {
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
            "Can't handle objections",
          ]),
        })
        .returning();

      await db
        .update(roleplaySessions)
        .set({ offerId: defaultOffer.id })
        .where(eq(roleplaySessions.id, sessionId));

      offerData = [defaultOffer];
    }

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
      guaranteesRefundTerms: offerData[0].guaranteesRefundTerms ?? undefined,
      estimatedTimeToResults: offerData[0].estimatedTimeToResults ?? undefined,
    };

    // Load prospect avatar (or create default)
    let prospectAvatar: ProspectAvatar;
    let funnelContext: FunnelContext;
    let prospectName = 'Prospect';
    let prospectVoiceStyle: string | null = null;

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
        funnelContext = { type: 'warm_inbound', score: avatarData[0].funnelContext };
        prospectName = avatarData[0].name;
        prospectVoiceStyle = avatarData[0].voiceStyle ?? null;
      } else {
        prospectAvatar = createDefaultProspect(roleplay[0].selectedDifficulty || 'intermediate');
        funnelContext = { type: 'warm_inbound', score: 5 };
      }
    } else {
      prospectAvatar = createDefaultProspect(roleplay[0].selectedDifficulty || 'intermediate');
      funnelContext = { type: 'warm_inbound', score: 5 };
    }

    // Build behaviour state
    const behaviourState = initializeBehaviourState(prospectAvatar.difficulty, funnelContext);

    // Build roleplay context
    const roleplayContext: RoleplayContext = {
      offer: offerProfile,
      prospectAvatar,
      funnelContext,
      conversationHistory: [],
      behaviourState,
      replayPhase: roleplay[0].replayPhase ?? undefined,
      replayContext: roleplay[0].replayContext ?? undefined,
      userId: session.user.id,
    };

    // Build voice system prompt
    let systemPrompt = buildVoiceSystemPrompt(roleplayContext);

    // Inject user transcript patterns
    try {
      const transcriptPatterns = await getTranscriptPatternsForUser(session.user.id);
      if (transcriptPatterns) {
        systemPrompt += '\n\n' + transcriptPatterns;
      }
    } catch (err) {
      console.error('[voice-token] Failed to load transcript patterns:', err);
    }

    // Generate initial prospect message
    const initialMessage = generateInitialProspectMessage(
      prospectAvatar,
      funnelContext,
      offerData[0].offerCategory,
    );

    // Get voice ID and voice settings
    const voiceConfig = getProspectVoiceConfig({
      name: prospectName,
      voiceStyle: prospectVoiceStyle,
    });
    const voiceId = voiceConfig.voiceId;

    // Fetch signed URL from ElevenLabs
    const signedUrlResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${ELEVENLABS_AGENT_ID}`,
      {
        method: 'GET',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
      }
    );

    if (!signedUrlResponse.ok) {
      const errText = await signedUrlResponse.text();
      console.error('[voice-token] ElevenLabs signed URL error:', signedUrlResponse.status, errText);
      return NextResponse.json(
        { error: 'Failed to get voice session URL' },
        { status: 502 }
      );
    }

    const signedUrlData = await signedUrlResponse.json();
    const signedUrl = signedUrlData.signed_url;

    if (!signedUrl) {
      return NextResponse.json(
        { error: 'No signed URL returned from ElevenLabs' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      signedUrl,
      systemPrompt,
      firstMessage: initialMessage.content,
      voiceId,
      prospectName,
      voiceSettings: {
        stability: voiceConfig.stability ?? 0.7,
        similarityBoost: voiceConfig.similarityBoost ?? 0.75,
      },
    });
  } catch (error: any) {
    console.error('[voice-token] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate voice token' },
      { status: 500 }
    );
  }
}

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
