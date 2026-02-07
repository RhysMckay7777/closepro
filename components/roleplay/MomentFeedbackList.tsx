'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { RotateCcw, MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { restartRoleplay } from '@/lib/roleplayApi';
import type { MomentFeedbackItem } from '@/types/roleplay';

interface MomentFeedbackListProps {
    sessionId: string;
    items: MomentFeedbackItem[];
}

/**
 * MomentFeedbackList - Shows moment-by-moment feedback with re-practice buttons
 * Per Section 6.8: Each item shows what rep said, why it worked/didn't, what to say instead
 * Re-practice button creates new session from that moment
 */
export function MomentFeedbackList({ sessionId, items }: MomentFeedbackListProps) {
    const router = useRouter();
    const [repracticeModal, setRepracticeModal] = useState<MomentFeedbackItem | null>(null);
    const [isRestarting, setIsRestarting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleRepractice = async () => {
        if (!repracticeModal) return;

        setIsRestarting(true);
        setError(null);

        try {
            const result = await restartRoleplay(sessionId, repracticeModal.messageIndex);
            const newSessionId = result.newSessionId || result.sessionId;

            // Close modal and navigate to new session
            setRepracticeModal(null);
            router.push(`/dashboard/roleplay/${newSessionId}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to restart roleplay');
        } finally {
            setIsRestarting(false);
        }
    };

    const getTypeColor = (type?: string) => {
        switch (type) {
            case 'strength': return 'border-l-green-500 bg-green-500/5';
            case 'weakness': return 'border-l-red-500 bg-red-500/5';
            case 'opportunity': return 'border-l-blue-500 bg-blue-500/5';
            default: return 'border-l-yellow-500 bg-yellow-500/5';
        }
    };

    const getTypeBadge = (type?: string) => {
        switch (type) {
            case 'strength': return <Badge variant="default" className="bg-green-500">Strength</Badge>;
            case 'weakness': return <Badge variant="destructive">Needs Work</Badge>;
            case 'opportunity': return <Badge variant="secondary">Opportunity</Badge>;
            default: return <Badge variant="outline">Feedback</Badge>;
        }
    };

    if (items.length === 0) {
        return null;
    }

    return (
        <>
            <Card className="p-4 sm:p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    Moment-by-Moment Feedback
                </h2>

                <div className="space-y-4">
                    {items.map((item, index) => (
                        <div
                            key={item.id}
                            className={`border-l-4 p-4 rounded-r-lg ${getTypeColor(item.type)}`}
                        >
                            {/* Header */}
                            <div className="flex flex-wrap items-center gap-2 mb-3">
                                <span className="font-medium text-sm">Moment #{index + 1}</span>
                                {getTypeBadge(item.type)}
                                {item.timestamp && (
                                    <Badge variant="outline" className="text-xs">
                                        {Math.floor(item.timestamp / 1000 / 60)}:
                                        {(Math.floor(item.timestamp / 1000) % 60).toString().padStart(2, '0')}
                                    </Badge>
                                )}
                            </div>

                            {/* What you said */}
                            {item.whatRepSaid && (
                                <div className="mb-3">
                                    <p className="text-xs font-medium text-muted-foreground mb-1">What you said:</p>
                                    <p className="text-sm bg-muted p-2 rounded italic">
                                        &quot;{item.whatRepSaid}&quot;
                                    </p>
                                </div>
                            )}

                            {/* Why it worked / didn't work */}
                            {item.whyItWorkedOrNot && (
                                <div className="mb-3">
                                    <p className="text-xs font-medium text-muted-foreground mb-1">
                                        Why it {item.type === 'strength' ? 'worked' : 'didn\'t work'}:
                                    </p>
                                    <p className="text-sm">{item.whyItWorkedOrNot}</p>
                                </div>
                            )}

                            {/* What to say instead */}
                            {item.whatToSayInstead && item.type !== 'strength' && (
                                <div className="mb-3">
                                    <p className="text-xs font-medium text-muted-foreground mb-1">What to say instead:</p>
                                    <p className="text-sm font-medium text-primary">
                                        &quot;{item.whatToSayInstead}&quot;
                                    </p>
                                </div>
                            )}

                            {/* Re-practice button */}
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-2"
                                onClick={() => setRepracticeModal(item)}
                            >
                                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                                Re-practice from here
                            </Button>
                        </div>
                    ))}
                </div>
            </Card>

            {/* Re-practice confirmation modal */}
            <Dialog open={!!repracticeModal} onOpenChange={() => setRepracticeModal(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Start Re-Practice?</DialogTitle>
                        <DialogDescription>
                            This will create a new roleplay session starting from Moment #
                            {repracticeModal ? items.indexOf(repracticeModal) + 1 : 0}.
                            You can practice handling this moment differently.
                        </DialogDescription>
                    </DialogHeader>

                    {error && (
                        <p className="text-sm text-destructive bg-destructive/10 p-3 rounded">
                            {error}
                        </p>
                    )}

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setRepracticeModal(null)}
                            disabled={isRestarting}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleRepractice}
                            disabled={isRestarting}
                        >
                            {isRestarting ? 'Starting...' : 'Start Re-Practice'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

export default MomentFeedbackList;
