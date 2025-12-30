import { useCallback, useRef } from 'react'
import { prefetchReport, prefetchRouteChunk } from '@/lib/prefetch'

/**
 * Hook for prefetching on hover - use with custom elements
 * 
 * @example
 * const { onMouseEnter } = usePrefetch({ reportId: report.id, route: 'DetalleReporte' })
 * <div onMouseEnter={onMouseEnter}>...</div>
 */
export function usePrefetch(options: {
    reportId?: string
    route?: string
}) {
    const hasPrefetched = useRef(false)

    const onMouseEnter = useCallback(() => {
        if (hasPrefetched.current) return
        hasPrefetched.current = true

        if (options.route) {
            prefetchRouteChunk(options.route)
        }
        if (options.reportId) {
            prefetchReport(options.reportId)
        }
    }, [options.reportId, options.route])

    return { onMouseEnter }
}
