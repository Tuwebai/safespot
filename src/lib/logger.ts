/**
 * Simple Logger Utility
 * Wraps console.error to avoid linting issues and allow future extensibility (e.g., Sentry)
 */

export const logError = (error: unknown, context?: string) => {
    // Determine the error message locally
    const message = error instanceof Error ? error.message : String(error);

    // In development, log full details
    if (import.meta.env.DEV) {
        console.error(`[Error] ${context || 'Unknown context'}:`, error);
    } else {
        // In production, keep it clean or send to monitoring service
        console.error(`[Error] ${context || ''}: ${message}`);
    }
};

export const logInfo = (message: string, data?: unknown) => {
    if (import.meta.env.DEV) {
        console.log(`[Info] ${message}`, data || '');
    }
};
