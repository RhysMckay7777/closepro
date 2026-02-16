Fix the TTS override field names in hooks/use-voice-session.ts. Do not change any other files.
The ElevenLabs Conversational AI SDK (@11labs/react) expects TTS override fields in camelCase when passed through startSession:


voiceId ✅ (already correct)


stability ✅ (already correct)


speed ✅ (already correct)


But the voice-token/route.ts returns voiceSettings with similarityBoost, and our code spreads it directly into the tts override object. The SDK only auto-maps voiceId → voice_id. It does NOT map similarityBoost → similarity_boost. ElevenLabs sees an unknown field and rejects the connection.
Fix in hooks/use-voice-session.ts:
In both startSession calls (inside startVoice and inside attemptReconnect), change the tts override from:
tts: {
  voiceId,
  ...voiceSettings,  // ← BAD: spreads similarityBoost which is unknown
},

To:
tts: {
  voiceId,
  stability: voiceSettings?.stability,
  speed: voiceSettings?.speed,
  // Do NOT pass similarityBoost — not supported in Conversational AI overrides
},

Only voiceId, stability, and speed are valid TTS overrides for ElevenLabs Conversational AI agents. similarity_boost is only available in the REST TTS API, not the real-time WebSocket agent API.
After this change, the WebSocket should connect and stay connected. The "Voice connection rejected" error should disappear.