/**
 * Sales Call Scoring Categories — Connor's Framework
 * The 10 canonical categories used for scoring ALL sales interactions
 * (both call analysis and roleplay scoring).
 *
 * IMPORTANT: These are the ONLY valid scoring categories.
 * The 4 pillars (Value, Trust, Fit, Logistics) are objection classifiers,
 * NOT scoring categories. Performance pages must use these 10 categories.
 */

export const SCORING_CATEGORIES = [
    'authority_leadership',
    'structure_framework',
    'communication_storytelling',
    'discovery_diagnosis',
    'gap_urgency',
    'value_offer_positioning',
    'objection_handling',
    'emotional_intelligence',
    'closing_commitment',
    'tonality_delivery',
] as const;

export type ScoringCategoryId = (typeof SCORING_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ScoringCategoryId, string> = {
    authority_leadership: 'Authority & Leadership',
    structure_framework: 'Structure & Framework',
    communication_storytelling: 'Communication & Storytelling',
    discovery_diagnosis: 'Discovery & Diagnosis',
    gap_urgency: 'Gap & Urgency',
    value_offer_positioning: 'Value & Offer Positioning',
    objection_handling: 'Objection Handling',
    emotional_intelligence: 'Emotional Intelligence',
    closing_commitment: 'Closing & Commitment',
    tonality_delivery: 'Tonality & Delivery',
};

/**
 * Category descriptions for AI prompt context.
 * Each describes what the AI should evaluate for a given category.
 */
export const CATEGORY_DESCRIPTIONS: Record<ScoringCategoryId, string> = {
    authority_leadership:
        'How the closer controls the frame, leads the conversation, and positions themselves as an authority figure the prospect respects.',
    structure_framework:
        'How well the closer follows a structured sales process — opening, discovery, offer, objection handling, close — without skipping or rushing stages.',
    communication_storytelling:
        'Use of stories, analogies, examples, and metaphors to make the offer tangible and memorable. Clarity of language.',
    discovery_diagnosis:
        'Depth of questioning — does the closer uncover the real problem, root causes, emotions, and consequences? Or do they stay surface-level?',
    gap_urgency:
        'How effectively the closer highlights the gap between where the prospect is now and where they want to be, and creates urgency to act.',
    value_offer_positioning:
        'How well the closer positions the offer as the bridge between the prospect\'s current state and desired outcome. Value > price.',
    objection_handling:
        'How the closer handles pushback — do they acknowledge, reframe, and resolve? Or do they argue, cave, or ignore?',
    emotional_intelligence:
        'Reading the room — pacing, empathy, knowing when to push and when to pull back. Matching the prospect\'s energy.',
    closing_commitment:
        'How the closer asks for the commitment — is it assumptive, direct, and confident? Or weak, hesitant, and avoidable?',
    tonality_delivery:
        'Voice tonality, pacing, pauses, emphasis. Does the closer sound confident, warm, and in control? Or monotone, nervous, or rushed?',
};

/**
 * The 4 objection pillars — used ONLY for classifying objections,
 * NOT as scoring categories.
 */
export const OBJECTION_PILLARS = ['value', 'trust', 'fit', 'logistics'] as const;
export type ObjectionPillar = (typeof OBJECTION_PILLARS)[number];

export const OBJECTION_PILLAR_LABELS: Record<ObjectionPillar, string> = {
    value: 'Value',
    trust: 'Trust',
    fit: 'Fit',
    logistics: 'Logistics',
};

/**
 * Get display label for a category ID.
 * Falls back to the raw ID if not found.
 */
export function getCategoryLabel(id: string): string {
    return CATEGORY_LABELS[id as ScoringCategoryId] ?? id;
}
