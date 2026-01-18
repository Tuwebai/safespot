
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar"
import { MapPin, Home, Briefcase, GitBranch, MessageCircle, Flag } from 'lucide-react'
import { OptimizedImage } from '@/components/OptimizedImage'
import { ReportMapFallback } from '@/components/ui/ReportMapFallback'
import { FavoriteButton } from '@/components/FavoriteButton'
import { AnimatedCard } from '@/components/ui/animated'
import { SmartLink } from '@/components/SmartLink'
import { useReport } from '@/hooks/queries/useReportsQuery'
import { getAvatarUrl } from '@/lib/avatar'
import { getAnonymousIdSafe } from '@/lib/identity'
import { ReportCardSkeleton } from '@/components/ui/skeletons'

import type { Report } from '@/lib/schemas'

// HELPER FUNCTIONS (Moved from Reportes.tsx)
const getStatusColor = (status: Report['status']) => {
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

const STATUS_LABELS: Record<Report['status'], string> = {
    'pendiente': 'Buscando',
    'en_proceso': 'En Proceso',
    'resuelto': 'Recuperado',
    'cerrado': 'Expirado'
}

const getStatusLabel = (status: Report['status']) => STATUS_LABELS[status] || status

const CATEGORY_COLORS: Record<string, string> = {
    'Robo de Bicicleta': 'bg-red-500',
    'Robo de Vehículo': 'bg-orange-500',
    'Robo de Objetos Personales': 'bg-purple-500',
    'Pérdida de Objetos': 'bg-blue-500',
    'Encontrado': 'bg-green-500',
    'Otros': 'bg-gray-500'
}

const getCategoryColor = (category: string) => CATEGORY_COLORS[category] || 'bg-gray-500'

const formatDate = (dateString: string) => {
    try {
        const date = new Date(dateString)
        return date.toLocaleDateString('es-AR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        })
    } catch (e) { return '' }
}

interface ReportCardProps {
    reportId: string
    onToggleFavorite: (newState: boolean) => void
    onFlag: (e: React.MouseEvent) => void
    isFlagging?: boolean
}

/**
 * Smart Report Component
 * Fetches its own data using useReport(id)
 * Implements SSOT: Changes here reflect everywhere
 */
export function ReportCard({ reportId, onToggleFavorite, onFlag, isFlagging = false }: ReportCardProps) {
    // SUBSCRIBED TO SSOT
    const { data: report, isLoading } = useReport(reportId)

    // Derived state
    const currentAnonymousId = getAnonymousIdSafe()
    const isOwner = report?.anonymous_id === currentAnonymousId
    const isFlagged = report?.is_flagged ?? false

    if (isLoading) return <ReportCardSkeleton /> // Or a minimal placeholder
    if (!report) return null // Should not happen if ID is valid

    return (
        <SmartLink
            to={`/reporte/${report.id}`}
            prefetchReportId={report.id}
            prefetchRoute="DetalleReporte"
            className="block h-full no-underline"
        >
            <AnimatedCard className="h-full">
                <Card className={`group bg-card border-border hover:border-neon-green/50 transition-all duration-300 h-full flex flex-col overflow-hidden relative shadow-lg ${report.priority_zone ? 'ring-1 ring-neon-green/40 border-neon-green/40' : ''}`}>

                    {/* PRIORITY BADGE */}
                    {report.priority_zone && (
                        <div className={`absolute top-0 right-0 px-3 py-1 rounded-bl-xl z-10 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider shadow-lg ${report.priority_zone === 'home' ? 'bg-emerald-500 text-white' :
                            report.priority_zone === 'work' ? 'bg-blue-500 text-white' :
                                'bg-amber-500 text-white'
                            }`}>
                            {report.priority_zone === 'home' && <Home className="w-3 h-3" />}
                            {report.priority_zone === 'work' && <Briefcase className="w-3 h-3" />}
                            {report.priority_zone === 'frequent' && <MapPin className="w-3 h-3" />}
                            {report.priority_zone === 'home' ? 'Tu Casa' : report.priority_zone === 'work' ? 'Tu Trabajo' : 'Tu Zona'}
                        </div>
                    )}

                    {/* IMAGE / MAP */}
                    <div className="relative aspect-video w-full overflow-hidden bg-muted/50">
                        {Array.isArray(report.image_urls) && report.image_urls.length > 0 ? (
                            <div className="relative overflow-hidden w-full h-full">
                                <OptimizedImage
                                    src={report.image_urls[0]}
                                    alt={report.title}
                                    aspectRatio={16 / 9}
                                    priority={false}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute top-2 right-2 flex gap-2 z-10">
                                    <Badge className={getStatusColor(report.status)}>
                                        {getStatusLabel(report.status)}
                                    </Badge>
                                </div>
                            </div>
                        ) : (
                            <ReportMapFallback
                                lat={report.latitude ?? undefined}
                                lng={report.longitude ?? undefined}
                            />

                        )}
                    </div>

                    {/* CONTENT */}
                    <CardContent className="p-6 flex-1 flex flex-col">
                        <div className="flex items-start justify-between mb-2">
                            <h3 className="text-lg font-semibold text-foreground line-clamp-2 flex-1">
                                {report.title}
                            </h3>
                            {(!Array.isArray(report.image_urls) || report.image_urls.length === 0) && (
                                <Badge className={`ml-2 ${getStatusColor(report.status)}`}>
                                    {getStatusLabel(report.status)}
                                </Badge>
                            )}
                        </div>

                        <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                            <div className={`w-3 h-3 rounded-full ${getCategoryColor(report.category)}`} />
                            <span>{report.category}</span>
                        </div>

                        <p className="text-foreground/70 text-sm mb-4 line-clamp-3">
                            {report.description}
                        </p>

                        <div className="flex items-center text-sm text-foreground/60 mb-4 mt-auto">
                            <MapPin className="h-4 w-4 mr-1 text-neon-green" />
                            <span className="truncate">{report.address || report.zone || 'Ubicación no especificada'}</span>
                        </div>

                        {/*  FOOTER META */}
                        <div className="flex items-center justify-between text-sm text-foreground/60 mb-4">
                            <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6 border border-white/10 shrink-0">
                                    <AvatarImage
                                        src={report.avatar_url || getAvatarUrl(report.anonymous_id)}
                                        alt="Avatar"
                                    />
                                    <AvatarFallback className="bg-muted text-[10px] text-muted-foreground">
                                        {report.anonymous_id.substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                    {report.alias && (
                                        <span className="text-xs font-medium text-neon-green truncate max-w-[100px]">@{report.alias}</span>
                                    )}
                                    <span className="text-xs text-foreground/60">{formatDate(report.created_at)}</span>
                                </div>
                            </div>
                            <div className="flex items-center space-x-4">
                                <div className="flex items-center gap-1" title="Hilos">
                                    <GitBranch className="h-4 w-4" />
                                    <span>{report.threads_count ?? 0}</span>
                                </div>
                                <div className="flex items-center gap-1" title="Comentarios">
                                    <MessageCircle className="h-4 w-4" />
                                    <span>{report.comments_count}</span>
                                </div>
                            </div>
                        </div>

                        {/* ACTIONS */}
                        <div className="flex items-center justify-between pt-4 border-t border-border mt-auto">
                            <span className="text-neon-green font-medium text-sm">Ver Detalles →</span>
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
                                                e.preventDefault();
                                                onFlag(e);
                                            }}
                                            disabled={isFlagging}
                                            className="hover:text-yellow-400"
                                            title={isFlagging ? 'Reportando...' : 'Reportar contenido inapropiado'}
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
                        </div>
                    </CardContent>
                </Card>
            </AnimatedCard>
        </SmartLink>
    )
}
