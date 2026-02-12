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
} from './scoring-categories';

export type { ScoringCategoryId, ObjectionPillar } from './scoring-categories';

export { ROLEPLAY_BEHAVIORAL_RULES } from './roleplay-behavioral-rules';
