import { lazy, Suspense } from 'react'
import { MapSkeleton } from '../ui/skeletons'

// ✅ PERFORMANCE FIX: Lazy load MiniMapPreview (Leaflet ~199 KB)
// Only loads when map is actually rendered
const MiniMapPreview = lazy(() =>
    import('./MiniMapPreview').then(m => ({ default: m.MiniMapPreview }))
)

interface LazyMiniMapPreviewProps {
    lat?: number
    lng?: number
}

/**
 * Lazy-loaded wrapper for MiniMapPreview.
 * Prevents Leaflet from being included in the main bundle.
 * Shows skeleton while the map chunk is downloading or when no coordinates are provided.
 */
export function LazyMiniMapPreview({ lat, lng }: LazyMiniMapPreviewProps) {
    // If no coordinates, just show skeleton
    if (lat === undefined || lng === undefined) {
        return <MapSkeleton />
    }

    return (
        <Suspense fallback={<MapSkeleton />}>
            <MiniMapPreview lat={lat} lng={lng} />
        </Suspense>
    )
}
