import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { API_BASE_URL } from '@/lib/api'
import { reportsCache, commentsCache } from '@/lib/cache-helpers'
import { getClientId } from '@/lib/clientId'
import { ssePool } from '@/lib/ssePool'


/**
 * Real-time Comments Hook
 * 
 * Scope Mapping:
 * - 'new-comment': Adds to comment list + patches report detail comments_count.
 * - 'comment-update': Patches specific comment (likes/edits).
 * - 'comment-delete': Removes from list + decrements report detail counter.
 * - 'report-update': Patches report detail fields (status/stats).
 */
export function useRealtimeComments(reportId: string | undefined, enabled = true) {
    const queryClient = useQueryClient()
    const eventSourceRef = useRef<EventSource | null>(null)
    const processedEvents = useRef(new Set<string>())

    useEffect(() => {
        if (!reportId || !enabled) return

        const url = `${API_BASE_URL}/realtime/comments/${reportId}`
        const myClientId = getClientId();

        // Helper to handle idempotency
        const shouldProcess = (eventId?: string) => {
            if (!eventId) return true; // Fallback if backend doesn't provide ID
            if (processedEvents.current.has(eventId)) return false;
            processedEvents.current.add(eventId);
            return true;
        };

        // 1. New Comment
        const unsubNew = ssePool.subscribe(url, 'new-comment', (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data)
                if (data.originClientId === myClientId) return
                if (!shouldProcess(data.eventId)) return
                commentsCache.append(queryClient, data.partial)
            } catch (err) {
                console.error('[SSE] Error processing new-comment:', err)
            }
        })

        // 2. Comment Update (e.g. Likes, Edits)
        const unsubUpdate = ssePool.subscribe(url, 'comment-update', (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data)
                if (data.originClientId === myClientId) return
                if (!shouldProcess(data.eventId)) return

                if (data.isLikeDelta) {
                    commentsCache.applyLikeDelta(queryClient, data.id, data.delta);
                } else {
                    commentsCache.patch(queryClient, data.id, data.partial)
                }
            } catch (err) {
                console.error('[SSE] Error processing comment-update:', err)
            }
        })

        // 3. Comment Delete
        const unsubDelete = ssePool.subscribe(url, 'comment-delete', (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data)
                if (data.originClientId === myClientId) return
                if (!shouldProcess(data.eventId)) return
                commentsCache.remove(queryClient, data.id, reportId)
            } catch (err) {
                console.error('[SSE] Error processing comment-delete:', err)
            }
        })

        // 4. Report Update
        const unsubReport = ssePool.subscribe(url, 'report-update', (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data)
                if (data.originClientId === myClientId) return
                reportsCache.patch(queryClient, data.id, data.partial)
            } catch (err) {
                console.error('[SSE] Error processing report-update:', err)
            }
        })

        return () => {
            unsubNew();
            unsubUpdate();
            unsubDelete();
            unsubReport();
        }
    }, [reportId, enabled, queryClient])

    return {
        isConnected: eventSourceRef.current?.readyState === EventSource.OPEN
    }
}
