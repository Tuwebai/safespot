import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function ReportSkeleton() {
    return (
        <Card className="bg-dark-card border-dark-border">
            <CardContent className="p-6">
                {/* Title skeleton */}
                <Skeleton height={28} width="70%" className="mb-3" />

                {/* Meta row (category + status) */}
                <div className="flex items-center gap-2 mb-4">
                    <Skeleton height={20} width={80} radius="9999px" />
                    <Skeleton height={20} width={100} radius="9999px" />
                </div>

                {/* Description skeleton (2-3 lines) */}
                <div className="space-y-2 mb-4">
                    <Skeleton height={16} width="100%" />
                    <Skeleton height={16} width="95%" />
                    <Skeleton height={16} width="80%" />
                </div>

                {/* Image skeleton */}
                <Skeleton height={200} width="100%" radius="0.5rem" className="mb-4" />

                {/* Footer meta */}
                <div className="flex items-center justify-between">
                    <Skeleton height={16} width={120} />
                    <Skeleton height={16} width={80} />
                </div>
            </CardContent>
        </Card>
    )
}

export function ReportCardSkeleton() {
    return (
        <Card className="bg-dark-card border-dark-border card-glow">
            <CardContent className="p-4">
                {/* Title */}
                <Skeleton height={24} width="80%" className="mb-2" />

                {/* Meta */}
                <div className="flex items-center gap-2 mb-3">
                    <Skeleton height={18} width={60} radius="9999px" />
                    <Skeleton height={18} width={80} radius="9999px" />
                </div>

                {/* Description snippet */}
                <Skeleton height={14} width="100%" className="mb-1" />
                <Skeleton height={14} width="70%" className="mb-3" />

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-dark-border">
                    <Skeleton height={14} width={100} />
                    <Skeleton height={14} width={60} />
                </div>
            </CardContent>
        </Card>
    )
}

export function CommentSkeleton() {
    return (
        <Card className="bg-dark-card border-dark-border">
            <CardContent className="p-4">
                <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <Skeleton height={40} width={40} radius="9999px" />

                    <div className="flex-1">
                        {/* User name */}
                        <Skeleton height={16} width={120} className="mb-2" />

                        {/* Comment text */}
                        <Skeleton height={14} width="100%" className="mb-1" />
                        <Skeleton height={14} width="90%" className="mb-1" />
                        <Skeleton height={14} width="60%" />
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
