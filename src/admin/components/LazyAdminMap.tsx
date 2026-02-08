import { lazy, Suspense } from 'react'

// ✅ PERFORMANCE FIX: Lazy load AdminMap (Leaflet ~200 KB)
// Only loads when admin dashboard map is actually rendered
const AdminMap = lazy(() =>
    import('./AdminMap').then(m => ({ default: m.default }))
)

/**
 * Lazy-loaded wrapper for AdminMap.
 * Prevents Leaflet from being included in the main bundle.
 * Shows loading state while the map chunk is downloading.
 */
export function LazyAdminMap() {
    return (
        <Suspense fallback={<AdminMapSkeleton />}>
            <AdminMap />
        </Suspense>
    )
}

/**
 * Skeleton loader for the admin map during lazy load
 */
function AdminMapSkeleton() {
    return (
        <div className="w-full h-full flex items-center justify-center bg-[#020617] text-[#00ff88]">
            <span className="animate-pulse">Loading Satellite Data...</span>
        </div>
    )
}
