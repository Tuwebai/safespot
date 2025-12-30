import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function ReportSkeleton() {
    return (
        <Card className="bg-dark-card border-dark-border max-w-4xl mx-auto overflow-hidden">
            {/* Image Placeholder */}
            <Skeleton height={400} width="100%" />

            <CardContent className="p-8">
                {/* Title */}
                <Skeleton height={40} width="70%" className="mb-4" />

                {/* Meta Row */}
                <div className="flex items-center gap-4 mb-8">
                    <Skeleton height={24} width={100} radius="9999px" />
                    <Skeleton height={24} width={150} />
                </div>

                {/* Content Block */}
                <div className="space-y-4 mb-12">
                    <Skeleton height={20} width="100%" />
                    <Skeleton height={20} width="95%" />
                    <Skeleton height={20} width="80%" />
                </div>

                {/* Stats Row */}
                <div className="flex justify-between pt-6 border-t border-dark-border">
                    <Skeleton height={20} width={120} />
                    <Skeleton height={20} width={180} />
                </div>
            </CardContent>
        </Card>
    )
}

export function ReportCardSkeleton() {
    return (
        <Card className="bg-dark-card border-dark-border overflow-hidden h-full flex flex-col">
            {/* Image section placeholder */}
            <Skeleton height={200} width="100%" />

            <CardContent className="p-6 flex-1">
                {/* Header */}
                <div className="flex justify-between mb-3">
                    <Skeleton height={24} width="75%" />
                </div>

                {/* Category */}
                <div className="flex items-center gap-2 mb-4">
                    <Skeleton height={12} width={12} radius="50%" />
                    <Skeleton height={16} width={100} />
                </div>

                {/* Description Snippet */}
                <div className="space-y-2 mb-6">
                    <Skeleton height={14} width="100%" />
                    <Skeleton height={14} width="90%" />
                </div>

                {/* Footer Meta */}
                <div className="flex justify-between items-center pt-4 border-t border-dark-border mt-auto">
                    <Skeleton height={32} width={100} radius="0.375rem" />
                    <div className="flex gap-2">
                        <Skeleton height={32} width={32} radius="50%" />
                        <Skeleton height={32} width={32} radius="50%" />
                    </div>
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
