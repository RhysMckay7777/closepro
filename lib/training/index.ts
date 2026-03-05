/**
 * Connor's Training Framework — Central Exports
 * Single source of truth for all AI prompts in ClosePro.
 */

export {
    PROSPECT_DIFFICULTY_MODEL,
    DIFFICULTY_BANDS,
    getDifficultyBand,
    // v2.0 exports
    PROSPECT_DIFFICULTY_MODEL_V2,
    V2_DIFFICULTY_BANDS,
    V2_DIFFICULTY_DIMENSIONS,
    V2_DIFFICULTY_DIMENSION_LABELS,
    getDifficultyBandV2,
} from './prospect-difficulty-model';

export type { V2DifficultyDimension } from './prospect-difficulty-model';

export {
    SCORING_CATEGORIES,
    CATEGORY_LABELS,
    CATEGORY_DESCRIPTIONS,
    OBJECTION_PILLARS,
    OBJECTION_PILLAR_LABELS,
    getCategoryLabel,
    ROLEPLAY_FEEDBACK_DIMENSIONS,
    ROLEPLAY_FEEDBACK_LABELS,
    ROLEPLAY_FEEDBACK_DESCRIPTIONS,
    ROLEPLAY_FEEDBACK_PROMPT,
} from './scoring-categories';

export type { ScoringCategoryId, ObjectionPillar, RoleplayFeedbackDimensionId } from './scoring-categories';

export { ROLEPLAY_BEHAVIORAL_RULES } from './roleplay-behavioral-rules';

export {
    PROSPECT_BACKSTORY_INSTRUCTIONS,
    CURRENT_JOBS,
    PREVIOUS_ATTEMPTS,
    REFERRAL_SOURCES,
    FINANCIAL_SITUATIONS,
} from './prospect-backstories';

export type { FinancialSituationId } from './prospect-backstories';

export {
    CORE_PRINCIPLES,
    getPrincipleForCategory,
    computePrincipleScores,
} from './core-principles';

export type { CorePrinciple, PrincipleScore } from './core-principles';

export {
    DISCOVERY_PHASE_BEHAVIOUR,
    DISCOVERY_RESPONSE_LIMITS,
    DISCOVERY_HARD_CAP_SENTENCES,
    PEER_UNLOCK_TRIGGERS,
    DISCOVERY_EXIT_PATTERNS,
} from './discovery-phase-behaviour';

export {
    DRIFT_PREVENTION_RULES,
    CHARACTER_SHEET_RULES,
    formatCharacterSheet,
    generateSpeechPatterns,
    generateObjectionSet,
    generateFinancialReality,
} from './character-sheet-wrapper';

export type {
    CharacterSheet,
    CharacterSheetIdentity,
    CharacterSheetScores,
    CharacterSheetAuthority,
    CharacterSheetSpeechPatterns,
    CharacterSheetBackstory,
    CharacterSheetObjectionSet,
    CharacterSheetOfferContext,
} from './character-sheet-wrapper';

export {
    CLOSE_PHASE_BEHAVIOUR,
    CLOSE_RESPONSE_LIMITS,
    CLOSE_HARD_CAP_SENTENCES,
    CLOSE_ENTRY_PATTERNS,
    GOOD_HANDLING_PATTERNS,
    MANIPULATIVE_HANDLING_PATTERNS,
    COMMITMENT_PATTERNS,
} from './close-phase-behaviour';

export {
    PITCH_PHASE_BEHAVIOUR,
    PITCH_RESPONSE_LIMITS,
    PITCH_HARD_CAP_SENTENCES,
    PITCH_TO_CLOSE_PATTERNS,
    PITCH_CHECKIN_PATTERNS,
    PITCH_PERSONALISATION_PATTERNS,
} from './pitch-phase-behaviour';

export {
    INTRO_PHASE_BEHAVIOUR,
    INTRO_RESPONSE_LIMITS,
    INTRO_HARD_CAP_SENTENCES,
    INTRO_GREETINGS,
    PRE_CALL_CONTENT_RESPONSES,
    INTRO_EXIT_PATTERNS,
} from './intro-phase-behaviour';
