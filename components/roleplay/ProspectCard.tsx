'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { User } from 'lucide-react';
import { formatDifficulty, getDifficultyColor, type ProspectAvatar } from '@/types/roleplay';

interface ProspectCardProps {
    prospect: ProspectAvatar;
    compact?: boolean;
}

// Fallback avatar — local professional headshot
const FALLBACK_AVATAR = '/avatars/male-1.png';

/**
 * ProspectCard - Displays realistic prospect presentation for pre-call
 * Per Section 6.2: Shows realistic photo, full name, one-line bio, difficulty label
 */
export function ProspectCard({ prospect, compact = false }: ProspectCardProps) {
    const avatarUrl = prospect.avatarUrl || FALLBACK_AVATAR;

    // Get archetype label from position description
    const getArchetypeLabel = () => {
        const position = prospect.positionDescription?.toLowerCase() || '';
        if (position.includes('founder')) return 'Founder';
        if (position.includes('ceo') || position.includes('executive')) return 'Executive';
        if (position.includes('dad') || position.includes('father')) return 'Busy Dad';
        if (position.includes('mom') || position.includes('mother')) return 'Busy Mom';
        if (position.includes('coach')) return 'Coach';
        if (position.includes('consultant')) return 'Consultant';
        if (position.includes('agency')) return 'Agency Owner';
        if (position.includes('advisor')) return 'Advisor';
        return null;
    };

    const archetypeLabel = getArchetypeLabel();

    if (compact) {
        return (
            <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-full overflow-hidden bg-muted flex-shrink-0">
                    <img
                        src={avatarUrl}
                        alt={prospect.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = FALLBACK_AVATAR;
                        }}
                    />
                </div>
                <div className="min-w-0">
                    <p className="font-medium truncate">{prospect.name}</p>
                    <div className="flex items-center gap-2">
                        <Badge
                            variant="outline"
                            className={`text-xs ${getDifficultyColor(prospect.difficultyTier)}`}
                        >
                            {formatDifficulty(prospect.difficultyTier)}
                        </Badge>
                        {archetypeLabel && (
                            <span className="text-xs text-muted-foreground">{archetypeLabel}</span>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <Card className="p-6">
            <div className="flex flex-col sm:flex-row gap-6">
                {/* Avatar */}
                <div className="flex-shrink-0">
                    <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-xl overflow-hidden bg-muted mx-auto sm:mx-0">
                        <img
                            src={avatarUrl}
                            alt={prospect.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = FALLBACK_AVATAR;
                            }}
                        />
                    </div>
                </div>

                {/* Info */}
                <div className="flex-1 text-center sm:text-left">
                    <h3 className="text-xl font-semibold mb-2">{prospect.name}</h3>

                    {/* Bio / Position */}
                    {prospect.positionDescription && (
                        <p className="text-muted-foreground mb-3 line-clamp-2">
                            {prospect.positionDescription}
                        </p>
                    )}

                    {/* Badges */}
                    <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                        <Badge
                            variant="outline"
                            className={`${getDifficultyColor(prospect.difficultyTier)}`}
                        >
                            {formatDifficulty(prospect.difficultyTier)}
                        </Badge>

                        {archetypeLabel && (
                            <Badge variant="secondary">
                                {archetypeLabel}
                            </Badge>
                        )}

                        {prospect.authorityLevel && (
                            <Badge variant="outline">
                                {prospect.authorityLevel.charAt(0).toUpperCase() + prospect.authorityLevel.slice(1)}
                            </Badge>
                        )}

                        {prospect.difficultyIndex !== undefined && (
                            <Badge variant="outline">
                                Difficulty: {prospect.difficultyIndex}/50
                            </Badge>
                        )}
                    </div>

                    {/* Voice style hint - Section 6.3/6.4 */}
                    {prospect.voiceStyle && (
                        <p className="text-xs text-muted-foreground mt-3 italic">
                            Voice: {prospect.voiceStyle}
                        </p>
                    )}
                </div>
            </div>
        </Card>
    );
}

export default ProspectCard;
