// Roleplay API Client

import type { RoleplayAnalysis, ProspectAvatar, MomentFeedbackItem, safeParseJson } from '@/types/roleplay';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Fetch roleplay sessions list
 */
export async function getRoleplaySessions() {
    const res = await fetch(`${API_BASE}/api/roleplay`);
    if (!res.ok) throw new Error('Failed to fetch roleplay sessions');
    const data = await res.json();
    return data.sessions || [];
}

/**
 * Fetch single roleplay session with analysis
 */
export async function getRoleplaySession(sessionId: string) {
    const res = await fetch(`${API_BASE}/api/roleplay/${sessionId}`);
    if (!res.ok) throw new Error('Failed to fetch roleplay session');
    return res.json();
}

/**
 * Fetch roleplay analysis for a session
 */
export async function getRoleplayAnalysis(sessionId: string): Promise<RoleplayAnalysis | null> {
    const data = await getRoleplaySession(sessionId);
    return data.analysis || null;
}

/**
 * Score a roleplay session
 */
export async function scoreRoleplay(sessionId: string) {
    const res = await fetch(`${API_BASE}/api/roleplay/${sessionId}/score`, {
        method: 'POST',
    });
    return res.json();
}

/**
 * Restart roleplay from a specific message index (re-practice)
 */
export async function restartRoleplay(
    sessionId: string,
    restartFromMessageIndex: number
): Promise<{ sessionId: string; newSessionId?: string; message: string }> {
    const res = await fetch(`${API_BASE}/api/roleplay/${sessionId}/restart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restartFromMessageIndex }),
    });

    if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to restart roleplay' }));
        throw new Error(error.error || 'Failed to restart roleplay');
    }

    return res.json();
}

/**
 * Get moment-by-moment feedback from timestamped feedback
 * Transforms backend format to frontend MomentFeedbackItem[]
 */
export function extractMomentFeedback(timestampedFeedback: unknown): MomentFeedbackItem[] {
    if (!timestampedFeedback) return [];

    let parsed: unknown[];
    if (typeof timestampedFeedback === 'string') {
        try {
            parsed = JSON.parse(timestampedFeedback);
        } catch {
            return [];
        }
    } else if (Array.isArray(timestampedFeedback)) {
        parsed = timestampedFeedback;
    } else {
        return [];
    }

    if (!Array.isArray(parsed)) return [];

    return parsed.map((item: any, index) => ({
        id: `moment-${index}`,
        messageIndex: item.messageIndex ?? item.message_index ?? index,
        timestamp: item.timestamp,
        whatRepSaid: item.whatRepSaid ?? item.what_rep_said ?? item.message ?? item.transcriptSegment ?? '',
        whyItWorkedOrNot: item.whyItWorkedOrNot ?? item.why_it_worked_or_not ?? item.explanation ?? item.message ?? '',
        whatToSayInstead: item.whatToSayInstead ?? item.what_to_say_instead ?? item.action ?? '',
        type: item.type ?? 'opportunity',
    }));
}
