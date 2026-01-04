import { Link, type LinkProps } from 'react-router-dom'
import { useCallback, useRef, useEffect } from 'react'
import { prefetchReport, prefetchRouteChunk } from '@/lib/prefetch'
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver'

interface SmartLinkProps extends LinkProps {
    /** Report ID to prefetch (optional) */
    prefetchReportId?: string
    /** Route chunk name to prefetch (optional) */
    prefetchRoute?: string
    /** 
     * Prefetch strategy:
     * 'visible' - prefetch when link enters viewport
     * 'hover' - prefetch when user interacts (interaction intent)
     * 'both' - use both (default)
     */
    prefetchOn?: 'visible' | 'hover' | 'both'
    /** High priority prefetch bypasses some checks */
    priority?: 'high' | 'low'
}

/**
 * SmartLink: A high-performance Link replacement.
 * Predicts user intent and optimizes bundle loading.
 */
export function SmartLink({
    prefetchReportId,
    prefetchRoute,
    prefetchOn = 'both',
    priority = 'low',
    onMouseEnter,
    children,
    ...props
}: SmartLinkProps) {
    const linkRef = useRef<HTMLAnchorElement>(null)
    const hasPrefetched = useRef(false)

    // Viewport-based prefetching
    const entry = useIntersectionObserver(linkRef, {
        freezeOnceVisible: true,
        rootMargin: '100px', // Start prefetching 100px before it enters viewport
    })

    const isVisible = !!entry?.isIntersecting

    const doPrefetch = useCallback(() => {
        if (hasPrefetched.current) return

        // 1. Senior Check: Respect "Save Data" browser mode
        if (priority !== 'high') {
            const conn = (navigator as any).connection
            if (conn?.saveData) {
                console.debug('[SmartLink] Skipping prefetch: SaveData is ON')
                return
            }
        }

        hasPrefetched.current = true

        if (prefetchRoute) {
            prefetchRouteChunk(prefetchRoute)
        }

        if (prefetchReportId) {
            // Validate UUID to avoid 500 errors on temp IDs (optimistic UI)
            const isTempId = prefetchReportId.startsWith('temp-') || prefetchReportId.length < 30
            if (!isTempId) {
                prefetchReport(prefetchReportId)
            }
        }
    }, [prefetchReportId, prefetchRoute, priority])

    // Effect for visible trigger
    useEffect(() => {
        if (isVisible && (prefetchOn === 'visible' || prefetchOn === 'both')) {
            doPrefetch()
        }
    }, [isVisible, prefetchOn, doPrefetch])

    const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
        if (prefetchOn === 'hover' || prefetchOn === 'both') {
            doPrefetch()
        }
        onMouseEnter?.(e)
    }, [prefetchOn, doPrefetch, onMouseEnter])

    return (
        <Link
            ref={linkRef}
            {...props}
            onMouseEnter={handleMouseEnter}
            // Trigger on pointer down (interaction start) for ultra-low latency
            onPointerDown={() => doPrefetch()}
        >
            {children}
        </Link>
    )
}
