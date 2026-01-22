import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MapPin, MessageCircle, GitBranch, Flag, Shield } from 'lucide-react'
import { SmartLink } from '@/components/SmartLink'
import { LazyReportMapFallback as ReportMapFallback } from '@/components/ui/LazyReportMapFallback'
import { FavoriteButton } from '@/components/FavoriteButton'
import { AnimatedCard } from '@/components/ui/animated'
import { useReport } from '@/hooks/queries/useReportsQuery'
import type { NormalizedReport } from '@/lib/normalizeReport'
import { useIsOwner } from '@/hooks/useIsOwner'

// Helper functions (moved from ReportCard.tsx)
const getStatusColor = (status: NormalizedReport['status']) => {
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

const STATUS_LABELS: Record<NormalizedReport['status'], string> = {
    'pendiente': 'Buscando',
    'en_proceso': 'En Proceso',
    'resuelto': 'Recuperado',
    'cerrado': 'Expirado'
}

const getStatusLabel = (status: NormalizedReport['status']) => STATUS_LABELS[status] || status

const CATEGORY_COLORS: Record<string, string> = {
    'Robo de Bicicleta': 'bg-red-500',
    'Robo de Vehículo': 'bg-orange-500',
    'Robo de Objetos Personales': 'bg-purple-500',
    'Pérdida de Objetos': 'bg-blue-500',
    'Encontrado': 'bg-green-500',
    'Otros': 'bg-gray-500'
}

const getCategoryColor = (category: string) => CATEGORY_COLORS[category] || 'bg-gray-500'

import { getDeterministicScore } from '@/lib/utils-score'

interface CompactReportCardProps {
    reportId: string
    initialData?: NormalizedReport
    onToggleFavorite: (newState: boolean) => void
    onFlag: (e: React.MouseEvent) => void
    isFlagging?: boolean
}

/**
 * Card Compacta de Reporte (para el feed)
 * Versión optimizada con mapa estático pequeño (80x80px)
 */
export function CompactReportCard({
    reportId,
    initialData,
    onToggleFavorite,
    onFlag,
    isFlagging = false
}: CompactReportCardProps) {
    const { data: report } = useReport(reportId, initialData, {
        enabled: !initialData?._isOptimistic, // ✅ Prevent 404s on optimistic items
        isOptimistic: initialData?._isOptimistic
    })

    // const currentAnonymousId = getAnonymousIdSafe() // DEPRECATED: Use permission module
    // SSOT Ownership Check
    const isOwner = useIsOwner(report?.author?.id)
    const isFlagged = report?.is_flagged ?? false

    if (!report) {
        console.error(
            `[CompactReportCard] SSOT Violation: Report ID "${reportId}" rendered but entity not found in cache.`
        )
        return null
    }

    // SafeScore Resilience: Handle optimistic updates where ID might be temp/undefined
    // Contract: getDeterministicScore handles null/undefined gracefully now (returns 75)
    // We pass report.id explicitly, acknowledging it might be missing in partial partials
    const safeScore = getDeterministicScore(report.id)

    return (
        <SmartLink
            to={`/reporte/${report.id}`}
            prefetchReportId={!initialData?._isOptimistic ? report.id : undefined} // ✅ Prevent prefetch 404 on optimistic
            prefetchRoute="DetalleReporte"
            className="block h-full no-underline"
        >
            <AnimatedCard className="h-full">
                <Card className="group bg-card border-border hover:border-neon-green/50 transition-all duration-300 h-full flex flex-col overflow-hidden shadow-lg">
                    <CardContent className="p-4 flex gap-4">
                        {/* Mapa (Lateral Izquierdo) */}
                        <div className="flex-shrink-0 w-[100px] h-[100px] rounded-lg overflow-hidden shadow-md">
                            <ReportMapFallback
                                lat={report.latitude ?? undefined}
                                lng={report.longitude ?? undefined}
                            />
                        </div>

                        {/* Contenido */}
                        <div className="flex-1 flex flex-col min-w-0">
                            {/* SafeScore + Estado */}
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-1.5">
                                    <Shield className="h-3.5 w-3.5 text-neon-green" />
                                    <span className="text-xs font-semibold text-neon-green">{safeScore}</span>
                                </div>
                                <Badge className={`text-xs ${getStatusColor(report.status)}`}>
                                    {getStatusLabel(report.status)}
                                </Badge>
                            </div>

                            {/* Categoría + Título */}
                            <div className="flex items-center gap-2 mb-1.5">
                                <div className={`w-2 h-2 rounded-full ${getCategoryColor(report.category)}`} />
                                <span className="text-xs text-muted-foreground">{report.category}</span>
                            </div>

                            <h4 className="text-sm font-semibold text-foreground line-clamp-2 mb-2 group-hover:text-neon-green transition-colors">
                                {report.title}
                            </h4>

                            {/* Ubicación */}
                            <div className="flex items-center text-xs text-muted-foreground mb-2">
                                <MapPin className="h-3 w-3 mr-1 text-neon-green flex-shrink-0" />
                                <span className="truncate">{report.address || report.zone || 'Sin ubicación'}</span>
                            </div>

                            {/* Tiempo */}
                            <span className="text-xs text-muted-foreground mb-3">{report.formattedDate}</span>

                            {/* Métricas */}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                                <div className="flex items-center gap-1">
                                    <GitBranch className="h-3 w-3" />
                                    <span>{report.threads_count ?? 0}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <MessageCircle className="h-3 w-3" />
                                    <span>{report.comments_count}</span>
                                </div>
                            </div>

                            {/* Footer: Acciones */}
                            <div className="flex items-center justify-between mt-auto pt-3 border-t border-border">
                                <span className="text-neon-green font-medium text-xs">Ver Detalles →</span>
                                <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                                    <FavoriteButton
                                        reportId={report.id}
                                        isFavorite={report.is_favorite ?? false}
                                        onToggle={onToggleFavorite}
                                    />

                                    {!isOwner && (
                                        isFlagged ? (
                                            <span className="text-xs text-foreground/60" title="Ya has denunciado este reporte">
                                                Denunciado
                                            </span>
                                        ) : (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={(e) => {
                                                    e.preventDefault()
                                                    onFlag(e)
                                                }}
                                                disabled={isFlagging}
                                                className="hover:text-yellow-400 h-8 w-8 p-0"
                                                title={isFlagging ? 'Reportando...' : 'Reportar contenido inapropiado'}
                                            >
                                                {isFlagging ? (
                                                    <div className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full" />
                                                ) : (
                                                    <Flag className="h-3 w-3" />
                                                )}
                                            </Button>
                                        )
                                    )}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </AnimatedCard>
        </SmartLink>
    )
}
