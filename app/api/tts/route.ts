import { NextRequest, NextResponse } from 'next/server';

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

export const maxDuration = 60;

/**
 * POST - Text to speech via ElevenLabs (when ELEVENLABS_API_KEY is set).
 * Body: { text: string, voiceId?: string }
 * Returns: audio/mpeg stream, or 503 with fallback: true so client uses browser speech.
 * 401/403 = quota or free-tier disabled – we return 503 so client falls back to SpeechSynthesis.
 */
export async function POST(request: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  console.log('[TTS] ElevenLabs API key:', apiKey ? `SET (${apiKey.length} chars)` : 'MISSING');
  if (!apiKey?.trim()) {
    console.warn('[TTS] ELEVENLABS_API_KEY not configured — falling back to browser speech');
    return NextResponse.json(
      { error: 'TTS not configured', fallback: true },
      { status: 503 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const voiceId = typeof body.voiceId === 'string' ? body.voiceId.trim() : process.env.ELEVENLABS_VOICE_ID?.trim() || 'pNInz6obpgDQGcFmaJgB';
    console.log(`[TTS] Requesting voice=${voiceId}, text length=${text.length}`);

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
        model_id: 'eleven_multilingual_v2',
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      // 401/403 = auth or free-tier disabled (e.g. "Unusual activity", "Free Tier usage disabled")
      if (res.status === 401 || res.status === 403) {
        console.warn(`[TTS] ElevenLabs auth/quota error (${res.status}):`, errText.slice(0, 300));
        return NextResponse.json(
          { error: 'ElevenLabs unavailable (use browser voice or upgrade plan)', fallback: true },
          { status: 503 }
        );
      }
      console.error(`[TTS] ElevenLabs error (${res.status}):`, errText.slice(0, 300));
      return NextResponse.json(
        { error: 'TTS request failed', fallback: true },
        { status: 503 }
      );
    }

    const audioBuffer = await res.arrayBuffer();
    console.log(`[TTS] ElevenLabs SUCCESS — ${audioBuffer.byteLength} bytes`);
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[TTS] Unexpected error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'TTS failed', fallback: true },
      { status: 503 }
    );
  }
}
