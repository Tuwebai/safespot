import { useEffect, useState } from 'react'
import { realtimeOrchestrator } from '@/lib/realtime/RealtimeOrchestrator'

/**
 * 👑 Unified Passive Sync (Social Domain):
 * useRealtimeComments is now a PASSIVE observer.
 * Actual data synchronization is orchestrated by RealtimeOrchestrator.
 */
export function useRealtimeComments(reportId: string | undefined, enabled = true) {
    const [status, setStatus] = useState(realtimeOrchestrator.getHealthStatus())

    useEffect(() => {
        if (!reportId || !enabled) return

        // 1. Tell the Orchestrator to watch this social feed
        realtimeOrchestrator.watchReportComments(reportId)

        // 2. Respond to health status changes if needed
        const unsub = realtimeOrchestrator.onEvent(() => {
            setStatus(realtimeOrchestrator.getHealthStatus())
        })

        return () => {
            // 3. Cleanup: Tell the Orchestrator we are done
            realtimeOrchestrator.unwatchReportComments(reportId)
            unsub()
        }
    }, [reportId, enabled])

    return {
        isConnected: status === 'HEALTHY'
    }
}
