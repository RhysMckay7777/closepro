'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle } from 'lucide-react';
import { STAGE_LABELS, type RoleplayStage, type StagesCompleted } from '@/types/roleplay';

interface StageChipsProps {
    stagesCompleted: StagesCompleted;
}

const STAGES_ORDER: RoleplayStage[] = ['opening', 'discovery', 'offer', 'objections', 'close'];

/**
 * StageChips - Shows visual chips for each conversation stage
 * Per Section 6.5: Mark stages as complete/incomplete based on stagesCompleted
 */
export function StageChips({ stagesCompleted }: StageChipsProps) {
    return (
        <div className="flex flex-wrap gap-2">
            {STAGES_ORDER.map((stage) => {
                const isComplete = stagesCompleted[stage] === true;
                return (
                    <Badge
                        key={stage}
                        variant={isComplete ? 'default' : 'outline'}
                        className={`flex items-center gap-1.5 ${isComplete
                                ? 'bg-green-500/20 text-green-700 border-green-500/50'
                                : 'bg-muted text-muted-foreground'
                            }`}
                    >
                        {isComplete ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                            <Circle className="h-3.5 w-3.5" />
                        )}
                        {STAGE_LABELS[stage]}
                    </Badge>
                );
            })}
        </div>
    );
}

export default StageChips;
