/**
 * PrefetchLink - A Link component that prefetches on hover
 * 
 * Features:
 * - Prefetches route chunk on mouseEnter
 * - Optionally prefetches data (e.g., report details)
 * - Only prefetches once per target
 * - Fallback to regular click if prefetch fails
 */

import { Link, type LinkProps } from 'react-router-dom'
import { useCallback, useRef } from 'react'
import { prefetchReport, prefetchRouteChunk } from '@/lib/prefetch'

interface PrefetchLinkProps extends LinkProps {
    /**
     * The report ID to prefetch data for (optional)
     * If provided, will prefetch the report data on hover
     */
    prefetchReportId?: string

    /**
     * The route chunk name to prefetch (optional)
     * e.g., 'DetalleReporte', 'Gamificacion', etc.
     */
    prefetchRoute?: string
}

export function PrefetchLink({
    prefetchReportId,
    prefetchRoute,
    onMouseEnter,
    children,
    ...props
}: PrefetchLinkProps) {
    // Track if we've already prefetched to avoid duplicate work
    const hasPrefetched = useRef(false)

    const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
        // Only prefetch once
        if (!hasPrefetched.current) {
            hasPrefetched.current = true

            // Prefetch route chunk (JS code)
            if (prefetchRoute) {
                prefetchRouteChunk(prefetchRoute)
            }

            // Prefetch data (e.g., report details)
            if (prefetchReportId) {
                prefetchReport(prefetchReportId)
            }
        }

        // Call original onMouseEnter if provided
        onMouseEnter?.(e)
    }, [prefetchReportId, prefetchRoute, onMouseEnter])

    return (
        <Link
            {...props}
            onMouseEnter={handleMouseEnter}
        >
            {children}
        </Link>
    )
}

