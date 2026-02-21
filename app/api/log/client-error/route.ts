import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * POST /api/log/client-error
 *
 * Accepts client-side error reports and logs them server-side so they
 * appear in Vercel runtime logs with [CLIENT:ERROR] prefix.
 *
 * Body: { component: string, message: string, stack?: string, meta?: Record<string, unknown> }
 *
 * No auth required — errors must always be capturable regardless of session state.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const { component, message, stack, meta } = body as {
            component?: string;
            message?: string;
            stack?: string;
            meta?: Record<string, unknown>;
        };

        if (!component || !message) {
            return NextResponse.json(
                { error: 'component and message are required' },
                { status: 400 }
            );
        }

        // Log with structured format — appears in Vercel runtime logs
        logger.error(
            'CLIENT',
            `${component}: ${message}`,
            stack ? new Error(stack) : undefined,
            meta
        );

        return NextResponse.json({ logged: true });
    } catch {
        // Even this endpoint's own errors should not throw unhandled
        return NextResponse.json({ logged: false }, { status: 500 });
    }
}
