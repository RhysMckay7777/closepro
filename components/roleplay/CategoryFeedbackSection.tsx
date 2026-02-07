'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Lightbulb } from 'lucide-react';
import { CATEGORY_LABELS, type CategoryFeedback, type CategoryFeedbackItem } from '@/types/roleplay';

interface CategoryFeedbackSectionProps {
    categoryFeedback: CategoryFeedback;
}

/**
 * CategoryFeedbackSection - Shows per-category feedback
 * Per Section 6.6/6.7: Shows what was done well, what was missing, what to improve
 */
export function CategoryFeedbackSection({ categoryFeedback }: CategoryFeedbackSectionProps) {
    const categories = Object.entries(categoryFeedback);

    if (categories.length === 0) {
        return null;
    }

    return (
        <Card className="p-4 sm:p-6">
            <h2 className="text-xl font-semibold mb-4">10-Category Breakdown</h2>
            <p className="text-sm text-muted-foreground mb-4">
                Detailed feedback for each sales category
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {categories.map(([category, feedback]) => {
                    // Handle both object format and string format
                    const feedbackObj: CategoryFeedbackItem =
                        typeof feedback === 'string'
                            ? { good: '', missing: feedback, next: '' }
                            : feedback as CategoryFeedbackItem;

                    const categoryLabel = CATEGORY_LABELS[category] ||
                        category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

                    return (
                        <div key={category} className="border rounded-lg p-4">
                            <h3 className="font-semibold mb-3 capitalize">{categoryLabel}</h3>

                            <div className="space-y-3">
                                {/* What you did well */}
                                {feedbackObj.good && (
                                    <div className="flex gap-2">
                                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-medium text-green-600 mb-0.5">What you did well</p>
                                            <p className="text-sm">{feedbackObj.good}</p>
                                        </div>
                                    </div>
                                )}

                                {/* What was missing */}
                                {feedbackObj.missing && (
                                    <div className="flex gap-2">
                                        <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-medium text-red-600 mb-0.5">What was missing</p>
                                            <p className="text-sm">{feedbackObj.missing}</p>
                                        </div>
                                    </div>
                                )}

                                {/* What to improve next time */}
                                {feedbackObj.next && (
                                    <div className="flex gap-2">
                                        <Lightbulb className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-medium text-blue-600 mb-0.5">What to improve next time</p>
                                            <p className="text-sm font-medium">{feedbackObj.next}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}

export default CategoryFeedbackSection;
