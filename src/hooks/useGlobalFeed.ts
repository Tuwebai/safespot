import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { API_BASE_URL } from '@/lib/api'
import { upsertInList, patchItem, removeFromList } from '@/lib/realtime-utils'

/**
 * Global Real-time Feed Hook
 * 
 * Scope Mapping:
 * - 'new-report': Adds to all active report lists + increments global stats.
 * - 'stats-update': Updates specific report fields (votes, status) across detail and lists.
 */
export function useGlobalFeed() {
    const queryClient = useQueryClient()
    const myId = localStorage.getItem('safespot_anonymous_id');

    useEffect(() => {
        const url = `${API_BASE_URL}/realtime/feed`
        const eventSource = new EventSource(url)

        eventSource.onmessage = (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data)

                // Adjustment 3: SSE != Mutations Optimistic.
                // If we have the sender ID, we skip patching if it's us to avoid double increments
                const senderId = data.report?.anonymous_id || data.senderId;
                if (senderId && senderId === myId) {
                    // console.log('[SSE] Skipping update from self');
                    return;
                }

                // 1. Handle actual report updates / new reports
                if (data.type === 'new-report' && data.report) {
                    // Adjustment 1: Preferred canonical payload (data.report is full object)
                    upsertInList(queryClient, queryKeys.reports.all as any, data.report);

                    // Increment global stats
                    queryClient.setQueryData(queryKeys.stats.global, (old: any) => {
                        if (!old) return old;
                        return { ...old, total_reports: (old.total_reports || 0) + 1 };
                    });
                }
                else if (data.type === 'stats-update' && data.reportId && data.updates) {
                    // Adjustment 2: Explicit Scope (All lists + Detail)
                    patchItem(queryClient, queryKeys.reports.all as any, data.reportId, data.updates);
                    patchItem(queryClient, queryKeys.reports.detail(data.reportId) as any, data.reportId, data.updates);
                }
                else if (data.type === 'delete' && data.reportId) {
                    // Adjustment 4: Handle Deletions (Push + Patch)
                    // 1. Remove from all report lists
                    removeFromList(queryClient, queryKeys.reports.all as any, data.reportId);

                    // 2. Decrement global stats
                    queryClient.setQueryData(queryKeys.stats.global, (old: any) => {
                        if (!old) return old;
                        return { ...old, total_reports: Math.max(0, (old.total_reports || 1) - 1) };
                    });
                }
            } catch (err) {
                console.error('[SSE] Error parsing global feed event:', err)
            }
        }

        eventSource.onerror = () => {
            if (eventSource.readyState === EventSource.CLOSED) {
                // console.log('[SSE] Global Feed disconnected')
            }
        }

        return () => {
            eventSource.close()
        }
    }, [queryClient])
}
