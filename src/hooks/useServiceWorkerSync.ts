import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * useServiceWorkerSync
 * 
 * Enterprise-grade hook for synchronizing Service Worker cache updates with React Query.
 * 
 * CRITICAL: This is the bridge between SW cache events and UI query invalidation.
 * 
 * @invariant Must be called at App-level (inside QueryClientProvider)
 * @invariant Requires BroadcastChannel API (polyfill for older browsers)
 * 
 * Timeline:
 * 1. SW updates cache → broadcasts CACHE_UPDATED message
 * 2. This hook receives message → determines affected queryKey
 * 3. Invalidates queryKey → React Query refetches automatically
 * 
 * Edge Cases Handled:
 * - BroadcastChannel not supported → graceful degradation (log warning)
 * - URL mapping failures → log error, no crash
 * - SW update events → cancel + refetch all queries
 */
export function useServiceWorkerSync() {
    const queryClient = useQueryClient();

    useEffect(() => {
        // Feature detection
        if (!('BroadcastChannel' in window)) {
            console.warn('[SW Sync] BroadcastChannel not supported, SW↔UI sync disabled');
            return;
        }

        const channel = new BroadcastChannel('safespot-sw-updates');

        const handleMessage = (event: MessageEvent) => {
            const { type, url, version } = event.data;

            console.log('[SW Sync] Message received:', { type, url, version });

            switch (type) {
                case 'CACHE_UPDATED': {
                    // Cache updated → Invalidate relevant queries
                    const queryKeys = urlToQueryKeys(url);
                    queryKeys.forEach((queryKey) => {
                        console.log('[SW Sync] Invalidating query:', queryKey);
                        queryClient.invalidateQueries({ queryKey });
                    });
                    break;
                }

                case 'REFETCH_SUCCESS': {
                    // Background refetch completed → Force refetch active queries
                    const queryKeys = urlToQueryKeys(url);
                    queryKeys.forEach((queryKey) => {
                        console.log('[SW Sync] Refetching active query:', queryKey);
                        queryClient.refetchQueries({ queryKey, type: 'active' });
                    });
                    break;
                }

                case 'SW_UPDATE_PENDING': {
                    // SW update starting → Cancel all in-flight queries to avoid zombie state
                    console.warn('[SW Sync] SW update pending (v' + version + '), cancelling queries');
                    queryClient.cancelQueries();
                    break;
                }

                case 'SW_UPDATED': {
                    // SW updated successfully → Invalidate all queries to refetch with new SW
                    console.log('[SW Sync] SW updated to v' + version + ', invalidating all queries');
                    queryClient.invalidateQueries();
                    break;
                }

                default:
                    console.warn('[SW Sync] Unknown message type:', type);
            }
        };

        channel.addEventListener('message', handleMessage);

        console.log('[SW Sync] ✅ Listening for SW cache updates');

        // Cleanup
        return () => {
            channel.removeEventListener('message', handleMessage);
            channel.close();
            console.log('[SW Sync] Disconnected');
        };
    }, [queryClient]);
}

/**
 * urlToQueryKeys
 * 
 * Maps API URLs to React Query keys for intelligent invalidation.
 * 
 * ENTERPRISE PATTERN: Central mapping to avoid scattered invalidation logic
 * 
 * @param url - Full URL or pathname from fetch event
 * @returns Array of queryKeys that should be invalidated
 */
function urlToQueryKeys(url: string): unknown[][] {
    try {
        // Normalize to pathname
        const pathname = url.includes('://') ? new URL(url).pathname : url;

        const queryKeys: unknown[][] = [];

        // Reports
        if (pathname.includes('/api/reports')) {
            queryKeys.push(['reports']);  // Invalidate all report queries

            // Specific report detail
            const reportIdMatch = pathname.match(/\/api\/reports\/([a-f0-9-]+)$/);
            if (reportIdMatch) {
                queryKeys.push(['reports', 'detail']);
            }
        }

        // Users / Profile
        if (pathname.includes('/api/users/profile')) {
            queryKeys.push(['user', 'profile']);
        }

        if (pathname.includes('/api/users/stats')) {
            queryKeys.push(['stats', 'global']);
        }

        if (pathname.includes('/api/users/category-stats')) {
            queryKeys.push(['stats', 'categories']);
        }

        // Notifications
        if (pathname.includes('/api/notifications')) {
            queryKeys.push(['notifications']);
        }

        // Chats
        if (pathname.includes('/api/chats')) {
            queryKeys.push(['chats']);

            // Specific chat room
            const chatIdMatch = pathname.match(/\/api\/chats\/([a-f0-9-]+)/);
            if (chatIdMatch) {
                queryKeys.push(['chats', 'messages']);
            }
        }

        // Comments
        if (pathname.includes('/api/comments')) {
            queryKeys.push(['comments']);
        }

        // Gamification
        if (pathname.includes('/api/gamification')) {
            queryKeys.push(['gamification']);
        }

        // If no match, invalidate everything (safe fallback)
        if (queryKeys.length === 0) {
            console.warn('[SW Sync] No queryKey mapping for:', pathname, '→ invalidating all');
            return [[]];  // Empty array = invalidate all
        }

        return queryKeys;
    } catch (error) {
        console.error('[SW Sync] URL mapping error:', error);
        return [[]];  // Fallback: invalidate all
    }
}
