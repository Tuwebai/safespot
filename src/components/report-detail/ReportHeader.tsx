import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar"
import { MapPin } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { NormalizedReport } from '@/lib/normalizeReport'
import { PrefetchLink } from '@/components/PrefetchLink'

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

            {/* 🛡️ DEFENSIVE CODING: Don't link to deleted users */}
            {report.displayAuthor === 'Usuario eliminado' ? (
                <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/30 opacity-60">
                    <Avatar className="h-8 w-8 border border-white/10">
                        <AvatarFallback className="bg-muted text-[10px] text-muted-foreground">
                            {report.avatarFallback}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-muted-foreground leading-none">
                            {report.displayAuthor}
                        </span>
                        <span className="text-xs text-muted-foreground/70">
                            {formatDistanceToNow(new Date(report.created_at), { addSuffix: true, locale: es })}
                        </span>
                    </div>
                </div>
            ) : (
                <PrefetchLink
                    // ✅ FIXED: Use Author SSOT. Prefer alias, fallback to ID.
                    to={`/usuario/${report.author.alias !== 'Anónimo' ? report.author.alias : report.author.id}`}
                    prefetchRoute="PublicProfile"
                >
                    <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-muted/50 border border-transparent hover:border-neon-green/30 transition-all group/author cursor-pointer">
                        <Avatar className="h-8 w-8 border border-white/10 group-hover/author:border-neon-green/50 transition-colors">
                            <AvatarImage
                                // ✅ FIXED: Use Author SSOT
                                src={report.author.avatarUrl}
                                alt={report.author.alias}
                            />
                            <AvatarFallback className="bg-muted text-[10px] text-muted-foreground">
                                {report.avatarFallback}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-neon-green leading-none group-hover/author:text-neon-green/80 transition-colors">
                                {report.displayAuthor}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(report.created_at), { addSuffix: true, locale: es })}
                            </span>
                        </div>
                    </div>
                </PrefetchLink>
            )}
        </div>
    )
})
