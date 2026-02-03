import { NextRequest, NextResponse } from 'next/server';

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

/**
 * POST - Text to speech via ElevenLabs (when ELEVENLABS_API_KEY is set).
 * Body: { text: string, voiceId?: string }
 * Returns: audio/mpeg stream, or 503 with fallback: true so client uses browser speech.
 * 401/403 = quota or free-tier disabled – we return 503 so client falls back to SpeechSynthesis.
 */
export async function POST(request: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey?.trim()) {
    return NextResponse.json(
      { error: 'TTS not configured', fallback: true },
      { status: 503 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const voiceId = typeof body.voiceId === 'string' ? body.voiceId.trim() : process.env.ELEVENLABS_VOICE_ID?.trim() || '21m00Tcm4TlvDq8ikWAM';

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
        if (process.env.NODE_ENV === 'development') {
          console.warn('ElevenLabs TTS unavailable (auth/quota). Use browser voice or a paid ElevenLabs plan.', res.status);
        }
        return NextResponse.json(
          { error: 'ElevenLabs unavailable (use browser voice or upgrade plan)', fallback: true },
          { status: 503 }
        );
      }
      if (process.env.NODE_ENV === 'development') {
        console.error('ElevenLabs TTS error:', res.status, errText.slice(0, 200));
      }
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
    if (process.env.NODE_ENV === 'development') {
      console.error('TTS error:', error);
    }
    return NextResponse.json(
      { error: 'TTS failed', fallback: true },
      { status: 503 }
    );
  }
}
