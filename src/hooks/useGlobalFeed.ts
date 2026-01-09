import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { API_BASE_URL } from '@/lib/api'
import { reportsCache, statsCache } from '@/lib/cache-helpers'

import { getClientId } from '@/lib/clientId'

/**
 * Global Real-time Feed Hook
 * 
 * Scope Mapping:
 * - 'new-report': Adds to all active report lists + increments global stats.
 * - 'stats-update': Updates specific report fields (votes, status) across detail and lists.
 */
export function useGlobalFeed() {
    const queryClient = useQueryClient()

    // In-memory idempotency guards to avoid double-processing during session
    const processedReports = useRef(new Set<string>())
    const processedUsers = useRef(new Set<string>())

    useEffect(() => {
        const url = `${API_BASE_URL}/realtime/feed`
        const eventSource = new EventSource(url)
        const myClientId = getClientId()

        // Helper to handle idempotency
        const shouldProcess = (eventId?: string) => {
            if (!eventId) return true;
            if (processedReports.current.has(eventId) || processedUsers.current.has(eventId)) return false;
            // Note: processedReports and processedUsers are also used for report/user specific IDs
            return true;
        };

        // 1. Report Creation
        eventSource.addEventListener('report-create', (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data)
                const reportId = data.partial?.id

                // Strict Echo Suppression
                if (data.originClientId === myClientId) return
                if (!shouldProcess(data.eventId)) return

                // Idempotency check for Report ID
                if (reportId && processedReports.current.has(reportId)) return
                if (reportId) processedReports.current.add(reportId)

                // Cache Patch: Prepend new report
                reportsCache.prepend(queryClient, data.partial)

                // Cache Patch: Stats (Atomic increment with category and status)
                if (data.partial?.category) {
                    statsCache.applyReportCreate(queryClient, data.partial.category, data.partial.status)
                }
            } catch (e) {
                console.error('[SSE] Error processing report-create', e)
            }
        })

        // 2. Report Update (Votes/Content)
        eventSource.addEventListener('report-update', (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data)

                if (data.originClientId === myClientId) return
                if (!shouldProcess(data.eventId)) return

                // Atomic Like Delta if present
                if (data.isLikeDelta) {
                    reportsCache.applyLikeDelta(queryClient, data.id, data.delta);
                } else if (data.isCommentDelta) {
                    reportsCache.applyCommentDelta(queryClient, data.id, data.delta);
                } else {
                    // Cache Patch: Update report fields
                    reportsCache.patch(queryClient, data.id, data.partial)
                }
            } catch (e) {
                console.error('[SSE] Error processing report-update', e)
            }
        })

        // 3. Status Change (Counters)
        eventSource.addEventListener('status-change', (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data)

                if (data.originClientId === myClientId) return
                if (!shouldProcess(data.eventId)) return

                // Cache Patch: Global Stats (Atomic resolutions delta)
                statsCache.applyStatusChange(queryClient, data.prevStatus, data.newStatus)

                // Cache Patch: Canonical Report Status
                reportsCache.patch(queryClient, data.id, { status: data.newStatus })
            } catch (e) {
                console.error('[SSE] Error processing status-change', e)
            }
        })

        // 4. Report Deletion
        eventSource.addEventListener('report-delete', (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data)

                if (data.originClientId === myClientId) return

                // Clear from processed if it's there (to allow re-creation if it was a mistake)
                processedReports.current.delete(data.id)

                // Cache Patch: Remove report
                reportsCache.remove(queryClient, data.id)

                // Cache Patch: Stats (Atomic decrement with category and status)
                if (data.category) {
                    statsCache.applyReportDelete(queryClient, data.category, data.status)
                }
            } catch (e) {
                console.error('[SSE] Error processing report-delete', e)
            }
        })

        // 5. User Creation
        eventSource.addEventListener('user-create', (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data)

                // Idempotency: Don't double count the same new user registration
                if (data.anonymousId && processedUsers.current.has(data.anonymousId)) return
                if (data.anonymousId) processedUsers.current.add(data.anonymousId)

                // Cache Patch: Stats (Atomic increment total users)
                statsCache.incrementUsers(queryClient)
            } catch (e) {
                console.error('[SSE] Error processing user-create', e)
            }
        })

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
