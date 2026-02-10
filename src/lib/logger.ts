/**
 * Enterprise Logger Utility
 * 
 * LOG LEVELS (controlled by VITE_LOG_LEVEL env var):
 * - error: Critical errors only
 * - warn: Warnings and errors  
 * - info: Business events + warn + error
 * - debug: Detailed info + info + warn + error (DEV default)
 * - trace: Everything including SSE, routing decisions (very verbose)
 * 
 * Default: 'info' in production, 'debug' in development
 */

const LOG_LEVEL = import.meta.env.VITE_LOG_LEVEL || (import.meta.env.DEV ? 'debug' : 'info');
const LEVELS: Record<string, number> = { error: 0, warn: 1, info: 2, debug: 3, trace: 4 };
const currentLevel = LEVELS[LOG_LEVEL] ?? LEVELS.info;

const shouldLog = (level: string): boolean => (LEVELS[level] ?? 0) <= currentLevel;

/**
 * Log error - always visible in production
 */
export const logError = (error: unknown, context?: string) => {
    const message = error instanceof Error ? error.message : String(error);
    if (import.meta.env.DEV) {
        console.error(`[Error] ${context || 'Unknown context'}:`, error);
    } else {
        console.error(`[Error] ${context || ''}: ${message}`);
    }
};

/**
 * Log warning - visible in production for anomalies
 */
export const logWarn = (message: string, data?: unknown) => {
    if (shouldLog('warn')) {
        console.warn(`[Warn] ${message}`, data ?? '');
    }
};

/**
 * Log info - business events, disabled in production by default
 */
export const logInfo = (message: string, data?: unknown) => {
    if (shouldLog('info')) {
        console.info(`[Info] ${message}`, data ?? '');
    }
};

/**
 * Log debug - detailed diagnostics, DEV only by default
 */
export const logDebug = (message: string, data?: unknown) => {
    if (shouldLog('debug')) {
        console.debug(`[Debug] ${message}`, data ?? '');
    }
};

/**
 * Log trace - very verbose, routing decisions, SSE events
 * Never visible in production unless explicitly enabled
 */
export const logTrace = (message: string, data?: unknown) => {
    if (shouldLog('trace')) {
        console.debug(`[Trace] ${message}`, data ?? '');
    }
};

/**
 * Legacy compatibility
 * @deprecated Use logDebug instead
 */
export const logInfoLegacy = (message: string, data?: unknown) => {
    logDebug(message, data);
};
