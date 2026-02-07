// Roleplay Types - Section 6 Frontend

export type DifficultyLevel = 'easy' | 'realistic' | 'hard' | 'elite' | 'near_impossible';

export interface RoleplaySessionListItem {
    id: string;
    date: string;
    offerName: string;
    prospectName: string;
    offerType: string;
    prospectDifficulty: DifficultyLevel;
    overallScore?: number;
}

export type RoleplayStage = 'opening' | 'discovery' | 'offer' | 'objections' | 'close';

export interface StagesCompleted {
    opening?: boolean;
    discovery?: boolean;
    offer?: boolean;
    objections?: boolean;
    close?: boolean;
}

export interface CategoryFeedbackItem {
    good: string;
    missing: string;
    next: string;
}

export type CategoryFeedback = Record<string, CategoryFeedbackItem | string>;

export interface PriorityFix {
    priority: number;
    category: string;
    whatWentWrong: string;
    whyItMattered: string;
    whatToDoDifferently: string;
    messageIndex?: number;
    transcriptSegment?: string;
}

export interface ObjectionAnalysisItem {
    objection: string;
    pillar: 'value' | 'trust' | 'fit' | 'logistics';
    messageIndex?: number;
    howRepHandled: string;
    wasHandledWell: boolean;
    howCouldBeHandledBetter: string;
}

export interface RoleplayAnalysis {
    id: string;
    sessionId: string;
    overallScore?: number;
    isIncomplete?: boolean;
    stagesCompleted?: StagesCompleted | string;
    categoryFeedback?: CategoryFeedback | string;
    priorityFixes?: PriorityFix[] | string;
    objectionAnalysis?: ObjectionAnalysisItem[] | string;
    skillScores?: string;
    coachingRecommendations?: string;
    timestampedFeedback?: string;
    createdAt?: string;
}

export interface MomentFeedbackItem {
    id: string;
    messageIndex: number;
    timestamp?: number;
    whatRepSaid: string;
    whyItWorkedOrNot: string;
    whatToSayInstead: string;
    type?: 'strength' | 'weakness' | 'opportunity';
}

export interface ProspectAvatar {
    id: string;
    name: string;
    avatarUrl?: string;
    positionDescription?: string;
    voiceStyle?: string;
    difficultyTier: DifficultyLevel;
    difficultyIndex?: number;
    authorityLevel?: string;
    executionResistance?: number;
}

// Helper to safely parse JSON from DB text columns
export function safeParseJson<T = unknown>(value: unknown): T | null {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') {
        // Already an object
        return value as T;
    }
    try {
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
}

// Parse stages completed from mixed type
export function parseStagesCompleted(value: StagesCompleted | string | null | undefined): StagesCompleted {
    if (!value) return {};
    const parsed = safeParseJson<StagesCompleted>(value);
    return parsed || {};
}

// Parse category feedback from mixed type
export function parseCategoryFeedback(value: CategoryFeedback | string | null | undefined): CategoryFeedback {
    if (!value) return {};
    const parsed = safeParseJson<CategoryFeedback>(value);
    return parsed || {};
}

// Parse priority fixes from mixed type
export function parsePriorityFixes(value: PriorityFix[] | string | null | undefined): PriorityFix[] {
    if (!value) return [];
    const parsed = safeParseJson<PriorityFix[]>(value);
    return Array.isArray(parsed) ? parsed : [];
}

// Parse objection analysis from mixed type
export function parseObjectionAnalysis(value: ObjectionAnalysisItem[] | string | null | undefined): ObjectionAnalysisItem[] {
    if (!value) return [];
    const parsed = safeParseJson<ObjectionAnalysisItem[]>(value);
    return Array.isArray(parsed) ? parsed : [];
}

// Format difficulty for display
export function formatDifficulty(tier: DifficultyLevel | string | null | undefined): string {
    if (!tier) return '—';
    return tier.charAt(0).toUpperCase() + tier.slice(1).replace('_', ' ');
}

// Get difficulty badge color
export function getDifficultyColor(tier: DifficultyLevel | string | null | undefined): string {
    switch (tier) {
        case 'easy': return 'bg-green-500/20 text-green-700 border-green-500/50';
        case 'realistic': return 'bg-blue-500/20 text-blue-700 border-blue-500/50';
        case 'hard': return 'bg-orange-500/20 text-orange-700 border-orange-500/50';
        case 'elite': return 'bg-red-500/20 text-red-700 border-red-500/50';
        case 'near_impossible': return 'bg-purple-500/20 text-purple-700 border-purple-500/50';
        default: return 'bg-gray-500/20 text-gray-700 border-gray-500/50';
    }
}

// Stage display names
export const STAGE_LABELS: Record<RoleplayStage, string> = {
    opening: 'Opening',
    discovery: 'Discovery',
    offer: 'Offer',
    objections: 'Objections',
    close: 'Close',
};

// 10-Category Sales Framework names (in order)
export const SALES_CATEGORIES = [
    'opening_and_rapport',
    'discovery_and_qualification',
    'need_identification',
    'pitch_and_presentation',
    'objection_handling',
    'value_building',
    'trust_building',
    'urgency_and_scarcity',
    'closing_instinct',
    'overall_call_control',
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
    opening_and_rapport: 'Opening & Rapport',
    discovery_and_qualification: 'Discovery & Qualification',
    need_identification: 'Need Identification',
    pitch_and_presentation: 'Pitch & Presentation',
    objection_handling: 'Objection Handling',
    value_building: 'Value Building',
    trust_building: 'Trust Building',
    urgency_and_scarcity: 'Urgency & Scarcity',
    closing_instinct: 'Closing Instinct',
    overall_call_control: 'Overall Call Control',
};
