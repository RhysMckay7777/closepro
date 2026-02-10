// Roleplay Types - Section 6 Frontend

export type DifficultyLevel = 'easy' | 'realistic' | 'hard' | 'expert';

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
        case 'expert':
        case 'elite': return 'bg-red-500/20 text-red-700 border-red-500/50';
        // near_impossible removed — falls through to default for legacy data
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

// 10-Category Sales Framework — re-exported from canonical source
import { SALES_CATEGORIES as _CATS, getCategoryLabel } from '@/lib/ai/scoring-framework';

export const SALES_CATEGORIES = _CATS.map(c => c.id);

export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
    _CATS.map(c => [c.id, c.label])
);
