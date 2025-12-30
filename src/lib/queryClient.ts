/**
 * TanStack Query Client Configuration
 * 
 * This configures the global QueryClient with sensible defaults:
 * - staleTime: How long data is considered "fresh" (no refetch)
 * - gcTime: How long unused cache entries are kept (garbage collection)
 * - refetchOnWindowFocus: Refetch when user returns to tab
 * - retry: Number of retry attempts for failed requests
 */

import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Tier 1: General data (1 minute stale)
            // Balanced between freshness and server load
            staleTime: 60 * 1000,

            // Tier 2: Cache retention (10 minutes)
            // Essential for high-quality "Back" button experience
            gcTime: 10 * 60 * 1000,

            // Optimization: Only refetch on focus for critical views
            // We'll override this locally for the detailed report view
            refetchOnWindowFocus: false,

            // Resilience: Exponential backoff for network instability
            retry: 2,
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),

            // Performance: Avoid blocking main thread on hydration
            refetchOnMount: true,
            refetchOnReconnect: true,
        },
        mutations: {
            // Fast failure for user actions
            retry: 0,
        },
    },
})

/**
 * Helper to determine a sensible refetch interval based on network quality.
 * On slow mobile networks (2G/3G) or "Save Data" mode, we increase intervals
 * to reduce contention and battery drain.
 */
export function getSmartRefetchInterval(defaultMs = 30000): number | false {
    // If we're on mobile/slow connection, slow down polling
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
        const conn = (navigator as any).connection
        if (conn.saveData || /2g|3g/.test(conn.effectiveType || '')) {
            return defaultMs * 2 // Double the interval (e.g., 1 minute)
        }
    }
    return defaultMs
}

export function invalidateQueriesStartingWith(prefix: string) {
    queryClient.invalidateQueries({
        predicate: (query) => {
            const key = query.queryKey[0]
            return typeof key === 'string' && key.startsWith(prefix)
        },
    })
}
