import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Report } from '@/lib/schemas'

export type ReportStatus = Report['status']

const STATUS_CONFIG: Record<ReportStatus, { label: string; className: string }> = {
    'pendiente': {
        label: 'Activo',
        className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    },
    'en_proceso': {
        label: 'En Proceso',
        className: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    },
    'resuelto': {
        label: 'Recuperado',
        className: 'bg-green-500/20 text-green-400 border-green-500/30'
    },
    'cerrado': {
        label: 'Cerrado', // Changed from 'Expirado' to be more generic, or keep Expirado if business rule matches
        className: 'bg-red-500/20 text-red-400 border-red-500/30'
    },
    'rechazado': {
        label: 'Rechazado',
        className: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    }
}

interface StatusBadgeProps {
    status: ReportStatus
    className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
    // Fallback for unknown status (safety)
    const config = STATUS_CONFIG[status] || { label: status, className: 'bg-gray-500/20 text-gray-400' }

    return (
        <Badge className={cn("px-2.5 py-0.5 text-xs font-semibold border", config.className, className)}>
            {config.label}
        </Badge>
    )
}
