import { Card, CardContent } from '@/components/ui/card'
import { useMemo } from 'react'

/**
 * Enhanced Skeleton Screens with realistic structure and smooth shimmer
 */

// Base shimmer class for all skeletons
const shimmerClass = "shimmer rounded"

export function ReportCardSkeleton() {
    return (
        <Card className="bg-dark-card border-dark-border overflow-hidden h-full flex flex-col animate-in fade-in duration-300">
            {/* Image placeholder - matches aspect-video */}
            <div className="relative aspect-video w-full overflow-hidden bg-dark-bg/50">
                <div className={`w-full h-full ${shimmerClass}`} />
            </div>

            <CardContent className="p-6 flex-1 flex flex-col">
                {/* Title */}
                <div className={`h-6 ${shimmerClass} w-3/4 mb-3`} />

                {/* Category badge */}
                <div className="flex items-center gap-2 mb-4">
                    <div className={`h-3 w-3 rounded-full ${shimmerClass}`} />
                    <div className={`h-4 ${shimmerClass} w-24`} />
                </div>

                {/* Description lines */}
                <div className="space-y-2 mb-6">
                    <div className={`h-4 ${shimmerClass} w-full`} />
                    <div className={`h-4 ${shimmerClass} w-11/12`} />
                    <div className={`h-4 ${shimmerClass} w-4/5`} />
                </div>

                {/* Location */}
                <div className="flex items-center gap-2 mb-4 mt-auto">
                    <div className={`h-4 w-4 ${shimmerClass}`} />
                    <div className={`h-4 ${shimmerClass} w-32`} />
                </div>

                {/* Footer - Date and stats */}
                <div className="flex items-center justify-between pt-4 border-t border-dark-border">
                    <div className="flex items-center gap-2">
                        <div className={`h-6 w-6 rounded-full ${shimmerClass}`} />
                        <div className={`h-3 ${shimmerClass} w-20`} />
                    </div>
                    <div className="flex gap-4">
                        <div className={`h-4 ${shimmerClass} w-8`} />
                        <div className={`h-4 ${shimmerClass} w-8`} />
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

export function ReportDetailSkeleton() {
    return (
        <Card className="bg-dark-card border-dark-border max-w-4xl mx-auto overflow-hidden animate-in fade-in duration-300">
            {/* Hero Image */}
            <div className="relative w-full h-96 bg-dark-bg/50">
                <div className={`w-full h-full ${shimmerClass}`} />
            </div>

            <CardContent className="p-8">
                {/* Title */}
                <div className={`h-10 ${shimmerClass} w-2/3 mb-6`} />

                {/* Meta badges */}
                <div className="flex items-center gap-4 mb-8">
                    <div className={`h-6 ${shimmerClass} w-24 rounded-full`} />
                    <div className={`h-6 ${shimmerClass} w-32 rounded-full`} />
                    <div className={`h-6 ${shimmerClass} w-28`} />
                </div>

                {/* Description */}
                <div className="space-y-3 mb-12">
                    <div className={`h-5 ${shimmerClass} w-full`} />
                    <div className={`h-5 ${shimmerClass} w-full`} />
                    <div className={`h-5 ${shimmerClass} w-11/12`} />
                    <div className={`h-5 ${shimmerClass} w-4/5`} />
                </div>

                {/* Location section */}
                <div className="mb-8">
                    <div className={`h-6 ${shimmerClass} w-32 mb-4`} />
                    <div className={`h-48 ${shimmerClass} w-full rounded-lg`} />
                </div>

                {/* Stats */}
                <div className="flex justify-between pt-6 border-t border-dark-border">
                    <div className={`h-5 ${shimmerClass} w-32`} />
                    <div className={`h-5 ${shimmerClass} w-40`} />
                </div>
            </CardContent>
        </Card>
    )
}

export function CommentSkeleton() {
    return (
        <div className="bg-dark-card border border-dark-border rounded-lg p-4 animate-in fade-in duration-200">
            <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className={`h-10 w-10 rounded-full ${shimmerClass} flex-shrink-0`} />

                <div className="flex-1">
                    {/* Username and timestamp */}
                    <div className="flex items-center gap-2 mb-2">
                        <div className={`h-4 ${shimmerClass} w-24`} />
                        <div className={`h-3 ${shimmerClass} w-16`} />
                    </div>

                    {/* Comment text */}
                    <div className="space-y-2">
                        <div className={`h-4 ${shimmerClass} w-full`} />
                        <div className={`h-4 ${shimmerClass} w-5/6`} />
                        <div className={`h-4 ${shimmerClass} w-2/3`} />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-4 mt-3">
                        <div className={`h-8 ${shimmerClass} w-16 rounded`} />
                        <div className={`h-8 ${shimmerClass} w-20 rounded`} />
                    </div>
                </div>
            </div>
        </div>
    )
}

export function StatCardSkeleton() {
    return (
        <Card className="bg-dark-card border-dark-border animate-in fade-in duration-300">
            <CardContent className="p-6">
                <div className="flex items-center justify-between">
                    <div className="flex-1">
                        <div className={`h-4 ${shimmerClass} w-24 mb-3`} />
                        <div className={`h-8 ${shimmerClass} w-16`} />
                    </div>
                    <div className={`h-12 w-12 rounded-full ${shimmerClass}`} />
                </div>
            </CardContent>
        </Card>
    )
}

export function ListItemSkeleton() {
    return (
        <div className="flex items-center gap-4 p-4 bg-dark-card border border-dark-border rounded-lg animate-in fade-in duration-200">
            <div className={`h-16 w-16 rounded ${shimmerClass} flex-shrink-0`} />
            <div className="flex-1">
                <div className={`h-5 ${shimmerClass} w-3/4 mb-2`} />
                <div className={`h-4 ${shimmerClass} w-1/2`} />
            </div>
            <div className={`h-8 w-8 rounded-full ${shimmerClass}`} />
        </div>
    )
}

// Grid of report cards (for Reportes page)
export function ReportGridSkeleton({ count = 6 }: { count?: number }) {
    // ✅ ENTERPRISE FIX: Stable keys using useMemo to prevent re-generation
    const skeletonKeys = useMemo(
        () => Array.from({ length: count }, (_, i) => `report-skeleton-${i}`),
        [count]
    );

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {skeletonKeys.map((key) => (
                <ReportCardSkeleton key={key} />
            ))}
        </div>
    )
}

// List of comments (for DetalleReporte page)
export function CommentsListSkeleton({ count = 3 }: { count?: number }) {
    // ✅ ENTERPRISE FIX: Stable keys using useMemo to prevent re-generation
    const skeletonKeys = useMemo(
        () => Array.from({ length: count }, (_, i) => `comment-skeleton-${i}`),
        [count]
    );

    return (
        <div className="space-y-4">
            {skeletonKeys.map((key) => (
                <CommentSkeleton key={key} />
            ))}
        </div>
    )
}
export function RichTextEditorSkeleton() {
    // ✅ ENTERPRISE FIX: Stable keys for fixed-size arrays
    const toolbarKeys = ['toolbar-1', 'toolbar-2', 'toolbar-3', 'toolbar-4', 'toolbar-5', 'toolbar-6'];
    const actionsKeys = ['action-1', 'action-2', 'action-3'];

    return (
        <div className="space-y-3 animate-in fade-in duration-200">
            {/* Toolbar skeleton */}
            <div className="flex items-center justify-between flex-wrap gap-2 p-2 bg-dark-bg/50 rounded-lg border border-dark-border/50">
                <div className="flex items-center gap-1">
                    {toolbarKeys.map(key => (
                        <div key={key} className={`h-8 w-8 ${shimmerClass}`} />
                    ))}
                </div>
                <div className="flex items-center gap-1 border-l border-dark-border/30 pl-2">
                    {actionsKeys.map(key => (
                        <div key={key} className={`h-8 w-8 ${shimmerClass}`} />
                    ))}
                </div>
            </div>

            {/* Editor area skeleton */}
            <div className={`min-h-[200px] w-full bg-dark-bg/50 border border-dark-border/50 rounded-lg ${shimmerClass}`} />

            {/* Footer skeleton */}
            <div className="flex items-center justify-end gap-3">
                <div className={`h-8 w-24 ${shimmerClass}`} />
                <div className={`h-8 w-24 ${shimmerClass}`} />
            </div>
        </div>
    )
}
