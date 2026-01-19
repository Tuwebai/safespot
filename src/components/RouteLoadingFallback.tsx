/**
 * Loading fallback for lazy-loaded routes
 * Uses content-aware skeleton instead of blocking spinner
 * This keeps the layout visible and reduces perceived loading time
 */

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

// ✅ ENTERPRISE FIX: Stable keys for fixed-size arrays
const ROUTE_SKELETON_KEYS = ['route-card-1', 'route-card-2', 'route-card-3'];
const DETAIL_SKELETON_KEYS = ['detail-stat-1', 'detail-stat-2', 'detail-stat-3', 'detail-stat-4'];

export function RouteLoadingFallback() {
    return (
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
            {/* Header skeleton */}
            <div className="mb-8">
                <Skeleton height={40} width="50%" className="mb-2" />
                <Skeleton height={20} width="30%" />
            </div>

            {/* Content grid skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ROUTE_SKELETON_KEYS.map((key) => (
                    <Card key={key} className="bg-card border-border">
                        <CardHeader>
                            <Skeleton height={24} width="80%" className="mb-2" />
                            <Skeleton height={16} width="60%" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton height={14} width="100%" className="mb-2" />
                            <Skeleton height={14} width="90%" className="mb-4" />
                            <div className="flex items-center justify-between">
                                <Skeleton height={14} width={80} />
                                <Skeleton height={32} width={100} radius="0.375rem" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}

/**
 * Minimal fallback for detail pages (single item view)
 */
export function DetailLoadingFallback() {
    return (
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            {/* Back button skeleton */}
            <Skeleton height={36} width={100} className="mb-6" radius="0.375rem" />

            {/* Header section */}
            <div className="mb-8">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <Skeleton height={32} width="60%" className="mb-2" />
                        <div className="flex items-center gap-2">
                            <Skeleton height={24} width={80} radius="9999px" />
                            <Skeleton height={24} width={100} radius="9999px" />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Skeleton height={36} width={36} radius="0.375rem" />
                        <Skeleton height={36} width={36} radius="0.375rem" />
                    </div>
                </div>
            </div>

            {/* Description card */}
            <Card className="bg-card border-border mb-6">
                <CardHeader>
                    <Skeleton height={20} width={120} />
                </CardHeader>
                <CardContent>
                    <Skeleton height={14} width="100%" className="mb-2" />
                    <Skeleton height={14} width="95%" className="mb-2" />
                    <Skeleton height={14} width="80%" />
                </CardContent>
            </Card>

            {/* Meta grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {DETAIL_SKELETON_KEYS.map((key) => (
                    <Card key={key} className="bg-card border-border">
                        <CardContent className="p-4 text-center">
                            <Skeleton height={32} width={48} className="mx-auto mb-2" />
                            <Skeleton height={14} width={60} className="mx-auto" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}
