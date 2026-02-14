/**
 * Training Transcript Patterns — fetches extracted patterns from user-uploaded
 * transcripts and formats them for injection into the roleplay system prompt.
 */

import { db } from '@/db';
import { trainingTranscripts } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

interface ExtractedPatterns {
    closingTechniques?: string[];
    objectionHandles?: string[];
    discoveryQuestions?: string[];
    valueStatements?: string[];
    commonObjections?: string[];
}

/**
 * Retrieve all processed transcript patterns for a user.
 * Returns a formatted string for injection into the roleplay system prompt.
 */
export async function getTranscriptPatternsForUser(userId: string): Promise<string | null> {
    try {
        const transcripts = await db
            .select({
                extractedPatterns: trainingTranscripts.extractedPatterns,
                title: trainingTranscripts.title,
            })
            .from(trainingTranscripts)
            .where(
                and(
                    eq(trainingTranscripts.userId, userId),
                    eq(trainingTranscripts.status, 'processed')
                )
            );

        if (transcripts.length === 0) return null;

        // Aggregate patterns across all transcripts
        const allClosing: string[] = [];
        const allObjections: string[] = [];
        const allDiscovery: string[] = [];
        const allValue: string[] = [];
        const allCommonObjections: string[] = [];

        for (const t of transcripts) {
            if (!t.extractedPatterns) continue;
            try {
                const patterns: ExtractedPatterns = JSON.parse(t.extractedPatterns);
                if (patterns.closingTechniques) allClosing.push(...patterns.closingTechniques);
                if (patterns.objectionHandles) allObjections.push(...patterns.objectionHandles);
                if (patterns.discoveryQuestions) allDiscovery.push(...patterns.discoveryQuestions);
                if (patterns.valueStatements) allValue.push(...patterns.valueStatements);
                if (patterns.commonObjections) allCommonObjections.push(...patterns.commonObjections);
            } catch {
                // Skip malformed JSON
            }
        }

        // No patterns extracted
        if (allClosing.length + allObjections.length + allDiscovery.length + allValue.length + allCommonObjections.length === 0) {
            return null;
        }

        // Build formatted prompt section (limit to avoid prompt bloat)
        const lines: string[] = [
            '═══ REAL CALL PATTERNS (from uploaded training transcripts) ═══',
            'The following patterns were extracted from real sales calls uploaded by the user.',
            'Use these to make your prospect responses MORE realistic and challenging.',
            '',
        ];

        if (allCommonObjections.length > 0) {
            lines.push('COMMON OBJECTIONS PROSPECTS RAISE:');
            allCommonObjections.slice(0, 8).forEach((o) => lines.push(`- ${o}`));
            lines.push('');
        }

        if (allObjections.length > 0) {
            lines.push('HOW REPS TYPICALLY HANDLE OBJECTIONS:');
            allObjections.slice(0, 6).forEach((o) => lines.push(`- ${o}`));
            lines.push('');
        }

        if (allDiscovery.length > 0) {
            lines.push('EFFECTIVE DISCOVERY QUESTIONS REPS USE:');
            allDiscovery.slice(0, 6).forEach((q) => lines.push(`- ${q}`));
            lines.push('');
        }

        if (allClosing.length > 0) {
            lines.push('CLOSING TECHNIQUES REPS USE:');
            allClosing.slice(0, 5).forEach((c) => lines.push(`- ${c}`));
            lines.push('');
        }

        if (allValue.length > 0) {
            lines.push('VALUE PROPOSITIONS REPS USE:');
            allValue.slice(0, 5).forEach((v) => lines.push(`- ${v}`));
            lines.push('');
        }

        lines.push('Use these patterns to calibrate your prospect responses — be aware of these techniques so you can react realistically to them.');

        return lines.join('\n');
    } catch (err) {
        console.error('[transcript-patterns] Error fetching patterns:', err);
        return null;
    }
}
