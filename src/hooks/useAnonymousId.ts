import { useState, useEffect } from 'react';
import { getAnonymousId } from '@/lib/identity';

/**
 * useAnonymousId
 * 
 * Enterprise-grade hook for consuming anonymous identity in React components.
 * 
 * CRITICAL: This is the SINGLE SOURCE OF TRUTH for identity state in React Query.
 * 
 * @returns {string | null}
 *   - null: Identity is loading OR failed to initialize (query should be disabled)
 *   - string: Valid UUID (query can execute safely)
 * 
 * @invariant NEVER returns empty string ''
 * @invariant Polls until identity resolves OR timeout (2.5s)
 * @invariant Cleanup stops polling on unmount (no memory leaks)
 * 
 * Usage in queries:
 * ```typescript
 * const anonymousId = useAnonymousId()
 * 
 * return useQuery({
 *   queryKey: ['reports', anonymousId],
 *   queryFn: fetchReports,
 *   enabled: !!anonymousId  // CRITICAL: Never execute with null
 * })
 * ```
 * 
 * Timeline:
 * - T+0ms: Component mounts → useAnonymousId returns null
 * - T+50ms: First poll → still null (async init pending)
 * - T+200ms: Identity resolves → getAnonymousId() returns UUID
 * - T+200ms: Hook updates state → consumers re-render
 * - T+200ms: React Query detects queryKey change → executes query
 * 
 * Edge Cases Handled:
 * 1. Identity init timeout (>2.5s) → returns null forever → queries disabled
 * 2. StrictMode double mount → second mount creates new poll
 * 3. Unmount before resolve → cleanup stops poll
 * 4. Identity already cached → resolves on first poll (T+0ms)
 */
export function useAnonymousId(): string | null {
    const [id, setId] = useState<string | null>(() => {
        // FAST PATH: Try sync read on mount
        // If identity already initialized, return immediately
        const cached = getAnonymousId();
        return cached || null;
    });

    useEffect(() => {
        let mounted = true;
        let pollCount = 0;
        const MAX_POLLS = 50; // 50 polls * 50ms = 2.5s max wait

        // If we already have ID from initial state, don't poll
        if (id) {
            return;
        }

        // Poll every 50ms until identity resolves or timeout
        const interval = setInterval(() => {
            pollCount++;

            // Timeout: Stop polling after 2.5s (fail-safe)
            if (pollCount >= MAX_POLLS) {
                clearInterval(interval);
                console.warn('[useAnonymousId] Timeout after 2.5s - identity failed to initialize');
                // Leave state as null → queries stay disabled
                return;
            }

            // Try to get ID
            const current = getAnonymousId();

            if (current && mounted) {
                // SUCCESS: Identity resolved
                setId(current);
                clearInterval(interval);
                console.log('[useAnonymousId] ✅ Identity resolved:', current.substring(0, 8));
            }
        }, 50);

        // Cleanup: Stop polling on unmount
        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [id]); // Re-run if id changes (shouldn't happen, but defensive)

    return id;
}

/**
 * useAnonymousIdOrThrow
 * 
 * Variant that throws if identity is not ready.
 * Use ONLY in components that absolutely require identity (e.g., profile page).
 * 
 * Most components should use useAnonymousId() + enabled flag instead.
 */
export function useAnonymousIdOrThrow(): string {
    const id = useAnonymousId();

    if (!id) {
        throw new Error(
            'Anonymous ID not initialized. Wrap component in Suspense or use useAnonymousId() with conditional rendering.'
        );
    }

    return id;
}
