import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { salesCalls, prospectAvatars, offers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { users, userOrganizations } from '@/db/schema';
import { calculateDifficultyIndex } from '@/lib/ai/roleplay/prospect-avatar';
import { transcribeAudioFile } from '@/lib/ai/transcription';
import { Groq } from 'groq-sdk';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

export const maxDuration = 60;

/**
 * POST - Extract prospect avatar from a sales call transcript or audio file
 * This analyzes the transcript and creates a prospect avatar for replay roleplays
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

    let transcriptText: string | null = null;
    let sourceCallId: string | null = null;
    let offerId: string | null = null;

    // Check if request is FormData (file upload) or JSON
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload (small files via FormData)
      const formData = await request.formData();
      const audioFile = formData.get('audio') as File | null;
      const transcriptInput = formData.get('transcript') as string | null;
      offerId = formData.get('offerId') as string | null;

      if (audioFile) {
        // Transcribe audio file from buffer
        const arrayBuffer = await audioFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const transcriptionResult = await transcribeAudioFile(buffer, audioFile.name);
        transcriptText = transcriptionResult.transcript;
      } else if (transcriptInput) {
        transcriptText = transcriptInput;
      } else {
        return NextResponse.json(
          { error: 'Either audio file or transcript is required' },
          { status: 400 }
        );
      }
    } else {
      // Handle JSON request
      const body = await request.json();
      const { callId, transcript, offerId: bodyOfferId, fileUrl, fileName } = body;

      if (fileUrl && fileName) {
        // File already uploaded to Vercel Blob — transcribe from URL
        const transcriptionResult = await transcribeAudioFile(null, fileName, fileUrl);
        transcriptText = transcriptionResult.transcript;
        offerId = bodyOfferId || null;
      } else if (!callId && !transcript) {
        return NextResponse.json(
          { error: 'Either callId, transcript, or fileUrl is required' },
          { status: 400 }
        );
      } else {
        transcriptText = transcript;
        sourceCallId = callId || null;
        offerId = bodyOfferId || null;
      }
    }

    // NOR ToUCHHH THISS PARTT OOOHH... NOO TRYYY AMMMM AT ALLL
    if (sourceCallId && !transcriptText) {
      const call = await db
        .select()
        .from(salesCalls)
        .where(
          and(
            eq(salesCalls.id, sourceCallId),
            eq(salesCalls.userId, session.user.id)
          )
        )
        .limit(1);

      if (!call[0]) {
        return NextResponse.json(
          { error: 'Call not found' },
          { status: 404 }
        );
      }

      transcriptText = call[0].transcript;
      if (!transcriptText) {
        return NextResponse.json(
          { error: 'Call transcript not available' },
          { status: 400 }
        );
      }
    }

    if (!transcriptText) {
      return NextResponse.json(
        { error: 'Transcript is required' },
        { status: 400 }
      );
    }

    // Verify offerId was provided
    if (!offerId) {
      return NextResponse.json(
        { error: 'offerId is required. All prospects must belong to an offer.' },
        { status: 400 }
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
        { error: 'No organization found' },
        { status: 400 }
      );
    }

    // Verify user has access to the offer
    const userOrgIds = userOrg.map(uo => uo.organizationId);
    if (!userOrgIds.includes(offer[0].organizationId)) {
      return NextResponse.json(
        { error: 'Access denied to this offer' },
        { status: 403 }
      );
    }

    // Extract prospect intelligence using AI
    if (!groq) {
      return NextResponse.json(
        { error: 'AI service not configured. Please set GROQ_API_KEY.' },
        { status: 500 }
      );
    }

    const extractionPrompt = `Analyze this sales call transcript and extract the PROSPECT's profile. Focus only on the prospect's side of the conversation.

Transcript:
${transcriptText.substring(0, 8000)} ${transcriptText.length > 8000 ? '...' : ''}

Extract and return JSON with:
{
  "positionProblemAlignment": number (0-10, how well prospect's position/problems align with typical offer),
  "painAmbitionIntensity": number (0-10, strength of pain or ambition),
  "perceivedNeedForHelp": number (0-10, how much they believe they need help),
  "authorityLevel": "advisee" | "peer" | "advisor",
  "funnelContext": number (0-10, how warm/cold: 0-3 cold, 4-6 warm, 7-8 educated, 9-10 referral),
  "executionResistance": number (0-10, ability to proceed: 8-10 fully able with money/time/authority, 5-7 partial ability needs reprioritization, 1-4 extreme resistance with severe constraints),
  "positionDescription": string (brief description of their current situation),
  "problems": string[] (key problems mentioned),
  "painDrivers": string[] (pain-based motivations),
  "ambitionDrivers": string[] (ambition-based motivations),
  "resistanceStyle": {
    "objectionPatterns": string[],
    "tone": string,
    "typicalResponses": object
  },
  "behaviouralBaseline": {
    "answerDepth": "shallow" | "medium" | "deep",
    "openness": "closed" | "cautious" | "open",
    "responseSpeed": "slow" | "normal" | "fast"
  }
}

For executionResistance, look for signals like:
- Money constraints mentioned (can't afford, budget issues) → lower score
- Time availability (too busy, scheduling conflicts) → lower score
- Decision authority (needs to check with spouse/boss) → lower score
- External dependencies (waiting for something else) → lower score
- Ready to proceed, has resources → higher score

Return ONLY valid JSON, no markdown formatting.`;

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at analyzing sales conversations. Extract prospect intelligence accurately. Always return valid JSON.',
        },
        {
          role: 'user',
          content: extractionPrompt,
        },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const extracted = JSON.parse(content);

    // Calculate difficulty (50-point model)
    const { index: difficultyIndex, tier: difficultyTier } = calculateDifficultyIndex(
      extracted.positionProblemAlignment || 5,
      extracted.painAmbitionIntensity || 5,
      extracted.perceivedNeedForHelp || 5,
      extracted.authorityLevel || 'peer',
      extracted.funnelContext || 5,
      extracted.executionResistance || 5 // Default to medium ability if not extracted
    );

    // Create prospect avatar
    const [newAvatar] = await db
      .insert(prospectAvatars)
      .values({
        organizationId: offer[0].organizationId,
        offerId: offerId,
        userId: session.user.id,
        name: extracted.positionDescription
          ? `Prospect: ${extracted.positionDescription.substring(0, 50)}`
          : 'Extracted Prospect',
        sourceType: 'transcript_derived',
        sourceTranscriptId: sourceCallId,
        positionProblemAlignment: extracted.positionProblemAlignment || 5,
        painAmbitionIntensity: extracted.painAmbitionIntensity || 5,
        perceivedNeedForHelp: extracted.perceivedNeedForHelp || 5,
        authorityLevel: extracted.authorityLevel || 'peer',
        funnelContext: extracted.funnelContext || 5,
        executionResistance: extracted.executionResistance || 5,
        difficultyIndex,
        difficultyTier,
        positionDescription: extracted.positionDescription || null,
        problems: extracted.problems ? JSON.stringify(extracted.problems) : null,
        painDrivers: extracted.painDrivers ? JSON.stringify(extracted.painDrivers) : null,
        ambitionDrivers: extracted.ambitionDrivers ? JSON.stringify(extracted.ambitionDrivers) : null,
        resistanceStyle: extracted.resistanceStyle ? JSON.stringify(extracted.resistanceStyle) : null,
        behaviouralBaseline: extracted.behaviouralBaseline ? JSON.stringify(extracted.behaviouralBaseline) : null,
        isTemplate: false,
        isActive: true,
      })
      .returning();

    return NextResponse.json({
      avatar: newAvatar,
      message: 'Prospect extracted successfully',
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error extracting prospect:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to extract prospect' },
      { status: 500 }
    );
  }
}
