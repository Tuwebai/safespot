import { useEffect } from 'react'
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

    useEffect(() => {
        const url = `${API_BASE_URL}/realtime/feed`
        const eventSource = new EventSource(url)
        const myClientId = getClientId()

        // 1. Report Creation
        eventSource.addEventListener('report-create', (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data)

                // Strict Echo Suppression
                if (data.originClientId === myClientId) return

                // Cache Patch: Prepend new report
                reportsCache.prepend(queryClient, data.partial)

                // Cache Patch: Stats (Blind increment)
                statsCache.incrementGlobal(queryClient)
            } catch (e) {
                console.error('[SSE] Error processing report-create', e)
            }
        })

        // 2. Report Update
        eventSource.addEventListener('report-update', (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data)

                if (data.originClientId === myClientId) return

                // Cache Patch: Update report fields
                reportsCache.patch(queryClient, data.id, data.partial)
            } catch (e) {
                console.error('[SSE] Error processing report-update', e)
            }
        })

        // 3. Report Deletion
        eventSource.addEventListener('report-delete', (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data)

                if (data.originClientId === myClientId) return

                // Cache Patch: Remove report
                reportsCache.remove(queryClient, data.id)

                // Cache Patch: Stats (Blind decrement)
                statsCache.decrementGlobal(queryClient)
            } catch (e) {
                console.error('[SSE] Error processing report-delete', e)
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
