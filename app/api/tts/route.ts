import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

export const maxDuration = 60;

/**
 * POST - Text to speech via ElevenLabs Turbo v2.5.
 * Body: { text: string, voiceId?: string }
 * Returns: audio/mpeg stream, or 503 with error details.
 * Default voice: "George" (British male, JBFqnCBsd6RMkjVDRZzb).
 */
export async function POST(request: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey?.trim()) {
    logger.warn('TTS', 'ELEVENLABS_API_KEY not configured — falling back to browser speech');
    return NextResponse.json(
      { error: 'TTS not configured', fallback: true },
      { status: 503 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const voiceId = typeof body.voiceId === 'string' ? body.voiceId.trim() : process.env.ELEVENLABS_VOICE_ID?.trim() || 'JBFqnCBsd6RMkjVDRZzb';

    if (!text) {
      return NextResponse.json(
        { error: 'Missing or empty text' },
        { status: 400 }
      );
    }

    const res = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: 'POST',
      headers: {
        Accept: 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      // 401/403 = auth or free-tier disabled (e.g. "Unusual activity", "Free Tier usage disabled")
      if (res.status === 401 || res.status === 403) {
        logger.warn('TTS', `ElevenLabs auth/quota error (${res.status})`, { body: errText.slice(0, 200) });
        return NextResponse.json(
          { error: 'ElevenLabs unavailable (use browser voice or upgrade plan)', fallback: true },
          { status: 503 }
        );
      }
      logger.error('TTS', `ElevenLabs error (${res.status})`, undefined, { body: errText.slice(0, 200) });
      return NextResponse.json(
        { error: 'TTS request failed', fallback: true },
        { status: 503 }
      );
    }

    const audioBuffer = await res.arrayBuffer();
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    logger.error('TTS', 'Unexpected TTS error', error);
    return NextResponse.json(
      { error: 'TTS failed', fallback: true },
      { status: 503 }
    );
  }
}
