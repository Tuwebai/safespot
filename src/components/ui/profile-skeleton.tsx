import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function ProfileSkeleton() {
    return (
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main column */}
                <div className="lg:col-span-2 space-y-6">
                    {/* User info card */}
                    <Card className="bg-dark-card border-dark-border">
                        <CardContent className="p-6">
                            <div className="flex items-center gap-4 mb-6">
                                <Skeleton height={64} width={64} radius="9999px" />
                                <div className="flex-1">
                                    <Skeleton height={24} width="40%" className="mb-2" />
                                    <Skeleton height={16} width="60%" />
                                </div>
                            </div>

                            {/* Level progress */}
                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between">
                                    <Skeleton height={16} width={80} />
                                    <Skeleton height={16} width={100} />
                                </div>
                                <Skeleton height={8} width="100%" radius="9999px" />
                                <Skeleton height={12} width={150} />
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-dark-border">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="text-center">
                                        <Skeleton height={28} width={40} className="mx-auto mb-1" />
                                        <Skeleton height={12} width={60} className="mx-auto" />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Reports card */}
                    <Card className="bg-dark-card border-dark-border">
                        <CardContent className="p-6">
                            <Skeleton height={24} width={150} className="mb-4" />
                            <div className="space-y-3">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="p-4 rounded-lg bg-dark-bg border border-dark-border">
                                        <Skeleton height={20} width="70%" className="mb-2" />
                                        <Skeleton height={14} width="100%" className="mb-1" />
                                        <Skeleton height={14} width="80%" className="mb-3" />
                                        <div className="flex gap-4">
                                            <Skeleton height={12} width={60} />
                                            <Skeleton height={12} width={80} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    <Card className="bg-dark-card border-dark-border">
                        <CardContent className="p-6">
                            <Skeleton height={20} width={100} className="mb-4" />
                            <div className="space-y-4">
                                {[1, 2, 3].map((i) => (
                                    <div key={i}>
                                        <Skeleton height={14} width={100} className="mb-1" />
                                        <Skeleton height={20} width={120} />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
