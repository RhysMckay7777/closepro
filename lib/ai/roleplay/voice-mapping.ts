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

/**
 * Voice configuration for TTS with speed and stability parameters
 */
export interface VoiceConfig {
  voiceId: string;
  speed?: number; // 0.5 to 2.0, default 1.0
  stability?: number; // 0.0 to 1.0, default 0.5
  similarityBoost?: number; // 0.0 to 1.0
  style?: number; // 0.0 to 1.0
}

/**
 * Character archetype to voice parameter mapping
 * Used to match prospect personality to appropriate voice characteristics
 */
const CHARACTER_VOICE_MAP: Record<string, Partial<VoiceConfig> & { voiceLabel: string }> = {
  // Busy/casual types - warmer, slightly faster
  'busy parent': { voiceLabel: 'warm', speed: 1.1, stability: 0.6 },
  'busy dad': { voiceLabel: 'warm male', speed: 1.1, stability: 0.6 },
  'busy mom': { voiceLabel: 'warm female', speed: 1.1, stability: 0.6 },
  'casual': { voiceLabel: 'casual', speed: 1.0, stability: 0.5 },

  // Professional types - clear, measured
  'professional': { voiceLabel: 'professional', speed: 1.0, stability: 0.7 },
  'executive': { voiceLabel: 'authoritative', speed: 0.95, stability: 0.8 },
  'secretary': { voiceLabel: 'professional female', speed: 1.0, stability: 0.7 },

  // Skeptical/sharp types - faster, more clipped
  'skeptical': { voiceLabel: 'authoritative', speed: 1.15, stability: 0.6 },
  'sharp': { voiceLabel: 'authoritative', speed: 1.15, stability: 0.7 },
  'b2b founder': { voiceLabel: 'authoritative male', speed: 1.1, stability: 0.7 },
  'business owner': { voiceLabel: 'professional male', speed: 1.05, stability: 0.65 },

  // Friendly/open types - warmer, normal pace
  'friendly': { voiceLabel: 'friendly', speed: 1.0, stability: 0.5 },
  'open': { voiceLabel: 'friendly', speed: 1.0, stability: 0.5 },
  'eager': { voiceLabel: 'friendly', speed: 1.1, stability: 0.5 },

  // Hostile/difficult types - faster, less stable (more variation)
  'hostile': { voiceLabel: 'authoritative', speed: 1.2, stability: 0.4 },
  'impatient': { voiceLabel: 'authoritative', speed: 1.25, stability: 0.5 },
  'advisor': { voiceLabel: 'authoritative', speed: 0.95, stability: 0.8 },
};

/**
 * Get comprehensive voice configuration for a prospect avatar
 * Maps prospect profile to voice parameters for realistic TTS
 * 
 * @param prospectAvatar - Prospect avatar with profile data
 * @returns VoiceConfig with voiceId and optional parameters
 */
export function getProspectVoiceConfig(prospectAvatar: {
  name: string;
  voiceStyle?: string | null;
  positionDescription?: string | null;
  difficultyTier?: string | null;
  authorityLevel?: string | null;
}): VoiceConfig {
  // Start with the base voice ID
  const voiceId = getVoiceIdFromProspect({
    name: prospectAvatar.name,
    voiceStyle: prospectAvatar.voiceStyle,
  });

  const config: VoiceConfig = {
    voiceId,
    speed: 1.0,
    stability: 0.5,
    similarityBoost: 0.75,
  };

  // Try to match character archetype from position description
  const positionLower = (prospectAvatar.positionDescription || '').toLowerCase();

  for (const [archetype, voiceParams] of Object.entries(CHARACTER_VOICE_MAP)) {
    if (positionLower.includes(archetype)) {
      // Use the archetype's voice label to get the voice ID
      const archetypeVoiceId = LABEL_TO_VOICE[voiceParams.voiceLabel] || voiceId;
      config.voiceId = archetypeVoiceId;
      if (voiceParams.speed) config.speed = voiceParams.speed;
      if (voiceParams.stability) config.stability = voiceParams.stability;
      break;
    }
  }

  // Adjust based on authority level
  if (prospectAvatar.authorityLevel === 'advisor') {
    config.speed = Math.min(config.speed || 1.0, 0.95); // Slower, more measured
    config.stability = Math.max(config.stability || 0.5, 0.75); // More stable
  } else if (prospectAvatar.authorityLevel === 'advisee') {
    config.speed = Math.max(config.speed || 1.0, 1.05); // Slightly faster
  }

  // Adjust based on difficulty tier
  if (prospectAvatar.difficultyTier === 'hard' || prospectAvatar.difficultyTier === 'elite') {
    config.speed = Math.min((config.speed || 1.0) + 0.05, 1.25); // Slightly faster
    config.stability = Math.min((config.stability || 0.5) + 0.1, 0.85); // More controlled
  } else if (prospectAvatar.difficultyTier === 'easy') {
    config.stability = Math.max((config.stability || 0.5) - 0.1, 0.35); // More natural variation
  }

  return config;
}

