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
    'authority',
    'structure',
    'communication',
    'discovery',
    'gap',
    'value',
    'trust',
    'adaptation',
    'objection_handling',
    'closing',
] as const;

export type ScoringCategoryId = (typeof SCORING_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ScoringCategoryId, string> = {
    authority: 'Authority',
    structure: 'Structure',
    communication: 'Communication',
    discovery: 'Discovery',
    gap: 'Gap',
    value: 'Value',
    trust: 'Trust',
    adaptation: 'Adaptation',
    objection_handling: 'Objection Handling',
    closing: 'Closing',
};

/**
 * Category descriptions — each is the core question the AI should answer.
 */
export const CATEGORY_DESCRIPTIONS: Record<ScoringCategoryId, string> = {
    authority:
        'How well does the closer control the frame, lead the conversation, and position themselves as an authority figure the prospect respects?',
    structure:
        'How well does the closer follow a structured sales process — opening, discovery, offer, objection handling, close — without skipping or rushing stages?',
    communication:
        'How effectively does the closer use stories, analogies, examples, and metaphors to make the offer tangible and memorable? Clarity of language.',
    discovery:
        'How deep is the questioning — does the closer uncover the real problem, root causes, emotions, and consequences? Or stay surface-level?',
    gap:
        'How effectively does the closer highlight the gap between the prospect\'s current state and desired outcome, and create urgency to act?',
    value:
        'How well does the closer position the offer as the bridge between the prospect\'s current state and desired outcome? Value > price.',
    trust:
        'Reading the room — pacing, empathy, knowing when to push and when to pull back. Building genuine rapport and safety.',
    adaptation:
        'Voice tonality, pacing, pauses, emphasis. Does the closer adapt their delivery style to the prospect and situation?',
    objection_handling:
        'How does the closer handle pushback — do they acknowledge, reframe, and resolve? Or argue, cave, or ignore?',
    closing:
        'How does the closer ask for the commitment — is it assumptive, direct, and confident? Or weak, hesitant, and avoidable?',
};

/**
 * Subcategory definition — each has a stable ID and display name.
 */
export interface Subcategory {
    id: string;
    name: string;
}

/**
 * Subcategories for each scoring category — Connor's Framework (49 total).
 * Each subcategory is a named evaluation dimension the AI scores.
 */
export const CATEGORY_SUBCATEGORIES: Record<ScoringCategoryId, Subcategory[]> = {
    authority: [
        { id: 'position_based_authority', name: 'Position-Based Authority' },
        { id: 'skill_based_authority', name: 'Skill-Based Authority' },
        { id: 'conversational_authority', name: 'Conversational Authority' },
        { id: 'personal_authority', name: 'Personal Authority' },
    ],
    structure: [
        { id: 'overall_intentional_flow', name: 'Overall Intentional Flow' },
        { id: 'introduction_framing', name: 'Introduction & Framing' },
        { id: 'discovery_priority', name: 'Discovery Priority' },
        { id: 'pitch_placement_structure', name: 'Pitch Placement & Structure' },
        { id: 'close_placement', name: 'Close Placement' },
        { id: 'transitions', name: 'Transitions' },
    ],
    communication: [
        { id: 'framing_reframing', name: 'Framing & Reframing' },
        { id: 'storytelling_analogies', name: 'Storytelling & Analogies' },
        { id: 'tonality', name: 'Tonality' },
        { id: 'conversational_flow', name: 'Conversational Flow' },
    ],
    discovery: [
        { id: 'current_state', name: 'Current State' },
        { id: 'problem_identification', name: 'Problem Identification' },
        { id: 'impact_pain_severity', name: 'Impact, Pain & Severity' },
        { id: 'why_theyre_stuck', name: "Why They're Stuck" },
        { id: 'depth_control_diagnostic', name: 'Depth Control & Diagnostic Skill' },
    ],
    gap: [
        { id: 'desired_state_clarity', name: 'Desired State Clarity' },
        { id: 'emotional_strategic_importance', name: 'Emotional / Strategic Importance' },
        { id: 'gap_creation', name: 'Gap Creation' },
        { id: 'capability_gap', name: 'Capability Gap' },
        { id: 'urgency_consequence_framing', name: 'Urgency & Consequence Framing' },
        { id: 'readiness_priority_check', name: 'Readiness & Priority Check' },
    ],
    value: [
        { id: 'value_seeding', name: 'Value Seeding' },
        { id: 'offer_to_problem_alignment', name: 'Offer-to-Problem Alignment' },
        { id: 'tailored_pitch_delivery', name: 'Tailored Pitch Delivery' },
        { id: 'ups_vs_usp', name: 'UPS vs USP' },
        { id: 'value_logic', name: 'Value Logic' },
        { id: 'outcome_likelihood_logic', name: 'Outcome Likelihood Logic' },
    ],
    trust: [
        { id: 'credibility_proof_usage', name: 'Credibility & Proof Usage' },
        { id: 'trust_in_company_offer', name: 'Trust in Company & Offer' },
        { id: 'rep_trust_signals', name: 'Rep Trust Signals' },
        { id: 'prospect_self_trust', name: 'Prospect Self-Trust' },
        { id: 'ethics_safety_boundary', name: 'Ethics & Safety Boundary' },
    ],
    adaptation: [
        { id: 'offer_context_adaptation', name: 'Offer Context Adaptation' },
        { id: 'prospect_stage_adaptation', name: 'Prospect Stage Adaptation' },
        { id: 'authority_calibration', name: 'Authority Calibration' },
        { id: 'pace_depth_intensity', name: 'Pace, Depth & Intensity' },
    ],
    objection_handling: [
        { id: 'emotional_disarming', name: 'Emotional Disarming' },
        { id: 'real_objection_discovery', name: 'Real Objection Discovery' },
        { id: 'correct_defusal_technique', name: 'Correct Defusal Technique' },
        { id: 'objection_preemption', name: 'Objection Preemption' },
    ],
    closing: [
        { id: 'transition_to_close', name: 'Transition to Close' },
        { id: 'value_confirmation', name: 'Value Confirmation' },
        { id: 'commitment_logistics_alignment', name: 'Commitment & Logistics Alignment' },
        { id: 'financial_qualification', name: 'Financial Qualification' },
        { id: 'decision_outcome', name: 'Decision Outcome' },
    ],
};

/**
 * The 4 objection pillars — used ONLY for classifying objections,
 * NOT as scoring categories. These classify the TYPE of objection,
 * not the rep's skill.
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

/**
 * Roleplay Post-Call Feedback Dimensions — v2.0
 * Used after a roleplay ends (either close or prospect leaving) to provide
 * structured feedback to the student. These are SEPARATE from the 10 scoring
 * categories — they are roleplay-specific coaching dimensions.
 *
 * Source: Connor Williams' post-call feedback framework.
 */
export const ROLEPLAY_FEEDBACK_DIMENSIONS = [
    'pre_set',
    'authority',
    'objection_handling',
    'close_attempt',
    'overall',
] as const;

export type RoleplayFeedbackDimensionId = (typeof ROLEPLAY_FEEDBACK_DIMENSIONS)[number];

export const ROLEPLAY_FEEDBACK_LABELS: Record<RoleplayFeedbackDimensionId, string> = {
    pre_set: 'Pre-Set Score',
    authority: 'Authority Score',
    objection_handling: 'Objection Handling Score',
    close_attempt: 'Close Attempt Score',
    overall: 'Overall Score',
};

export const ROLEPLAY_FEEDBACK_DESCRIPTIONS: Record<RoleplayFeedbackDimensionId, string> = {
    pre_set:
        'Did the salesperson effectively plant ammunition during discovery? (e.g., got prospect to admit analysis paralysis, commitment level, time spent looking)',
    authority:
        'Was the salesperson\'s tone consistent and authoritative throughout — not pushy, not weak? Did they maintain frame control?',
    objection_handling:
        'How well were objections addressed? Did they stay calm, use the prospect\'s own words, and offer logical workarounds?',
    close_attempt:
        'Was the close natural and well-timed? Did they use an assumptive close, handle silence, and lead the decision?',
    overall:
        'Overall performance considering all dimensions. Was the salesperson\'s approach effective for this prospect\'s difficulty level?',
};

/**
 * Prompt instructions for the AI to generate post-call roleplay feedback.
 * Injected into the scoring/feedback prompt after a roleplay ends.
 */
export const ROLEPLAY_FEEDBACK_PROMPT = `
POST-CALL FEEDBACK MODE — After the roleplay ends, provide a structured breakdown:

1. Authority Level Used: Which archetype you played (Advisee/Peer/Advisor) and why
2. What Worked: Specific moments where the salesperson did well
3. What Didn't Work: Missed opportunities, weak objection handling, tone issues

Score each dimension 1-10:
- Pre-Set Score: Did the salesperson effectively plant ammunition during discovery?
- Authority Score: Was the salesperson's tone consistent and authoritative (not pushy)?
- Objection Handling Score: How well were objections addressed?
- Close Attempt Score: Was the close natural and well-timed?
- Overall Score: Overall performance

4. Key Improvement Area: The ONE thing that would have the biggest impact
5. Specific Transcript Moment: Reference a specific exchange and suggest what they should have said instead
`;

