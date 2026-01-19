import { lazy, Suspense } from 'react'
import { MapSkeleton } from './skeletons'

// ✅ PERFORMANCE FIX: Lazy load ReportMapFallback (Leaflet ~199 KB)
// Only loads when map is actually rendered
const ReportMapFallback = lazy(() =>
    import('./ReportMapFallback').then(m => ({ default: m.ReportMapFallback }))
)

interface LazyReportMapFallbackProps {
    lat?: number | string
    lng?: number | string
    className?: string
}

/**
 * Lazy-loaded wrapper for ReportMapFallback.
 * Prevents Leaflet from being included in the main bundle.
 * Shows skeleton while the map chunk is downloading.
 */
export function LazyReportMapFallback(props: LazyReportMapFallbackProps) {
    return (
        <Suspense fallback={<MapSkeleton className={props.className} />}>
            <ReportMapFallback {...props} />
        </Suspense>
    )
}
