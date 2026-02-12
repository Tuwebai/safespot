import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar"
import { MapPin, Home, Briefcase, GitBranch, MessageCircle, Flag } from 'lucide-react'
import { OptimizedImage } from '@/components/OptimizedImage'
import { LazyReportMapFallback as ReportMapFallback } from '@/components/ui/LazyReportMapFallback'
import { FavoriteButton } from '@/components/FavoriteButton'
import { LikeButton } from '@/components/LikeButton' // Added LikeButton import
import { AnimatedCard } from '@/components/ui/animated'
import { SmartLink } from '@/components/SmartLink'
import { VerifiedBadge } from '@/components/ui/VerifiedBadge'
import { useReport } from '@/hooks/queries/useReportsQuery'
import { useIsOwner } from '@/hooks/useIsOwner' // Use the hook instead of helper
import { StatusBadge } from '@/components/ui/StatusBadge'

const CATEGORY_COLORS: Record<string, string> = {
    'Robo de Bicicleta': 'bg-red-500',
    'Robo de Vehículo': 'bg-orange-500',
    'Robo de Objetos Personales': 'bg-purple-500',
    'Pérdida de Objetos': 'bg-blue-500',
    'Encontrado': 'bg-green-500',
    'Otros': 'bg-gray-500'
}

const getCategoryColor = (category: string) => CATEGORY_COLORS[category] || 'bg-gray-500'

interface ReportCardProps {
    reportId: string
    onToggleFavorite: (newState: boolean) => void
    onFlag: (e: React.MouseEvent) => void
    isFlagging?: boolean
}

import { normalizeReportForUI } from '@/lib/normalizeReport'

// ... types ...

/**
 * Smart Report Component
 * Fetches its own data using useReport(id)
 * Implements SSOT: Changes here reflect everywhere
 */
export function ReportCard({ reportId, onToggleFavorite, onFlag, isFlagging = false }: ReportCardProps) {
    // SUBSCRIBED TO SSOT
    const { data: rawReport } = useReport(reportId)
    // ✅ UI Normalization Layer (Fixes type errors)
    const report = rawReport ? normalizeReportForUI(rawReport) : undefined

    // Derived state (SSOT Driven)
    const isReportOwner = useIsOwner(report?.author.id)
    const isFlagged = report?.is_flagged ?? false

    // 🚨 ENTERPRISE ASSERTION: Detect SSOT violations
    // If reportId is in the list, the entity MUST be in cache
    // This is guaranteed by useReportsQuery.select calling reportsCache.store()
    if (!report) {
        // ... err log ...
        return null
    }

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
                        <div className={`absolute top-0 right-0 px-2 sm:px-3 py-1 rounded-bl-xl z-10 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider shadow-lg max-w-[120px] truncate ${report.priority_zone === 'home' ? 'bg-emerald-500 text-white' :
                            report.priority_zone === 'work' ? 'bg-blue-500 text-white' :
                                'bg-amber-500 text-white'
                            }`}>
                            {report.priority_zone === 'home' && <Home className="w-3 h-3 flex-shrink-0" />}
                            {report.priority_zone === 'work' && <Briefcase className="w-3 h-3 flex-shrink-0" />}
                            {report.priority_zone === 'frequent' && <MapPin className="w-3 h-3 flex-shrink-0" />}
                            <span className="truncate">{report.priority_zone === 'home' ? 'Tu Casa' : report.priority_zone === 'work' ? 'Tu Trabajo' : 'Tu Zona'}</span>
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
                                    <StatusBadge status={report.status} />
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
                    <CardContent className="p-4 sm:p-6 flex-1 flex flex-col">
                        <div className="flex items-start justify-between mb-2">
                            <h3 
                                className="text-base sm:text-lg font-semibold text-foreground line-clamp-2 flex-1" 
                                title={report.title}
                            >
                                {report.title}
                            </h3>
                            {(!Array.isArray(report.image_urls) || report.image_urls.length === 0) && (
                                <StatusBadge status={report.status} className="ml-2" />
                            )}
                        </div>

                        <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                            <div className={`w-3 h-3 rounded-full ${getCategoryColor(report.category)}`} />
                            <span>{report.category}</span>
                        </div>

                        <p 
                            className="text-foreground/70 text-sm mb-4 line-clamp-3"
                            title={report.description}
                        >
                            {report.description}
                        </p>

                        <div className="flex items-center text-sm text-muted-foreground mb-4 mt-auto">
                            <MapPin className="h-4 w-4 mr-1 text-neon-green" />
                            {/* ✅ Enterpise Fix: Use normalized address */}
                            <span className="truncate" title={report.fullAddress}>{report.fullAddress}</span>
                        </div>

                        {/*  FOOTER META */}
                        <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                            <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6 border border-white/10 shrink-0">
                                    <AvatarImage
                                        src={report.author.avatarUrl}
                                        alt="Avatar"
                                    />
                                    <AvatarFallback className="bg-muted text-[10px] text-muted-foreground">
                                        {report.avatarFallback}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col">
                                    <span className="text-xs font-medium text-neon-green break-words whitespace-normal flex items-center gap-1">
                                        {report.displayAuthor || 'Sin Alias'}
                                        {report.isOfficial && <VerifiedBadge size={14} />}
                                    </span>
                                    <span className="text-xs text-muted-foreground">{report.formattedDate}</span>
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
                            <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                                <LikeButton
                                    reportId={report.id}
                                    isLiked={report.is_liked}
                                    upvotesCount={report.upvotes_count}
                                />
                                <FavoriteButton
                                    reportId={report.id}
                                    isFavorite={report.is_favorite ?? false}
                                    onToggle={onToggleFavorite}
                                />

                                {!isReportOwner && (
                                    isFlagged ? (
                                        <span className="text-xs text-muted-foreground" title="Ya has denunciado este reporte">
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
