/**
 * TTS Provider Interface — Abstract contract for text-to-speech implementations.
 * All providers must implement speak() and stop().
 */

export interface TTSProvider {
  /** Speak the given text. Returns a promise that resolves when playback finishes. */
  speak(text: string, voiceId?: string): Promise<void>;
  /** Immediately stop any ongoing playback. */
  stop(): void;
  /** Whether the provider is currently playing audio. */
  isSpeaking(): boolean;
}
