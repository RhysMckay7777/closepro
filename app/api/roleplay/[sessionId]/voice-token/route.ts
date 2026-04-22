import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { roleplaySessions, offers, prospectAvatars } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { buildVoiceSystemPrompt, generateInitialProspectMessage, RoleplayContext } from '@/lib/ai/roleplay/roleplay-engine';
import { OfferProfile } from '@/lib/ai/roleplay/offer-intelligence';
import { ProspectAvatar, generateCharacterSheet } from '@/lib/ai/roleplay/prospect-avatar';
import { CharacterSheet } from '@/lib/training/character-sheet-wrapper';
import { FunnelContext } from '@/lib/ai/roleplay/funnel-context';
import { initializeBehaviourState } from '@/lib/ai/roleplay/behaviour-rules';
import { getVoiceIdFromProspect, getVoiceModeConfig } from '@/lib/ai/roleplay/voice-mapping';
import { getTranscriptPatternsForUser } from '@/lib/ai/roleplay/transcript-patterns';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_AGENT_ID = process.env.ELEVENLABS_AGENT_ID;

export const maxDuration = 300;

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

    // ═══ Character Sheet — Generate ONCE, lock for entire voice session ═══
    // Connor's Character Sheet Wrapper: "Generated at session start, locked for the entire call."
    const sessionMetadataRaw = roleplay[0].metadata ? JSON.parse(roleplay[0].metadata) : {};
    let characterSheet: CharacterSheet | undefined = sessionMetadataRaw.characterSheet;

    if (!characterSheet) {
      try {
        const prospectGender: 'male' | 'female' | 'any' = roleplay[0].prospectAvatarId
          ? ((await db.select({ gender: prospectAvatars.gender }).from(prospectAvatars).where(eq(prospectAvatars.id, roleplay[0].prospectAvatarId)).limit(1))[0]?.gender as 'male' | 'female') || 'any'
          : 'any';

        characterSheet = generateCharacterSheet({
          name: prospectName,
          gender: prospectGender,
          difficulty: prospectAvatar.difficulty,
          offer: {
            offerCategory: offerProfile.offerCategory,
            offerName: offerData[0].name || undefined,
            priceRange: offerProfile.priceRange,
            coreOutcome: offerProfile.coreOutcome,
            whoItsFor: offerProfile.whoItsFor,
            coreProblems: offerProfile.primaryProblemsSolved?.join(', '),
            guaranteesRefundTerms: offerProfile.guaranteesRefundTerms,
          },
          existingContext: prospectAvatar.positionDescription,
        });
        // Persist to session metadata so it's locked for the entire call
        sessionMetadataRaw.characterSheet = characterSheet;
        await db
          .update(roleplaySessions)
          .set({ metadata: JSON.stringify(sessionMetadataRaw) })
          .where(eq(roleplaySessions.id, sessionId));
      } catch (err) {
        logger.warn('ROLEPLAY', 'Failed to generate character sheet for voice session', { sessionId, error: String(err) });
        // Non-fatal — voice session continues without character sheet
      }
    }

    // Attach character sheet to prospect avatar (activates drift prevention + objection lock)
    if (characterSheet) {
      prospectAvatar.characterSheet = characterSheet;
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
      practiceMode: (roleplay[0] as any).practiceMode ?? undefined,
      practiceContext: (roleplay[0] as any).practiceContext ?? undefined,
      turnCount: 0,
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
      logger.warn('ROLEPLAY', 'Failed to load transcript patterns', { sessionId });
    }

    // Generate initial prospect message
    const initialMessage = generateInitialProspectMessage(
      prospectAvatar,
      funnelContext,
      offerData[0].offerCategory,
    );

    // Get voice ID and voice settings (use voice-mode config for higher stability)
    // Read stored gender from the prospect avatar DB record
    const prospectGender = roleplay[0].prospectAvatarId
      ? ((await db.select({ gender: prospectAvatars.gender }).from(prospectAvatars).where(eq(prospectAvatars.id, roleplay[0].prospectAvatarId)).limit(1))[0]?.gender as 'male' | 'female' | null) ?? null
      : null;

    const voiceConfig = getVoiceModeConfig({
      name: prospectName,
      voiceStyle: prospectVoiceStyle,
      gender: prospectGender,
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

    const signedUrlBody = await signedUrlResponse.text();

    if (!signedUrlResponse.ok) {
      logger.error('ROLEPLAY', 'ElevenLabs signed URL error', undefined, { sessionId, status: signedUrlResponse.status });
      return NextResponse.json(
        { error: 'Failed to get voice session URL' },
        { status: 502 }
      );
    }

    let signedUrlData: any;
    try {
      signedUrlData = JSON.parse(signedUrlBody);
    } catch {
      logger.error('ROLEPLAY', 'Failed to parse ElevenLabs response as JSON', undefined, { sessionId });
      return NextResponse.json(
        { error: 'Invalid response from voice service' },
        { status: 502 }
      );
    }
    const rawSignedUrl = signedUrlData.signed_url;

    if (!rawSignedUrl) {
      logger.error('ROLEPLAY', 'No signed_url in ElevenLabs response', undefined, { sessionId });
      return NextResponse.json(
        { error: 'No signed URL returned from ElevenLabs' },
        { status: 502 }
      );
    }

    // DIAGNOSTIC 2026-04-22: previously appended inactivity_timeout=180&turn_end_threshold=0.8
    // to the ElevenLabs-signed URL to tune idle timeout and silence detection. Suspected of
    // invalidating the URL signature or being misinterpreted by the WebSocket handshake,
    // causing 13-16s unintentional disconnects. Using the raw signed URL to isolate.
    // See docs/legacy/2026-04-22-voice-diagnostic.md for the legacy snippet and revert path.
    const signedUrl = rawSignedUrl;

    // Build dynamic variables for ElevenLabs agent template
    // These get injected into {{prospect_context}}, {{offer_info}}, {{first_message}} placeholders
    const prospect_context = [
      `Name: ${prospectName}`,
      prospectAvatar.positionDescription ? `Background: ${prospectAvatar.positionDescription}` : '',
      prospectAvatar.difficulty?.difficultyTier ? `Difficulty: ${prospectAvatar.difficulty.difficultyTier}` : '',
      prospectAvatar.difficulty?.authorityLevel ? `Authority: ${prospectAvatar.difficulty.authorityLevel}` : '',
      prospectAvatar.difficulty?.painAmbitionIntensity ? `Motivation intensity: ${prospectAvatar.difficulty.painAmbitionIntensity}/10` : '',
      prospectAvatar.difficulty?.funnelContext ? `Funnel warmth: ${prospectAvatar.difficulty.funnelContext}/10` : '',
      prospectAvatar.difficulty?.executionResistance ? `Ability to proceed: ${prospectAvatar.difficulty.executionResistance}/10` : '',
      prospectAvatar.problems?.length ? `Key objections: ${prospectAvatar.problems.join(', ')}` : '',
      prospectAvatar.painDrivers?.length ? `Pain points: ${prospectAvatar.painDrivers.join(', ')}` : '',
      prospectAvatar.ambitionDrivers?.length ? `Ambitions: ${prospectAvatar.ambitionDrivers.join(', ')}` : '',
      `Trust level: ${behaviourState.trustLevel}/10`,
      `Openness: ${behaviourState.openness}`,
    ].filter(Boolean).join('\n');

    const offer_info = [
      offerData[0].name ? `Offer: ${offerData[0].name}` : '',
      offerData[0].offerCategory ? `Category: ${offerData[0].offerCategory}` : '',
      offerData[0].priceRange ? `Price range: ${offerData[0].priceRange}` : '',
      offerData[0].coreOutcome ? `Core outcome: ${offerData[0].coreOutcome}` : '',
      offerData[0].whoItsFor ? `Target audience: ${offerData[0].whoItsFor}` : '',
      offerData[0].mechanismHighLevel ? `Mechanism: ${offerData[0].mechanismHighLevel}` : '',
    ].filter(Boolean).join('\n');

    // Add practice mode dynamic variables
    const practice_mode = (roleplay[0] as any).practiceMode || '';
    const practice_context = (roleplay[0] as any).practiceContext || '';

    // Append voice consistency rule to system prompt
    systemPrompt += `

VOICE CONSISTENCY RULE:
Maintain the EXACT same voice tone, pace, and speaking style throughout.
Do NOT change vocal quality, accent, or cadence at any point.`;

    return NextResponse.json({
      signedUrl,
      dynamicVariables: {
        prospect_context,
        offer_info,
        first_message: initialMessage.content,
        ...(practice_mode ? { practice_mode, practice_context } : {}),
      },
      voiceId,
      // Keep systemPrompt and firstMessage for text-mode fallback
      systemPrompt,
      firstMessage: initialMessage.content,
      prospectName,
    });
  } catch (error: any) {
    logger.error('ROLEPLAY', 'Failed to generate voice token', error, { sessionId });
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
