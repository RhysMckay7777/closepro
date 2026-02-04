/**
 * Voice Mapping Utility for Prospect Avatars
 * 
 * Maps prospect voice_style (voice ID or descriptive label) to ElevenLabs voice IDs.
 * Auto-selects a voice based on prospect name if voice_style is empty.
 * 
 * Curated voice IDs are stable, natural-sounding ElevenLabs voices covering different character types.
 */

// Curated ElevenLabs voice IDs for different character types
// These are stable, natural-sounding voices that work well for roleplay
const CURATED_VOICES = {
  // Professional female voices
  professionalFemale: '21m00Tcm4TlvDq8ikWAM', // Rachel - warm, expressive, professional
  warmFemale: 'EXAVITQu4vr4xnSDxMaL', // Bella - warm, friendly female
  
  // Professional male voices
  professionalMale: 'pNInz6obpgDQGcFmaJgB', // Adam - clear, professional male
  authoritativeMale: 'yoZ06aMxZJJ28mfd3POQ', // Antoni - deep, authoritative male
  friendlyMale: 'TxGEqnHWrfWFTfGW9XjX', // Josh - friendly, conversational male
  
  // Warm, casual voices
  warmCasual: 'VR6AewLTigWG4xSOukaG', // Arnold - warm, casual male
};

// Mapping from descriptive labels to voice IDs
const LABEL_TO_VOICE: Record<string, string> = {
  // Professional styles
  'professional': CURATED_VOICES.professionalFemale,
  'professional female': CURATED_VOICES.professionalFemale,
  'professional male': CURATED_VOICES.professionalMale,
  
  // Authoritative styles
  'authoritative': CURATED_VOICES.authoritativeMale,
  'authoritative male': CURATED_VOICES.authoritativeMale,
  'commanding': CURATED_VOICES.authoritativeMale,
  'deep': CURATED_VOICES.authoritativeMale,
  
  // Friendly styles
  'friendly': CURATED_VOICES.friendlyMale,
  'friendly male': CURATED_VOICES.friendlyMale,
  'friendly female': CURATED_VOICES.warmFemale,
  'conversational': CURATED_VOICES.friendlyMale,
  
  // Warm styles
  'warm': CURATED_VOICES.warmFemale,
  'warm female': CURATED_VOICES.warmFemale,
  'warm male': CURATED_VOICES.warmCasual,
  'casual': CURATED_VOICES.warmCasual,
  
  // Default fallbacks
  'default': CURATED_VOICES.professionalFemale,
  'female': CURATED_VOICES.professionalFemale,
  'male': CURATED_VOICES.professionalMale,
};

// Default fallback voice (Rachel - most natural and widely available)
const DEFAULT_VOICE_ID = CURATED_VOICES.professionalFemale;

/**
 * Checks if a string looks like an ElevenLabs voice ID
 * Voice IDs are typically alphanumeric strings around 20 characters
 */
function isVoiceId(str: string): boolean {
  // ElevenLabs voice IDs are alphanumeric, typically 20-25 chars
  return /^[a-zA-Z0-9]{18,30}$/.test(str.trim());
}

/**
 * Simple hash function to consistently map a string to a number
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Auto-selects a voice ID based on prospect name
 * Uses consistent hashing so the same prospect always gets the same voice
 */
function autoSelectVoice(prospectName: string): string {
  const voiceArray = Object.values(CURATED_VOICES);
  const hash = hashString(prospectName.trim().toLowerCase());
  const index = hash % voiceArray.length;
  return voiceArray[index];
}

/**
 * Normalizes a voice style label for matching
 */
function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

/**
 * Gets the ElevenLabs voice ID for a prospect avatar
 * 
 * Priority:
 * 1. If voiceStyle is a voice ID → use it directly
 * 2. If voiceStyle matches a label → map to voice ID
 * 3. If voiceStyle is empty → auto-select based on prospect name
 * 4. Fallback → env ELEVENLABS_VOICE_ID or default voice
 * 
 * @param prospectAvatar - Prospect avatar object with name and optional voiceStyle
 * @returns ElevenLabs voice ID string
 */
export function getVoiceIdFromProspect(prospectAvatar: {
  name: string;
  voiceStyle?: string | null;
}): string {
  // Fallback to env or default if no prospect
  if (!prospectAvatar?.name) {
    return process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID;
  }

  const voiceStyle = prospectAvatar.voiceStyle?.trim();
  
  // Case 1: voiceStyle is a voice ID (alphanumeric, ~20 chars)
  if (voiceStyle && isVoiceId(voiceStyle)) {
    return voiceStyle;
  }
  
  // Case 2: voiceStyle is a descriptive label
  if (voiceStyle) {
    const normalized = normalizeLabel(voiceStyle);
    const mappedVoice = LABEL_TO_VOICE[normalized];
    if (mappedVoice) {
      return mappedVoice;
    }
    // If label doesn't match, try partial matches (e.g., "professional woman" → "professional")
    for (const [label, voiceId] of Object.entries(LABEL_TO_VOICE)) {
      if (normalized.includes(label) || label.includes(normalized)) {
        return voiceId;
      }
    }
  }
  
  // Case 3: Auto-select based on prospect name (consistent hashing)
  const autoVoice = autoSelectVoice(prospectAvatar.name);
  
  // Case 4: Final fallback
  return process.env.ELEVENLABS_VOICE_ID?.trim() || autoVoice || DEFAULT_VOICE_ID;
}

/**
 * Gets a list of available voice labels for UI display
 */
export function getAvailableVoiceLabels(): string[] {
  return Object.keys(LABEL_TO_VOICE).filter(key => 
    !['default', 'female', 'male'].includes(key)
  );
}
