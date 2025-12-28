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
            // Data is considered fresh for 30 seconds
            // During this time, returning to a page won't trigger a refetch
            staleTime: 30 * 1000,

            // Cache entries are kept for 5 minutes after becoming inactive
            // This allows instant back/forward navigation
            gcTime: 5 * 60 * 1000,

            // Refetch when user returns to the browser tab
            // Ensures data stays fresh without manual refresh
            refetchOnWindowFocus: true,

            // Retry failed requests twice with exponential backoff
            retry: 2,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),

            // Refetch on mount if data is stale
            refetchOnMount: true,

            // Don't refetch on reconnect - let user trigger manually
            refetchOnReconnect: false,
        },
        mutations: {
            // Retry mutations once
            retry: 1,
        },
    },
})

/**
 * Helper to invalidate all queries matching a prefix
 * Useful after mutations that affect multiple queries
 */
export function invalidateQueriesStartingWith(prefix: string) {
    queryClient.invalidateQueries({
        predicate: (query) => {
            const key = query.queryKey[0]
            return typeof key === 'string' && key.startsWith(prefix)
        },
    })
}
