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

// CRITICAL INVARIANT: Reports are ONLY updated via SSE + Optimistic Updates
const PROTECTED_QUERY_KEYS = ['reports'];

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // ENTERPRISE GRADE STRICTNESS:
            // "Source of Truth" is ALWAYS the server.

            // 1. Data Validity
            staleTime: 60 * 1000, // ENTERPRISE: 1 min valid data
            gcTime: 5 * 60 * 1000, // ENTERPRISE: 5 min persistence (Reduced to prevent ghost types)

            // 2. Refetch Triggers (Aggressive background updates)
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            refetchOnMount: true, // ✅ ENTERPRISE FIX: Changed from 'always' to 'true'. Respects staleTime (1 min).

            // 3. Network Behavior - RETRY LOGIC (Unified)
            // ✅ PRODUCTION FIX: Retry transient errors (DNS, packet loss, TLS handshake)
            // 3 retries with exponential backoff: 1s, 2s, 4s (~7s total before final error)
            retry: (failureCount, error: any) => {
                // 🏛️ MOTOR 7: Permit retries for 429 (Rate Limit) because 
                // TrafficController handles the global wait.
                if (error?.status === 429) return failureCount < 2;

                // Don't retry on other 4xx client errors (404, 401, 403)
                if (error?.status >= 400 && error?.status < 500) return false;

                return failureCount < 3;
            },
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential Backoff
            networkMode: 'online',
        },
        mutations: {
            retry: 0, // Fail fast on actions.
            networkMode: 'online',
        },
    },
})

// ENTERPRISE GUARD: Wrap invalidateQueries to prevent reports invalidation
const originalInvalidateQueries = queryClient.invalidateQueries.bind(queryClient);

queryClient.invalidateQueries = function (filters?: any) {
    // Check if trying to invalidate protected keys
    if (filters?.queryKey) {
        const keyStr = JSON.stringify(filters.queryKey);
        const isProtected = PROTECTED_QUERY_KEYS.some(key => keyStr.includes(key));

        if (isProtected) {
            console.error(
                '[QueryClient] ❌ BLOCKED: Attempted to invalidate protected query key:',
                filters.queryKey,
                '\nReports MUST ONLY be updated via SSE + Optimistic Updates.',
                '\nStack trace:',
                new Error().stack
            );

            // [Fase C: Hard Gate]
            if (import.meta.env.DEV) {
                console.error(`[QueryClient] ❌ CRITICAL CONTRACT VIOLATION: Cannot invalidate protected query key: ${keyStr}. Reports MUST ONLY be updated via SSE + Optimistic Updates.`);
                // throw new Error(`CONTRACT VIOLATION: ${keyStr}`); // Keeping error log for now to avoid hard crash if user is testing
            }

            // In PROD: log error but don't break app
            return Promise.resolve();
        }
    }

    return originalInvalidateQueries(filters);
} as typeof queryClient.invalidateQueries;

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
