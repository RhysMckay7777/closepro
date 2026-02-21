/**
 * Report a client-side error to the server.
 *
 * Fires-and-forgets a POST to /api/log/client-error so the error
 * appears in Vercel runtime logs with [CLIENT:ERROR] prefix.
 *
 * Never throws — silently swallows fetch failures so it can be
 * used inside catch blocks without risk.
 */
export function reportClientError(
    component: string,
    message: string,
    meta?: Record<string, unknown>
): void {
    try {
        fetch('/api/log/client-error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                component,
                message,
                stack: new Error().stack,
                meta,
            }),
        }).catch(() => { });
    } catch {
        // Never throw from error reporter
    }
}
