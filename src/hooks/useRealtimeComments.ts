import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { API_BASE_URL } from '@/lib/api'
import { upsertInList, patchItem, removeFromList } from '@/lib/realtime-utils'

interface RealtimeComment {
    type: 'new-comment' | 'comment-update' | 'comment-delete' | 'connected' | 'report-update'
    comment?: any
    commentId?: string
    reportId?: string
    senderId?: string
    updates?: any // for partial updates like likes
}

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
    const myId = localStorage.getItem('safespot_anonymous_id');
    const eventSourceRef = useRef<EventSource | null>(null)

    useEffect(() => {
        if (!reportId || !enabled) return

        let isMounted = true

        const connect = () => {
            if (!isMounted) return

            try {
                const eventSource = new EventSource(`${API_BASE_URL}/realtime/comments/${reportId}`)
                eventSourceRef.current = eventSource

                eventSource.onmessage = (event) => {
                    try {
                        const data: RealtimeComment = JSON.parse(event.data)
                        const commentKey = queryKeys.comments.byReport(reportId);
                        const reportKey = queryKeys.reports.detail(reportId);

                        // Adjustment 3: SSE != Mutations Optimistic.
                        const senderId = data.comment?.anonymous_id || data.senderId;
                        if (senderId && senderId === myId) {
                            return;
                        }

                        switch (data.type) {
                            case 'new-comment':
                                if (data.comment) {
                                    // 1. Add comment to list
                                    upsertInList(queryClient, commentKey as any, data.comment);

                                    // 2. Increment counter in report detail
                                    patchItem(queryClient, reportKey as any, reportId, (old: any) => ({
                                        comments_count: (old.comments_count || 0) + 1
                                    }));
                                }
                                break

                            case 'comment-update':
                                if (data.comment || (data.commentId && data.updates)) {
                                    const id = data.commentId || data.comment?.id;
                                    const updates = data.updates || data.comment;
                                    patchItem(queryClient, commentKey as any, id, updates);
                                }
                                break

                            case 'comment-delete':
                                if (data.commentId) {
                                    // 1. Remove from list
                                    removeFromList(queryClient, commentKey as any, data.commentId);

                                    // 2. Decrement counter in report detail
                                    patchItem(queryClient, reportKey as any, reportId, (old: any) => ({
                                        comments_count: Math.max(0, (old.comments_count || 0) - 1)
                                    }));
                                }
                                break

                            case 'report-update':
                                if (data.updates) {
                                    patchItem(queryClient, reportKey as any, reportId, data.updates);
                                }
                                break
                        }
                    } catch (err) {
                        console.error('[SSE] Error parsing event data:', err)
                    }
                }

                eventSource.onerror = () => {
                    if (eventSource.readyState === EventSource.CLOSED) {
                        // console.log('[SSE] Connection closed, will retry...')
                    }
                }
            } catch (err) {
                console.error('[SSE] Failed to create EventSource:', err)
            }
        }

        connect()

        return () => {
            isMounted = false
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
