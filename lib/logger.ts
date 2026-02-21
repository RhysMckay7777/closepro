/**
 * Structured Logger for ClosePro
 *
 * Provides consistent [FEATURE:LEVEL] prefixed logging across the application.
 * In production, only WARN and ERROR log by default.
 * Set LOG_LEVEL=info to enable INFO logs in production.
 */

export type LogFeature =
    | 'ROLEPLAY'
    | 'CALL_ANALYSIS'
    | 'PERFORMANCE'
    | 'PROSPECT_BUILDER'
    | 'OFFERS'
    | 'AUTH'
    | 'TTS'
    | 'TEAM'
    | 'WEBHOOKS'
    | 'CLIENT'
    | 'USAGE'
    | 'BILLING';

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const LOG_LEVEL = (process.env.LOG_LEVEL || '').toLowerCase();
const INFO_ENABLED = !IS_PRODUCTION || LOG_LEVEL === 'info' || LOG_LEVEL === 'debug';

function formatPrefix(feature: LogFeature, level: LogLevel): string {
    return `[${feature}:${level}]`;
}

function formatMeta(meta?: Record<string, unknown>): string {
    if (!meta || Object.keys(meta).length === 0) return '';
    try {
        return ' ' + JSON.stringify(meta);
    } catch {
        return '';
    }
}

function formatError(error?: unknown): string {
    if (!error) return '';
    if (error instanceof Error) {
        return ` | ${error.message}${error.stack ? `\n${error.stack}` : ''}`;
    }
    return ` | ${String(error)}`;
}

export const logger = {
    /**
     * Log informational message — suppressed in production unless LOG_LEVEL=info.
     * Use for session lifecycle events and important state changes.
     */
    info(feature: LogFeature, message: string, meta?: Record<string, unknown>): void {
        if (!INFO_ENABLED) return;
        console.log(`${formatPrefix(feature, 'INFO')} ${message}${formatMeta(meta)}`);
    },

    /**
     * Log warning — always visible in production.
     * Use for degraded states, fallbacks, non-fatal issues.
     */
    warn(feature: LogFeature, message: string, meta?: Record<string, unknown>): void {
        console.warn(`${formatPrefix(feature, 'WARN')} ${message}${formatMeta(meta)}`);
    },

    /**
     * Log error — always visible in production. Includes full stack trace.
     * Use for all caught exceptions and failure paths.
     */
    error(feature: LogFeature, message: string, error?: unknown, meta?: Record<string, unknown>): void {
        console.error(`${formatPrefix(feature, 'ERROR')} ${message}${formatError(error)}${formatMeta(meta)}`);
    },

    /**
     * No-op logger for polling routes, health checks, keep-alive endpoints.
     * Produces ZERO console output on success.
     */
    silent(): void {
        // Intentionally empty — suppresses all output
    },
};
