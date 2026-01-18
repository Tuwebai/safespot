import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { API_BASE_URL } from '@/lib/api'
import { reportsCache, statsCache } from '@/lib/cache-helpers'

import { getClientId } from '@/lib/clientId'
import { ssePool } from '@/lib/ssePool'
import { reportSchema } from '@/lib/schemas' // Import Schema

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
        const myClientId = getClientId()

        // Helper to handle idempotency
        const shouldProcess = (eventId?: string) => {
            if (!eventId) return true;
            if (processedReports.current.has(eventId) || processedUsers.current.has(eventId)) return false;
            return true;
        };

        // 1. Report Creation
        const unsubCreate = ssePool.subscribe(url, 'report-create', (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data)
                const reportId = data.partial?.id
                if (data.originClientId === myClientId) return
                if (!shouldProcess(data.eventId)) return
                if (reportId && processedReports.current.has(reportId)) return
                if (reportId) processedReports.current.add(reportId)

                // Validate Schema (Strict for Create)
                const parsed = reportSchema.safeParse(data.partial)
                if (!parsed.success) {
                    console.warn('[SSE] Dropping invalid report-create', parsed.error)
                    return
                }

                reportsCache.prepend(queryClient, parsed.data)
                // Guaranteed by schema
                statsCache.applyReportCreate(queryClient, parsed.data.category, parsed.data.status)
            } catch (e) {
                console.error('[SSE] Error processing report-create', e)
            }
        })

        // 2. Report Update (Votes/Content)
        const unsubUpdate = ssePool.subscribe(url, 'report-update', (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data)
                if (data.originClientId === myClientId) return
                if (!shouldProcess(data.eventId)) return

                if (data.isLikeDelta) {
                    reportsCache.applyLikeDelta(queryClient, data.id, data.delta);
                } else if (data.isCommentDelta) {
                    reportsCache.applyCommentDelta(queryClient, data.id, data.delta);
                } else {
                    const parsed = reportSchema.partial().safeParse(data.partial)
                    if (parsed.success) {
                        reportsCache.patch(queryClient, data.id, parsed.data)
                    } else {
                        console.warn('[SSE] Invalid patch data', parsed.error)
                    }
                }
            } catch (e) {
                console.error('[SSE] Error processing report-update', e)
            }
        })

        // 3. Status Change (Counters)
        const unsubStatus = ssePool.subscribe(url, 'status-change', (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data)
                if (data.originClientId === myClientId) return
                if (!shouldProcess(data.eventId)) return

                statsCache.applyStatusChange(queryClient, data.prevStatus, data.newStatus)
                reportsCache.patch(queryClient, data.id, { status: data.newStatus })
            } catch (e) {
                console.error('[SSE] Error processing status-change', e)
            }
        })

        // 4. Report Deletion
        const unsubDelete = ssePool.subscribe(url, 'report-delete', (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data)
                if (data.originClientId === myClientId) return
                processedReports.current.delete(data.id)
                reportsCache.remove(queryClient, data.id)
                if (data.category) {
                    statsCache.applyReportDelete(queryClient, data.category, data.status)
                }
            } catch (e) {
                console.error('[SSE] Error processing report-delete', e)
            }
        })

        // 5. User Creation
        const unsubUser = ssePool.subscribe(url, 'user-create', (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data)
                if (data.anonymousId && processedUsers.current.has(data.anonymousId)) return
                if (data.anonymousId) processedUsers.current.add(data.anonymousId)
                statsCache.incrementUsers(queryClient)
            } catch (e) {
                console.error('[SSE] Error processing user-create', e)
            }
        })

        return () => {
            unsubCreate();
            unsubUpdate();
            unsubStatus();
            unsubDelete();
            unsubUser();
        }
    }, [queryClient])
}
