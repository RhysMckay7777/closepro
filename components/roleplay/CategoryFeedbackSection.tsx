'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { ChevronDown } from 'lucide-react';
import { CATEGORY_LABELS, type CategoryFeedback, type CategoryFeedbackItem } from '@/types/roleplay';

interface CategoryFeedbackSectionProps {
    categoryFeedback: CategoryFeedback;
    /** Optional flat category scores (Record<categoryId, number 0-10>) from skillScores */
    categoryScores?: Record<string, number>;
}

/**
 * CategoryFeedbackSection - Accordion per-category feedback with scores
 * Shows 10 category rows, each expandable with 4 sub-sections.
 */
export function CategoryFeedbackSection({ categoryFeedback, categoryScores }: CategoryFeedbackSectionProps) {
    const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
    const categories = Object.entries(categoryFeedback);

    if (categories.length === 0) {
        return null;
    }

    const getScoreColor = (score: number) => {
        if (score >= 8) return 'text-green-500';
        if (score >= 6) return 'text-blue-500';
        if (score >= 4) return 'text-orange-500';
        return 'text-red-500';
    };

    return (
        <Card className="p-4 sm:p-6">
            <h2 className="text-xl font-semibold mb-4">10-Category Skill Breakdown</h2>
            <p className="text-sm text-muted-foreground mb-4">
                Click any category to see detailed feedback
            </p>

            <div className="space-y-2">
                {categories.map(([category, feedback]) => {
                    const isExpanded = expandedCategory === category;

                    // Normalize feedback — handle both old (good/missing/next) and new (detailed) formats
                    const fb: any = typeof feedback === 'string'
                        ? { good: '', missing: feedback, next: '' }
                        : feedback;

                    // Map fields from either format
                    const reason = fb.whyThisScore || '';
                    const strengths = fb.whatWasDoneWell || fb.good || '';
                    const weaknesses = fb.whatWasMissing || fb.missing || '';
                    const impact = fb.howItAffectedOutcome || fb.next || '';

                    // Get score: from the feedback object itself, or from flat categoryScores
                    const score: number | null = typeof fb.score === 'number'
                        ? fb.score
                        : (categoryScores?.[category] ?? null);

                    const categoryLabel = CATEGORY_LABELS[category] ||
                        category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

                    return (
                        <div key={category} className="border rounded-lg">
                            {/* Collapsed row — always visible */}
                            <button
                                onClick={() => setExpandedCategory(isExpanded ? null : category)}
                                className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors rounded-lg"
                            >
                                <span className="font-medium">{categoryLabel}</span>
                                <div className="flex items-center gap-3">
                                    {score !== null && (
                                        <>
                                            <span className={`text-xl font-bold ${getScoreColor(score)}`}>{score}</span>
                                            <span className="text-muted-foreground">/10</span>
                                        </>
                                    )}
                                    <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>
                            </button>

                            {/* Expanded content */}
                            {isExpanded && (
                                <div className="px-4 pb-4 space-y-3 border-t">
                                    {reason && (
                                        <div className="pt-3">
                                            <h4 className="text-sm font-semibold text-muted-foreground">
                                                Why this score was given
                                            </h4>
                                            <p className="text-sm mt-1">{reason}</p>
                                        </div>
                                    )}
                                    {strengths && (
                                        <div>
                                            <h4 className="text-sm font-semibold text-green-500">
                                                What was done well
                                            </h4>
                                            <p className="text-sm mt-1">{strengths}</p>
                                        </div>
                                    )}
                                    {weaknesses && (
                                        <div>
                                            <h4 className="text-sm font-semibold text-red-500">
                                                What was missing or misaligned
                                            </h4>
                                            <p className="text-sm mt-1">{weaknesses}</p>
                                        </div>
                                    )}
                                    {impact && (
                                        <div>
                                            <h4 className="text-sm font-semibold text-amber-500">
                                                How this affected the outcome
                                            </h4>
                                            <p className="text-sm mt-1">{impact}</p>
                                        </div>
                                    )}
                                    {!reason && !strengths && !weaknesses && !impact && (
                                        <p className="text-sm text-muted-foreground pt-3">No detailed feedback available for this category.</p>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}

export default CategoryFeedbackSection;
