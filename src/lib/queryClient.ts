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
            staleTime: 30 * 1000, // 30s - Reduced for memory efficiency
            gcTime: 2 * 60 * 1000, // 2min - Aggressive GC to prevent cache explosion

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

// ============================================
// ENTERPRISE HARD CONTRACTS (Anti-Regression)
// ============================================

/**
 * Applies architectural guardrails to a QueryClient instance.
 * PROTECTS: CONTRACT #OPT-001 (0ms Optimistic Report Creation)
 */
export function setupQueryContracts(client: QueryClient) {
    const originalInvalidateQueries = client.invalidateQueries.bind(client);
    const originalSetQueryData = client.setQueryData.bind(client);

    // 1. Guard against accidental reports invalidation
    client.invalidateQueries = function (filters?: any) {
        if (filters?.queryKey) {
            const keyStr = JSON.stringify(filters.queryKey);
            if (keyStr.includes('"reports"') && keyStr.includes('"list"') && !filters.queryKey.includes('stats')) {
                console.error(
                    '[QueryClient] ❌ CRITICAL CONTRACT VIOLATION #OPT-001: Attempted to invalidate "reports/list".',
                    '\nInvalidation causes UI flickering and overwrites optimistic state.',
                    '\nReports MUST ONLY be updated via SSE + Optimistic Updates.',
                    '\nKey:', keyStr,
                    '\nStack trace:', new Error().stack
                );
                if (import.meta.env.DEV || (typeof process !== 'undefined' && process.env.NODE_ENV === 'test')) {
                    return Promise.resolve(); // Block in dev/test
                }
            }

            // #CMT-001: Block global comments invalidation
            const isCommentsKey = filters.queryKey?.[0] === 'comments';
            if (isCommentsKey && (!filters.queryKey?.[1] || filters.queryKey.length === 1)) {
                console.error(
                    '[QueryClient] ❌ CRITICAL CONTRACT VIOLATION #CMT-001: Attempted GLOBAL invalidation of ["comments"].',
                    '\nThis is forbidden. Use specific reportId/commentId keys or SSE updates.',
                    '\nKey:', keyStr,
                    '\nStack trace:', new Error().stack
                );
                if (import.meta.env.DEV || (typeof process !== 'undefined' && process.env.NODE_ENV === 'test')) {
                    return Promise.resolve();
                }
            }
        }
        return originalInvalidateQueries(filters);
    } as typeof client.invalidateQueries;

    // 2. Guard against corrupted list states
    client.setQueryData = function (queryKey: any, updater: any) {
        const keyStr = JSON.stringify(queryKey);
        const isReportList = keyStr.includes('"reports"') && keyStr.includes('"list"');

        if (isReportList) {
            const result = typeof updater === 'function' ? updater(client.getQueryData(queryKey)) : updater;
            if (result === undefined || result === null) {
                console.error(
                    '[QueryClient] ❌ DATA CORRUPTION RISK #OPT-001: Attempted to set "reports/list" to undefined/null.',
                    '\nReason: This usually happens when an optimistic update fails to return the previous state.',
                    '\nKey:', keyStr,
                    '\nStack trace:', new Error().stack
                );
                if (import.meta.env.DEV || (typeof process !== 'undefined' && process.env.NODE_ENV === 'test')) {
                    return undefined; // Prevent corrupting cache in dev/test
                }
            }
        }
        return originalSetQueryData(queryKey, updater);
    } as typeof client.setQueryData;

    // 3. Guard against CMT-001: Block removeQueries for comments
    const originalRemoveQueries = client.removeQueries.bind(client);
    client.removeQueries = function (filters?: any) {
        if (filters?.queryKey) {
            const keyStr = JSON.stringify(filters.queryKey);
            if (keyStr.includes('"comments"')) {
                const error = new Error(`[QueryClient] ❌ CRITICAL CONTRACT VIOLATION #CMT-001: Attempted to remove "comments" query for ${keyStr}. Inhibit this behavior as it causes observer crashes.`);
                console.error(error.message, '\nStack trace:', error.stack);

                if (import.meta.env.DEV || (typeof process !== 'undefined' && process.env.NODE_ENV === 'test')) {
                    throw error; // Strict failure in dev/test
                }
            }
        }
        return originalRemoveQueries(filters);
    } as typeof client.removeQueries;

    return client;
}

// Global instance with contracts applied
setupQueryContracts(queryClient);

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
