import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '@/lib/api'
import { useToast } from '@/components/ui/toast/useToast'
import { ssePool } from '@/lib/ssePool'
import { getClientId } from '@/lib/clientId'

/**
 * Real-time Deletion Listener
 * 
 * RESPONSIBILITY: Handle redirections and notifications when a report is deleted.
 * 
 * @param reportId ID of the report being viewed
 * @param isOwner Whether the current user is the owner of this report
 */
export function useReportDeletionListener(reportId?: string, isOwner: boolean = false) {
    const navigate = useNavigate()
    const { error } = useToast()

    useEffect(() => {
        if (!reportId) return

        const url = `${API_BASE_URL}/realtime/feed`
        const myClientId = getClientId()

        const unsub = ssePool.subscribe(url, 'report-delete', (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data)

                if (data.id === reportId) {
                    // SILENCE POLICY: 
                    // 1. If it's my own deletion action (same tab/client), I already showed a success toast.
                    // 2. If I'm the owner (different tab/client), I don't need the "author deleted" message.
                    const isMyAction = data.originClientId === myClientId
                    const shouldNotify = !isMyAction && !isOwner

                    if (shouldNotify) {
                        error("Reporte eliminado: El autor ha eliminado este reporte.", 5000)
                    }

                    // REDIRECT POLICY: Always redirect everyone to home/reports to maintain consistency
                    navigate('/reportes', { replace: true })
                }
            } catch (err) {
                console.error('[SSE] Error parsing deletion event:', err)
            }
        })

        return () => {
            unsub()
        }
    }, [reportId, isOwner, navigate, error])
}
