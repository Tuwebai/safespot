import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

interface RealtimeComment {
    type: 'new-comment' | 'comment-update' | 'comment-delete' | 'connected'
    comment?: any
    commentId?: string
    reportId?: string
}

/**
 * Hook to subscribe to real-time comment updates via Server-Sent Events (SSE)
 * 
 * @param reportId - The report ID to listen for comments
 * @param enabled - Whether to enable the SSE connection (default: true)
 */
export function useRealtimeComments(reportId: string | undefined, enabled = true) {
    const queryClient = useQueryClient()
    const eventSourceRef = useRef<EventSource | null>(null)
    const reconnectTimeoutRef = useRef<NodeJS.Timeout>()

    useEffect(() => {
        if (!reportId || !enabled) return

        let isMounted = true

        const connect = () => {
            if (!isMounted) return

            try {
                console.log(`[SSE] Connecting to realtime comments for report ${reportId}`)

                const eventSource = new EventSource(
                    `${API_BASE_URL}/realtime/comments/${reportId}`
                )
                eventSourceRef.current = eventSource

                eventSource.onopen = () => {
                    console.log(`[SSE] Connected to report ${reportId}`)
                }

                eventSource.onmessage = (event) => {
                    try {
                        const data: RealtimeComment = JSON.parse(event.data)
                        console.log('[SSE] Received event:', data.type)

                        switch (data.type) {
                            case 'connected':
                                console.log('[SSE] Connection confirmed')
                                break

                            case 'new-comment':
                                console.log('[SSE] New comment received, invalidating queries')
                                // Invalidate comments to trigger refetch
                                queryClient.invalidateQueries({
                                    queryKey: queryKeys.comments.byReport(reportId)
                                })
                                // Also invalidate report to update comment count
                                queryClient.invalidateQueries({
                                    queryKey: queryKeys.reports.detail(reportId)
                                })
                                break

                            case 'comment-update':
                                console.log('[SSE] Comment updated, invalidating queries')
                                queryClient.invalidateQueries({
                                    queryKey: queryKeys.comments.byReport(reportId)
                                })
                                break

                            case 'comment-delete':
                                console.log('[SSE] Comment deleted, invalidating queries')
                                queryClient.invalidateQueries({
                                    queryKey: queryKeys.comments.byReport(reportId)
                                })
                                queryClient.invalidateQueries({
                                    queryKey: queryKeys.reports.detail(reportId)
                                })
                                break
                        }
                    } catch (err) {
                        console.error('[SSE] Error parsing event data:', err)
                    }
                }

                eventSource.onerror = (error) => {
                    console.error('[SSE] Connection error:', error)
                    eventSource.close()

                    // Attempt to reconnect after 5 seconds
                    if (isMounted) {
                        console.log('[SSE] Reconnecting in 5 seconds...')
                        reconnectTimeoutRef.current = setTimeout(() => {
                            connect()
                        }, 5000)
                    }
                }
            } catch (err) {
                console.error('[SSE] Failed to create EventSource:', err)
            }
        }

        // Initial connection
        connect()

        // Cleanup
        return () => {
            isMounted = false
            console.log(`[SSE] Disconnecting from report ${reportId}`)

            if (eventSourceRef.current) {
                eventSourceRef.current.close()
                eventSourceRef.current = null
            }

            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current)
            }
        }
    }, [reportId, enabled, queryClient])

    return {
        isConnected: eventSourceRef.current?.readyState === EventSource.OPEN
    }
}
