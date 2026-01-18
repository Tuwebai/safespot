import { lazy, ComponentType } from 'react';

/**
 * Enterprise Lazy Import with Smart Retry Strategy
 * 
 * Objectives:
 * 1. Eliminate transient 500/Network errors via exponential backoff.
 * 2. Handle "ChunkLoadError" (Version Mismatch) by refreshing the page automatically (once).
 * 3. Provide clear logging for debugging without spamming Sentry.
 */

// Helper: Wait promise
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Check if error is likely a version mismatch (404 on chunk)
const isChunkLoadError = (error: any): boolean => {
    const message = error?.message || '';
    return (
        error?.name === 'ChunkLoadError' ||
        message.includes('Loading chunk') ||
        message.includes('undefined') ||
        message.includes('missing') ||
        message.includes('Failed to fetch')
    );
};

export function lazyRetry<T extends ComponentType<any>>(
    factory: () => Promise<{ default: T }>,
    name: string = 'Component',
    retries = 3,
    baseDelay = 500
) {
    return lazy(async () => {
        let lastError: any;

        for (let i = 0; i < retries; i++) {
            try {
                // Attempt load
                return await factory();
            } catch (error: any) {
                lastError = error;

                // CRITICAL: If it's a version mismatch (prod deployment), 
                // force reload immediately on first failure to sync with new assets.
                // We use sessionStorage to prevent infinite loops.
                if (isChunkLoadError(error)) {
                    const storageKey = `retry_reload_${name}`;
                    const hasReloaded = sessionStorage.getItem(storageKey);

                    if (!hasReloaded) {
                        console.warn(`[LazyRetry] Version mismatch detected for ${name}. Reloading...`);
                        sessionStorage.setItem(storageKey, 'true');
                        window.location.reload();
                        return new Promise(() => { }); // Never resolve, wait for reload
                    } else {
                        // Cleanup for next successful session
                        sessionStorage.removeItem(storageKey);
                    }
                }

                // If it's not a hard chunk error (e.g. 500 or timeout), wait and retry
                const delay = baseDelay * Math.pow(2, i); // 500, 1000, 2000
                console.warn(`[LazyRetry] Connection failed for ${name}. Retrying in ${delay}ms... (${retries - 1 - i} attempts left)`);
                await wait(delay);
            }
        }

        // Final failure handling
        console.error(`[LazyRetry] FATAL: Failed to load ${name} after ${retries} attempts.`, lastError);

        // Propagate to ErrorBoundary
        throw lastError;
    });
}

