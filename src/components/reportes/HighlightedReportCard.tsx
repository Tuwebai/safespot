import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar'
import { MapPin, Eye, MessageCircle, ArrowUp, Shield, Flag } from 'lucide-react'
import { SmartLink } from '@/components/SmartLink'
import { LazyReportMapFallback as ReportMapFallback } from '@/components/ui/LazyReportMapFallback'
import { useReport } from '@/hooks/queries/useReportsQuery'
import { getAvatarUrl } from '@/lib/avatar'
import { FavoriteButton } from '@/components/FavoriteButton'
import { useIsOwner } from '@/hooks/useIsOwner'

import { getDeterministicScore } from '@/lib/utils-score'

interface HighlightedReportCardProps {
    reportId: string
    initialData?: import('@/lib/normalizeReport').NormalizedReport
    onToggleFavorite: (newState: boolean) => void
    onFlag: (e: React.MouseEvent) => void
    isFlagging?: boolean
}

/**
 * Reporte Destacado (Hero Card)
 * Card más grande para el reporte más urgente/relevante
 * Incluye mapa estático optimizado (120x120px)
 */
export function HighlightedReportCard({
    reportId,
    initialData,
    onToggleFavorite,
    onFlag,
    isFlagging = false
}: HighlightedReportCardProps) {
    const { data: report } = useReport(reportId, initialData, {
        enabled: !initialData?._isOptimistic, // ✅ Prevent 404s on optimistic items
        isOptimistic: initialData?._isOptimistic // ✅ Explicit flag for hook logic
    })

    if (!report) {
        return null
    }

    // SafeScore Determinístico (Estable entre renders)
    const safeScore = getDeterministicScore(report.id)

    const isOwner = useIsOwner(report?.author?.id)
    const isFlagged = report?.is_flagged ?? false

    return (
        <SmartLink
            to={`/reporte/${report.id}`}
            prefetchReportId={!initialData?._isOptimistic ? report.id : undefined} // ✅ Prevent prefetch 404 on optimistic
            prefetchRoute="DetalleReporte"
            className="block no-underline"
        >
            <Card className="group bg-gradient-to-br from-card/90 to-card border-neon-green/30 hover:border-neon-green transition-all duration-300 shadow-xl hover:shadow-[0_0_30px_rgba(33,255,140,0.2)]">
                <CardContent className="p-4 md:p-6">
                    <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                        {/* Mapa (Arriba en móvil, Izquierda en desktop) */}
                        <div className="flex-shrink-0 w-full md:w-[140px] h-48 md:h-[140px] rounded-lg overflow-hidden shadow-lg relative z-0">
                            <ReportMapFallback
                                lat={report.latitude ?? undefined}
                                lng={report.longitude ?? undefined}
                            />
                        </div>

                        {/* Contenido */}
                        <div className="flex-1 flex flex-col">
                            {/* SafeScore + Categoría */}
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Shield className="h-5 w-5 text-neon-green" />
                                    <span className="text-sm font-medium text-muted-foreground">SafeScore:</span>
                                    <span className="text-2xl font-bold text-neon-green">{safeScore}/100</span>
                                </div>
                                <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                                    {report.category}
                                </Badge>
                            </div>

                            {/* Título */}
                            <h3 className="text-2xl font-bold text-foreground mb-2 line-clamp-2 group-hover:text-neon-green transition-colors">
                                {report.title}
                            </h3>

                            {/* Ubicación + Tiempo */}
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                                <div className="flex items-center gap-1">
                                    <MapPin className="h-4 w-4 text-neon-green" />
                                    {/* ✅ Enterprise Fix: Use normalized address */}
                                    <span className="truncate">{report.fullAddress}</span>
                                </div>
                                <span>•</span>
                                <span>{report.formattedDate}</span>
                            </div>

                            <div className="h-px bg-border/50 my-3" />

                            {/* Descripción */}
                            <p className="text-foreground/80 text-sm mb-4 line-clamp-3">
                                {report.description}
                            </p>

                            {/* Métricas */}
                            <div className="flex items-center gap-6 text-sm text-muted-foreground mb-4">
                                <div className="flex items-center gap-1.5">
                                    <Eye className="h-4 w-4" />
                                    <span>{0}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <MessageCircle className="h-4 w-4" />
                                    <span>{report.comments_count ?? 0}</span>
                                </div>
                                <ArrowUp className="h-4 w-4" />
                                <span>{report.upvotes_count ?? 0}</span>
                            </div>

                            {/* Footer: Autor + CTA + Actions */}
                            <div className="flex items-center justify-between mt-auto pt-4 border-t border-border">
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-8 w-8 border border-white/10">
                                        <AvatarImage
                                            src={report.author?.avatarUrl || getAvatarUrl(report.author?.id || 'unknown')}
                                            alt="Avatar"
                                        />
                                        <AvatarFallback className="bg-muted text-xs text-muted-foreground">
                                            {report.avatarFallback}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="text-sm font-medium text-neon-green">
                                        {report.displayAuthor}
                                    </span>
                                </div>

                                <div className="flex items-center gap-3">
                                    {/* Actions Inline */}
                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                        <FavoriteButton
                                            reportId={report.id}
                                            isFavorite={report.is_favorite ?? false}
                                            onToggle={onToggleFavorite}
                                            variant="ghost"
                                            className="hover:bg-white/10"
                                        />

                                        {!isOwner && (
                                            isFlagged ? (
                                                <div className="px-2 py-1 bg-yellow-500/10 text-yellow-500 text-xs rounded-md border border-yellow-500/20 flex items-center gap-1" title="Reporte enviado">
                                                    <Flag className="h-3 w-3 fill-current" />
                                                </div>
                                            ) : (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        onFlag(e);
                                                    }}
                                                    disabled={isFlagging}
                                                    className="hover:bg-white/10 hover:text-yellow-400 text-foreground/70 h-9 w-9"
                                                    title="Reportar contenido"
                                                >
                                                    {isFlagging ? (
                                                        <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                                                    ) : (
                                                        <Flag className="h-4 w-4" />
                                                    )}
                                                </Button>
                                            )
                                        )}
                                    </div>

                                    <Button
                                        variant="neon"
                                        size="sm"
                                        className="shadow-[0_0_15px_rgba(33,255,140,0.3)] hidden sm:flex"
                                    >
                                        Ver Detalles →
                                    </Button>
                                    <Button
                                        variant="neon"
                                        size="sm"
                                        className="shadow-[0_0_15px_rgba(33,255,140,0.3)] sm:hidden"
                                    >
                                        Ver →
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </SmartLink>
    )
}
