import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { MapPin } from 'lucide-react'
import type { Report } from '@/lib/api'

// ============================================
// TYPES
// ============================================

interface ReportHeaderProps {
    report: Report
}

// ============================================
// HELPERS
// ============================================

function getStatusColor(status: Report['status']): string {
    switch (status) {
        case 'pendiente':
            return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
        case 'en_proceso':
            return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
        case 'resuelto':
            return 'bg-green-500/20 text-green-400 border-green-500/30'
        case 'cerrado':
            return 'bg-red-500/20 text-red-400 border-red-500/30'
        default:
            return ''
    }
}

function getStatusLabel(status: Report['status']): string {
    const labelMap: Record<Report['status'], string> = {
        'pendiente': 'Activo',
        'en_proceso': 'En Proceso',
        'resuelto': 'Recuperado',
        'cerrado': 'Expirado'
    }
    return labelMap[status] || status
}

// ============================================
// COMPONENT
// ============================================

export const ReportHeader = memo(function ReportHeader({ report }: ReportHeaderProps) {
    return (
        <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
                <h1 className="text-3xl font-bold text-foreground">{report.title}</h1>
                <Badge className={getStatusColor(report.status)}>
                    {getStatusLabel(report.status)}
                </Badge>
            </div>
            <div className="flex items-center text-foreground/60">
                <MapPin className="h-4 w-4 mr-2" />
                <span>{report.zone}</span>
            </div>
        </div>
    )
})
