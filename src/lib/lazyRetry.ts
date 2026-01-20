/**
 * Enterprise Lazy Import with Deterministic ChunkLoadError Recovery
 * 
 * Objectives:
 * 1. If chunk fails to load (version mismatch), force hard reload immediately
 * 2. NO sessionStorage (prevents loops if reload fails)
 * 3. NO retries for ChunkLoadError (if chunk doesn't exist, retrying is pointless)
 * 4. Use location.replace() for better history handling
 */

import { lazy, ComponentType } from 'react';
import * as Sentry from '@sentry/react';
import { AppVersion } from './version';

// Helper: Check if error is likely a version mismatch (404 on chunk)
const isChunkLoadError = (error: any): boolean => {
    const message = error?.message || '';
    return (
        error?.name === 'ChunkLoadError' ||
        message.includes('Loading chunk') ||
        message.includes('Failed to fetch dynamically imported module')
    );
};

export function lazyRetry<T extends ComponentType<any>>(
    factory: () => Promise<{ default: T }>,
    name: string = 'Component'
) {
    return lazy(async () => {
        try {
            return await factory();
        } catch (error: any) {
            // CRITICAL: ChunkLoadError means HTML is out of sync with server chunks
            // Only solution: hard reload to get fresh HTML
            if (isChunkLoadError(error)) {
                console.error(
                    `[LazyRetry] ChunkLoadError for ${name}. HTML/chunks mismatch detected. Forcing hard reload...`,
                    error
                );

                // ? OBSERVABILITY: Track chunk load error recovery


                if (AppVersion.environment === 'production') {


                    Sentry.captureException(error, {


                        level: 'warning',


                        tags: {


                            recovery: 'auto_reload',


                            chunkName: name


                        },


                        extra: {


                            deployId: AppVersion.deployId,


                            userAgent: navigator.userAgent


                        }


                    });


                }


                


                // Give 100ms for error to be logged/sent to Sentry
                setTimeout(() => {
                    // ENTERPRISE: Use location.replace() to prevent back button issues
                    window.location.replace(window.location.href);
                }, 100);

                // Suspend indefinitely (reload will interrupt)
                return new Promise<{ default: T }>(() => { });
            }

            // Other errors: propagate to ErrorBoundary
            console.error(`[LazyRetry] Failed to load ${name}:`, error);
            throw error;
        }
    });
}
