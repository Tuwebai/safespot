import { memo } from 'react'
import { Card } from '@/components/ui/card'
import { Calendar, GitBranch, MessageCircle } from 'lucide-react'
import type { Report } from '@/lib/schemas'
import { formatReportDate } from '@/lib/dateUtils'

// ============================================
// TYPES
// ============================================

interface ReportMetaProps {
    report: Report
    commentsCount: number
}

// ============================================
// COMPONENT
// ============================================

export const ReportMeta = memo(function ReportMeta({ report, commentsCount }: ReportMetaProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {/* Date Card */}
            <Card className="p-4 bg-dark-card border-dark-border">
                <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-neon-green" />
                    <div>
                        <div className="text-sm text-muted-foreground mb-1">Fecha del incidente</div>
                        <div className="font-medium text-foreground">
                            {formatReportDate(report.incident_date || report.created_at)}
                        </div>
                    </div>
                </div>
            </Card>

            {/* Threads Card */}
            <Card className="p-4 bg-dark-card border-dark-border">
                <div className="flex items-center gap-3">
                    <GitBranch className="h-5 w-5 text-blue-400" />
                    <div>
                        <div className="text-sm text-muted-foreground mb-1">Hilos</div>
                        <div className="font-medium text-foreground">{report.threads_count ?? 0}</div>
                    </div>
                </div>
            </Card>

            {/* Comments Card */}
            <Card className="p-4 bg-dark-card border-dark-border">
                <div className="flex items-center gap-3">
                    <MessageCircle className="h-5 w-5 text-green-400" />
                    <div>
                        <div className="text-sm text-muted-foreground mb-1">Comentarios</div>
                        <div className="font-medium text-foreground">{commentsCount}</div>
                    </div>
                </div>
            </Card>
        </div>
    )
})
