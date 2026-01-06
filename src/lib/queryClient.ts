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
            // ENTERPRISE GRADE STRICTNESS:
            // "Source of Truth" is ALWAYS the server.

            // 1. Data Validity
            staleTime: 0, // Data is immediately stale. Always refetch.
            gcTime: 0,    // Do NOT keep unused data in memory cache. If component unmounts, discard.

            // 2. Refetch Triggers (Aggressive)
            refetchOnWindowFocus: true, // Force check when user looks at screen
            refetchOnMount: true,       // Force check when component opens
            refetchOnReconnect: true,   // Force check when network comes back

            // 3. Network Behavior
            retry: 0, // Delegate retry logic to Service Worker or User Action. Don't hide failures.
            networkMode: 'online', // Only fetch if we *think* we are online. 
        },
        mutations: {
            retry: 0, // Fail fast on actions.
            networkMode: 'online',
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
