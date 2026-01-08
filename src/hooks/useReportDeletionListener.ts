import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '@/lib/api'
import { useToast } from '@/components/ui/toast/useToast'

export function useReportDeletionListener(reportId?: string) {
    const navigate = useNavigate()
    const { error } = useToast()

    useEffect(() => {
        if (!reportId) return

        const url = `${API_BASE_URL}/realtime/feed`
        const eventSource = new EventSource(url)

        eventSource.onmessage = null // Explicitly nullify default handler

        eventSource.addEventListener('global-report-update', (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data)

                if (data.type === 'delete' && data.reportId === reportId) {
                    // Show toast
                    error("Reporte eliminado: El autor ha eliminado este reporte.", 5000);

                    // Redirect to home/reports
                    navigate('/reportes', { replace: true })
                }
            } catch (err) {
                console.error('[SSE] Error parsing deletion event:', err)
            }
        })

        return () => {
            eventSource.close()
        }
    }, [reportId, navigate, error])
}
