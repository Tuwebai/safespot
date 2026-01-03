import { lazy } from 'react';

/**
 * Enhanced lazy import with retry logic
 * Helps recover from sporadic network failures during navigation
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyRetry<T extends React.ComponentType<any>>(
    componentImport: () => Promise<{ default: T }>,
    name?: string
) {
    return lazy(async () => {

        try {
            const component = await componentImport();
            return component;
        } catch (error) {
            // Disable auto-reload to prevent infinite loops (ERR_TOO_MANY_REDIRECTS)
            // The ChunkErrorBoundary will handle the UI and offer a manual reload button.
            console.warn(`[LazyRetry] Failed to load chunk ${name || ''}. Throwing error to Boundary.`, error);
            throw error;
        }
    });
}
