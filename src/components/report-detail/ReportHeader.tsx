import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar"
import { MapPin } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { NormalizedReport } from '@/lib/normalizeReport'
import { PrefetchLink } from '@/components/PrefetchLink'
import { getAvatarUrl } from '@/lib/avatar'

// ============================================
// TYPES
// ============================================

interface ReportHeaderProps {
    report: NormalizedReport
}

// ============================================
// HELPERS
// ============================================

function getStatusColor(status: NormalizedReport['status']): string {
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

function getStatusLabel(status: NormalizedReport['status']): string {
    const labelMap: Record<NormalizedReport['status'], string> = {
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
        <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight break-words">
                    {report.title}
                </h1>
                <Badge className={cn("px-2.5 py-0.5 text-xs font-semibold", getStatusColor(report.status))}>
                    {getStatusLabel(report.status)}
                </Badge>
            </div>

            <div className="flex items-center text-foreground/50 text-sm md:text-base bg-muted w-fit px-3 py-1.5 rounded-full border border-border/30">
                <MapPin className="h-4 w-4 mr-2 text-neon-green/70" />
                <span className="truncate">{report.address || report.zone || 'Sin ubicación'}</span>
            </div>

            <PrefetchLink
                to={`/usuario/${report.alias || report.anonymous_id}`}
                prefetchRoute="PublicProfile"
            >
                <div className="relative">
                    <Avatar className="h-8 w-8 border border-white/10 group-hover/author:border-neon-green/50 transition-colors">
                        <AvatarImage
                            src={report.avatar_url || getAvatarUrl(report.anonymous_id)}
                            alt="Avatar"
                        />
                        <AvatarFallback className="bg-muted text-[10px] text-muted-foreground">
                            {report.avatarFallback}
                        </AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 bg-neon-green/10 rounded-full opacity-0 group-hover/author:opacity-100 blur-[2px] transition-opacity" />
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground/90 leading-none group-hover/author:text-white transition-colors">
                        {report.displayAuthor}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(report.created_at), { addSuffix: true, locale: es })}
                    </span>
                </div>
            </PrefetchLink>
        </div>
    )
})
