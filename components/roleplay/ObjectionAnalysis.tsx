'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import type { ObjectionAnalysisItem } from '@/types/roleplay';

interface ObjectionAnalysisProps {
    items: ObjectionAnalysisItem[];
}

const PILLAR_COLORS: Record<string, string> = {
    value: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    trust: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    fit: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    logistics: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const PILLAR_LABELS: Record<string, string> = {
    value: 'Value',
    trust: 'Trust',
    fit: 'Fit',
    logistics: 'Logistics',
};

/**
 * ObjectionAnalysis - Shows how objections were handled
 * Per Section 6.9: Dedicated section with classification, how handled, how to do better
 */
export function ObjectionAnalysis({ items }: ObjectionAnalysisProps) {
    if (items.length === 0) {
        return null;
    }

    return (
        <Card className="p-4 sm:p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Objection Analysis
            </h2>

            <p className="text-sm text-muted-foreground mb-4">
                How you handled prospect objections during the roleplay
            </p>

            <div className="space-y-4">
                {items.map((item, index) => (
                    <div
                        key={index}
                        className="border rounded-lg p-4"
                    >
                        {/* Objection header */}
                        <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                            <div className="flex-1">
                                <p className="font-medium mb-1">
                                    &quot;{item.objection}&quot;
                                </p>
                                <div className="flex items-center gap-2">
                                    <Badge
                                        variant="outline"
                                        className={PILLAR_COLORS[item.pillar] || ''}
                                    >
                                        {PILLAR_LABELS[item.pillar] || item.pillar}
                                    </Badge>
                                    {item.wasHandledWell ? (
                                        <Badge variant="default" className="bg-green-500 flex items-center gap-1">
                                            <CheckCircle2 className="h-3 w-3" />
                                            Well Handled
                                        </Badge>
                                    ) : (
                                        <Badge variant="destructive" className="flex items-center gap-1">
                                            <XCircle className="h-3 w-3" />
                                            Needs Improvement
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* How rep handled it */}
                        <div className="mb-3">
                            <p className="text-xs font-semibold text-blue-400 mb-1">How You Handled It</p>
                            <p className="text-sm">{item.howRepHandled}</p>
                        </div>

                        {/* How to handle better (only show if not well handled or has advice) */}
                        {item.howCouldBeHandledBetter && (
                            <div className={`p-3 rounded border ${item.wasHandledWell ? 'bg-blue-500/10 border-blue-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                                <p className={`text-xs font-semibold mb-1 ${item.wasHandledWell ? 'text-blue-400' : 'text-emerald-400'}`}>
                                    {item.wasHandledWell ? 'Pro Tip' : 'Higher-Leverage Alternative'}
                                </p>
                                <p className="text-sm">
                                    {item.howCouldBeHandledBetter}
                                </p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </Card>
    );
}

export default ObjectionAnalysis;
