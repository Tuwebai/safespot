import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { API_BASE_URL } from '@/lib/api'
import { reportsCache, commentsCache } from '@/lib/cache-helpers'
import { getClientId } from '@/lib/clientId'


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

        const eventSource = new EventSource(`${API_BASE_URL}/realtime/comments/${reportId}`)
        eventSourceRef.current = eventSource

        const myClientId = getClientId();

        // Helper to handle idempotency
        const shouldProcess = (eventId?: string) => {
            if (!eventId) return true; // Fallback if backend doesn't provide ID
            if (processedEvents.current.has(eventId)) return false;
            processedEvents.current.add(eventId);
            return true;
        };

        // 1. New Comment
        eventSource.addEventListener('new-comment', (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data)
                if (data.originClientId === myClientId) return
                if (!shouldProcess(data.eventId)) return

                // Uses cache helper which handles list append + report counter increment (Atomic)
                commentsCache.append(queryClient, data.partial)
            } catch (err) {
                console.error('[SSE] Error processing new-comment:', err)
            }
        })

        // 2. Comment Update (e.g. Likes, Edits)
        eventSource.addEventListener('comment-update', (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data)
                if (data.originClientId === myClientId) return
                if (!shouldProcess(data.eventId)) return

                // If it's a like delta, use atomic helper
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
        eventSource.addEventListener('comment-delete', (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data)
                if (data.originClientId === myClientId) return
                if (!shouldProcess(data.eventId)) return

                // Helper handles list removal + report counter decrement (Atomic)
                commentsCache.remove(queryClient, data.id, reportId)
            } catch (err) {
                console.error('[SSE] Error processing comment-delete:', err)
            }
        })

        // 4. Report Update (e.g. status change while viewing details)
        eventSource.addEventListener('report-update', (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data)
                if (data.originClientId === myClientId) return

                reportsCache.patch(queryClient, data.id, data.partial)
            } catch (err) {
                console.error('[SSE] Error processing report-update:', err)
            }
        })

        eventSource.onerror = () => {
            if (eventSource.readyState === EventSource.CLOSED) {
                // console.log('[SSE] Connection closed')
            }
        }

        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close()
                eventSourceRef.current = null
            }
        }
    }, [reportId, enabled, queryClient])

    return {
        isConnected: eventSourceRef.current?.readyState === EventSource.OPEN
    }
}
