import { memo } from 'react'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar"
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import type { NormalizedReport } from '@/lib/normalizeReport'
import { PrefetchLink } from '@/components/PrefetchLink'

// ============================================
// TYPES
// ============================================

interface ReportHeaderProps {
    report: NormalizedReport
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
                <StatusBadge status={report.status} />
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
