import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { roleplaySessions, roleplayMessages, prospectAvatars, offers } from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';

/**
 * POST - Restart a roleplay session from a specific message index
 * Creates a new session with context carried forward from the original
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const { sessionId } = await params;
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json().catch(() => ({}));
        const restartFromMessageIndex = typeof body.restartFromMessageIndex === 'number'
            ? body.restartFromMessageIndex
            : 0;

        // Get original roleplay session
        const [originalSession] = await db
            .select()
            .from(roleplaySessions)
            .where(
                and(
                    eq(roleplaySessions.id, sessionId),
                    eq(roleplaySessions.userId, session.user.id)
                )
            )
            .limit(1);

        if (!originalSession) {
            return NextResponse.json(
                { error: 'Roleplay session not found' },
                { status: 404 }
            );
        }

        // Get messages up to the restart point
        const originalMessages = await db
            .select()
            .from(roleplayMessages)
            .where(eq(roleplayMessages.sessionId, sessionId))
            .orderBy(asc(roleplayMessages.createdAt));

        if (originalMessages.length === 0) {
            return NextResponse.json(
                { error: 'No messages found in original session' },
                { status: 400 }
            );
        }

        // Get messages to carry forward (up to and including the restart point)
        const messagesToCarry = originalMessages.slice(0, restartFromMessageIndex + 1);

        // Create new roleplay session with same configuration
        const [newSession] = await db
            .insert(roleplaySessions)
            .values({
                organizationId: originalSession.organizationId,
                userId: session.user.id,
                mode: 'manual',
                offerId: originalSession.offerId,
                prospectAvatarId: originalSession.prospectAvatarId,
                selectedDifficulty: originalSession.selectedDifficulty,
                actualDifficultyTier: originalSession.actualDifficultyTier,
                status: 'in_progress',
                inputMode: originalSession.inputMode,
                metadata: JSON.stringify({
                    restartedFrom: sessionId,
                    restartFromMessageIndex,
                    originalMessageCount: originalMessages.length,
                }),
            })
            .returning();

        // Copy messages up to the restart point to the new session
        if (messagesToCarry.length > 0) {
            await db.insert(roleplayMessages).values(
                messagesToCarry.map((msg, idx) => ({
                    sessionId: newSession.id,
                    role: msg.role,
                    content: msg.content,
                    messageType: msg.messageType,
                    audioUrl: msg.audioUrl,
                    timestamp: idx * 3000, // Reset timestamps
                    metadata: msg.metadata,
                }))
            );
        }

        // Get offer and prospect avatar for response context
        let offerData = null;
        let prospectData = null;

        if (originalSession.offerId) {
            const [offer] = await db
                .select()
                .from(offers)
                .where(eq(offers.id, originalSession.offerId))
                .limit(1);
            offerData = offer || null;
        }

        if (originalSession.prospectAvatarId) {
            const [prospect] = await db
                .select()
                .from(prospectAvatars)
                .where(eq(prospectAvatars.id, originalSession.prospectAvatarId))
                .limit(1);
            prospectData = prospect || null;
        }

        return NextResponse.json({
            sessionId: newSession.id,
            session: newSession,
            offer: offerData,
            prospectAvatar: prospectData,
            messagesCarried: messagesToCarry.length,
            message: `Re-practice session created from message ${restartFromMessageIndex + 1}`,
        });
    } catch (error: any) {
        console.error('Error creating restart session:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to create restart session' },
            { status: 500 }
        );
    }
}
