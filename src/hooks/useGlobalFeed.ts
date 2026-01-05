
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const API_BASE_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`

export function useGlobalFeed() {
    const queryClient = useQueryClient()

    useEffect(() => {
        const url = `${API_BASE_URL}/realtime/feed`
        const eventSource = new EventSource(url)

        eventSource.onopen = () => {
            console.log('[SSE] Connected to Global Feed')
        }

        eventSource.addEventListener('global-report-update', (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data)
                // console.log('[SSE] Global Feed Update:', data)

                // Invalidate lists to refresh counters on home page
                queryClient.invalidateQueries({ queryKey: ['reports', 'list'] })

                // Also stats if needed
                if (data.type === 'stats-update' || data.type === 'new_report') {
                    // Refresh stats when significant events happen
                    queryClient.invalidateQueries({ queryKey: queryKeys.stats.global })
                    queryClient.invalidateQueries({ queryKey: queryKeys.stats.categories })
                }
            } catch (err) {
                console.error('[SSE] Error parsing global feed event:', err)
            }
        })

        eventSource.onerror = () => {
            // Silence errors or handle retry logic if needed
            if (eventSource.readyState === EventSource.CLOSED) {
                // console.log('[SSE] Global Feed disconnected')
            }
        }

        return () => {
            eventSource.close()
        }
    }, [queryClient])
}
