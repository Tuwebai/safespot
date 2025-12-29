import { lazy } from 'react';

/**
 * Enhanced lazy import with retry logic
 * Helps recover from sporadic network failures during navigation
 */
export function lazyRetry(
    componentImport: () => Promise<any>,
    name?: string
) {
    return lazy(async () => {
        const pageHasAlreadyBeenForceRefreshed = JSON.parse(
            window.sessionStorage.getItem('page-has-been-force-refreshed') || 'false'
        );

        try {
            const component = await componentImport();
            return component;
        } catch (error) {
            if (!pageHasAlreadyBeenForceRefreshed) {
                // Log the error for tracking
                console.warn(`[LazyRetry] Failed to load chunk ${name || ''}. Retrying once with reload...`, error);

                // Mark as refreshed to prevent infinite loop
                window.sessionStorage.setItem('page-has-been-force-refreshed', 'true');

                // Force reload from server
                window.location.reload();

                // Return a never-resolving promise to stop execution
                return new Promise(() => { });
            }

            // If we already tried refreshing once, throw the error to be caught by ErrorBoundary
            console.error(`[LazyRetry] Critical: Failed to load chunk ${name || ''} even after reload.`, error);
            throw error;
        }
    });
}
