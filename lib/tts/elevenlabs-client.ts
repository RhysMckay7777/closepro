/**
 * ElevenLabs TTS Client — calls /api/tts server route and plays audio via HTML5 Audio.
 * Implements TTSProvider interface for use in roleplay sessions.
 */

import type { TTSProvider } from './tts-provider';

export class ElevenLabsClient implements TTSProvider {
  private currentAudio: HTMLAudioElement | null = null;
  private speaking = false;

  async speak(text: string, voiceId?: string): Promise<void> {
    // Stop any ongoing playback first
    this.stop();

    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceId }),
    });

    if (!res.ok || !res.headers.get('content-type')?.includes('audio')) {
      // Parse error for better messaging
      let errorMsg = 'TTS request failed';
      try {
        const errData = await res.json();
        errorMsg = errData.error || errorMsg;
      } catch { /* ignore */ }
      throw new Error(errorMsg);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    return new Promise<void>((resolve, reject) => {
      const audio = new Audio(url);
      this.currentAudio = audio;
      this.speaking = true;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        this.currentAudio = null;
        this.speaking = false;
        resolve();
      };

      audio.onerror = () => {
        URL.revokeObjectURL(url);
        this.currentAudio = null;
        this.speaking = false;
        reject(new Error('Audio playback failed'));
      };

      audio.play().catch((err) => {
        URL.revokeObjectURL(url);
        this.currentAudio = null;
        this.speaking = false;
        reject(err);
      });
    });
  }

  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.src = '';
      this.currentAudio = null;
    }
    this.speaking = false;
  }

  isSpeaking(): boolean {
    return this.speaking;
  }
}
