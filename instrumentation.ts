/**
 * Next.js Instrumentation Hook
 *
 * Runs once when the Node.js runtime starts.
 * Used to suppress noisy Neon DB [NEON_SMGR] / LFC cache warnings
 * that pollute Vercel runtime logs.
 */
export function register() {
    if (typeof console !== 'undefined') {
        const originalWarn = console.warn;

        console.warn = (...args: unknown[]) => {
            // Suppress Neon internal cache messages
            const firstArg = typeof args[0] === 'string' ? args[0] : '';
            if (
                firstArg.includes('[NEON_SMGR]') ||
                firstArg.includes('LFC') ||
                firstArg.includes('Local file cache')
            ) {
                return; // Silently drop
            }
            originalWarn.apply(console, args);
        };
    }
}
