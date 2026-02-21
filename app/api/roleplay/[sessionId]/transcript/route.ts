import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db';
import { roleplaySessions, roleplayMessages } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const maxDuration = 30;

interface TranscriptEntry {
  role: 'rep' | 'prospect';
  content: string;
  timestamp: number;
}

/**
 * POST - Batch persist voice transcript entries to roleplayMessages
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { messages, lastPersistedIndex } = body as {
      messages: TranscriptEntry[];
      lastPersistedIndex: number;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ persisted: 0 });
    }

    // Verify session ownership
    const roleplay = await db
      .select({ id: roleplaySessions.id, startedAt: roleplaySessions.startedAt })
      .from(roleplaySessions)
      .where(
        and(
          eq(roleplaySessions.id, sessionId),
          eq(roleplaySessions.userId, session.user.id)
        )
      )
      .limit(1);

    if (!roleplay[0]) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Filter to only new messages (after lastPersistedIndex)
    const newMessages = messages.slice(lastPersistedIndex >= 0 ? lastPersistedIndex : 0);

    if (newMessages.length === 0) {
      return NextResponse.json({ persisted: 0 });
    }

    // Bulk insert
    const values = newMessages.map((msg) => ({
      sessionId,
      role: msg.role,
      content: msg.content,
      messageType: 'voice' as const,
      timestamp: msg.timestamp,
    }));

    await db.insert(roleplayMessages).values(values);

    return NextResponse.json({ persisted: newMessages.length });
  } catch (error: any) {
    logger.error('ROLEPLAY', 'Failed to persist transcript', error);
    return NextResponse.json(
      { error: error.message || 'Failed to persist transcript' },
      { status: 500 }
    );
  }
}
