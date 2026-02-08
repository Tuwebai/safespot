import { useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { generateReportStructuredData } from '@/lib/seo'
import { normalizeReportForUI } from '@/lib/normalizeReport'
import type { Report } from '@/lib/schemas'
import { SEO } from '@/components/SEO'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ReportCardSkeleton as ReportSkeleton } from '@/components/ui/skeletons'
import { 
  ArrowLeft, 
  MapPin, 
  MessageSquare, 
  ShieldAlert, 
  Calendar, 
  ThumbsUp, 
  GitBranch, 
  MessageCircle,
  ExternalLink,
  Award
} from 'lucide-react'
import { ShareButton } from '@/components/ShareButton'
import { useCreateChatMutation } from '@/hooks/queries/useChatsQuery'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

// Hooks
import { useReportDetail } from '@/hooks/useReportDetail'
import { useReportEditor } from '@/hooks/useReportEditor'
import { useFlagManager } from '@/hooks/useFlagManager'
import { useRealtimeComments } from '@/hooks/useRealtimeComments'
import { useReportDeletionListener } from '@/hooks/useReportDeletionListener'
import { useHighlightContext } from '@/hooks/useHighlightContext'
import { useIsOwner } from '@/hooks/useIsOwner'

// Components
import {
  ReportHeader,
  ReportActions,
  ReportDescription,
  CommentsSection,
  DeleteReportDialog,
  FlagReportDialog,
} from '@/components/report-detail'
import { RelatedReports } from '@/components/report-detail/RelatedReports'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { STATUS_OPTIONS } from '@/lib/constants'
import { formatReportDate } from '@/lib/dateUtils'

// ============================================
// HELPERS
// ============================================

function normalizeImageUrls(imageUrls: unknown): string[] {
  if (!imageUrls) return []

  if (Array.isArray(imageUrls)) {
    return imageUrls.filter((url): url is string =>
      typeof url === 'string' && url.length > 0
    )
  }

  if (typeof imageUrls === 'string') {
    try {
      const parsed = JSON.parse(imageUrls)
      if (Array.isArray(parsed)) {
        return parsed.filter((url: unknown): url is string =>
          typeof url === 'string' && url.length > 0
        )
      }
    } catch {
      return []
    }
  }

  return []
}

// ============================================
// COMPONENT
// ============================================

export function DetalleReporte() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  // Main hooks
  const reportDetail = useReportDetail({ reportId: id })
  const { report: initialReport, updateReport, markAsDeleted } = reportDetail

  const editor = useReportEditor({
    report: initialReport,
    onReportUpdate: (updated: Report) => updateReport(normalizeReportForUI(updated)),
  })

  const flagManager = useFlagManager({
    reportId: id,
    onBeforeDelete: () => {
      markAsDeleted()
    },
    onReportFlagged: () => {
      if (initialReport) {
        updateReport({ ...initialReport, is_flagged: true })
      }
    },
    onReportDeleted: () => {
      navigate('/reportes')
    },
  })

  // REALTIME: Subscribe to instant comment updates via SSE
  useRealtimeComments(id)

  // ✅ ENTERPRISE FIX: Identity check must come before reactive listeners
  const isOwner = useIsOwner(initialReport?.author?.id);

  // REALTIME: Listen for report deletion to redirect
  useReportDeletionListener(id, isOwner)

  // HIGHLIGHT: Auto-scroll to comment if param exists
  useHighlightContext({
    paramName: 'highlight_comment',
    selectorPrefix: 'comment-',
    delay: 1000
  })

  const createChatMutation = useCreateChatMutation();

  const report = initialReport
  const imageUrls = report ? normalizeImageUrls(report.image_urls) : []

  const handleCreateChat = async () => {
    try {
      if (report?.id) {
        await createChatMutation.mutateAsync({ reportId: report.id });
        navigate('/mensajes');
      }
    } catch (err) {
      console.error('Error creating chat:', err);
    }
  };

  // Handler for favorite toggle - MUST be before any returns (Rules of Hooks)
  const handleFavoriteToggle = useCallback((newState: boolean) => {
    if (initialReport) {
      updateReport({ ...initialReport, is_favorite: newState })
    }
  }, [initialReport, updateReport])

  // Derived state - safe to compute before returns
  const isBusy =
    editor.updating ||
    flagManager.deletingReport ||
    flagManager.flaggingReport

  // CONDITIONAL RETURNS (after all hooks)
  if (reportDetail.isDeleted) {
    return null
  }

  // LOADING STATE
  if (reportDetail.loading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <SEO title="Cargando reporte..." />
        <ReportSkeleton />
      </div>
    )
  }

  // ERROR STATE
  if (reportDetail.error || !report) {
    return (
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <SEO title="Reporte no encontrado" />
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{reportDetail.error || 'Reporte no encontrado'}</p>
            <Button variant="outline" onClick={() => navigate('/')} className="mt-4">
              Volver al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // MAIN RENDER
  const category = report.category
  const zone = report.fullAddress
  const statusLabel = STATUS_OPTIONS.find(opt => opt.value === report.status)?.label || report.status
  const formattedDate = new Date(report.created_at).toLocaleDateString()

  const structuredData = generateReportStructuredData({
    id: report.id,
    title: report.title,
    description: report.description,
    category: report.category,
    created_at: report.created_at,
    updated_at: report.updated_at,
    image_urls: imageUrls,
    latitude: report.latitude ?? undefined,
    longitude: report.longitude ?? undefined,
    locality: report.locality ?? undefined,
    zone: report.zone ?? undefined,
    province: report.province ?? undefined,
    address: report.fullAddress
  })

  // Status color helper
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
      case 'resolved': return 'bg-green-500/10 text-green-500 border-green-500/20'
      case 'archived': return 'bg-gray-500/10 text-gray-500 border-gray-500/20'
      case 'hidden': return 'bg-red-500/10 text-red-500 border-red-500/20'
      default: return 'bg-neon-green/10 text-neon-green border-neon-green/20'
    }
  }

  return (
    <ErrorBoundary
      fallbackTitle="Error en el detalle del reporte"
      onReset={() => reportDetail.refetch()}
    >
      <SEO
        title={`Robo de ${category} en ${zone}`}
        description={`Reporte de ${category} en ${zone}. Estado: ${statusLabel}. Publicado el ${formattedDate}.`}
        url={`https://safespot.tuweb-ai.com/reporte/${report.id}`}
        image={imageUrls.length > 0 ? imageUrls[0] : undefined}
        type="article"
        author="SafeSpot Community"
        structuredData={structuredData}
      />

      <div className="bg-background pb-24 md:pb-8">
        <div className="container mx-auto max-w-6xl px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
          
          {/* TOP NAVIGATION */}
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="text-foreground/60 hover:text-foreground hover:bg-border/30 -ml-2"
              disabled={isBusy}
            >
              <ArrowLeft className="mr-1 sm:mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Volver</span>
            </Button>

            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                variant="ghost"
                size="icon"
                title="Ver en el mapa"
                onClick={() => navigate(`/explorar?reportId=${report.id}`, {
                  state: {
                    focusReportId: report.id,
                    lat: report.latitude,
                    lng: report.longitude,
                    report: report
                  }
                })}
                disabled={isBusy}
                className="text-foreground/60 hover:text-neon-green hover:bg-neon-green/10 h-9 w-9"
              >
                <MapPin className="h-5 w-5" />
              </Button>

              <ReportActions
                report={report}
                isFavorite={reportDetail.isFavorite}
                isEditing={editor.isEditing}
                updating={editor.updating}
                disabled={isBusy}
                onFavoriteToggle={handleFavoriteToggle}
                onStartEdit={editor.startEditing}
                onSaveEdit={editor.saveChanges}
                onCancelEdit={editor.cancelEditing}
                onFlag={flagManager.openFlagDialog}
                onDelete={flagManager.openDeleteDialog}
              />
            </div>
          </div>

          {/* MODERATION NOTICE */}
          {report.is_hidden && isOwner && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 sm:p-4 flex items-start gap-2 sm:gap-3 animate-in fade-in slide-in-from-top-2 duration-500 mb-4">
              <ShieldAlert className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
              <div>
                <h4 className="font-semibold text-red-500 text-sm">Este reporte está oculto a la comunidad</h4>
                <p className="text-xs text-red-400/90 mt-1 leading-relaxed">
                  Nuestro sistema de confianza ha limitado la visibilidad. Revisa tu{' '}
                  <button onClick={() => navigate('/perfil')} className="underline hover:text-red-300 font-medium cursor-pointer">Historial de Transparencia</button>.
                </p>
              </div>
            </div>
          )}

          {/* MAIN CONTENT - 2 COLUMNS */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            
            {/* LEFT COLUMN (70%) - Main Content */}
            <div className="lg:col-span-2 space-y-4 sm:space-y-6">
              
              {/* HEADER: Title + Status + Author */}
              {!editor.isEditing && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-start gap-2">
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground leading-tight break-words flex-1">
                      {report.title}
                    </h1>
                    <Badge className={`${getStatusColor(report.status)} shrink-0 mt-1`}>
                      {statusLabel}
                    </Badge>
                  </div>

                  {/* Author Row */}
                  <div className="flex items-center gap-2 text-sm">
                    <Avatar className="h-6 w-6 border border-white/10">
                      <AvatarImage src={report.author?.avatarUrl} />
                      <AvatarFallback className="bg-muted text-[10px]">
                        {report.author?.alias?.[0] || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-neon-green font-medium">
                      @{report.author?.alias || 'Anónimo'}
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground text-xs">
                      {formatDistanceToNow(new Date(report.created_at), { addSuffix: true, locale: es })}
                    </span>
                  </div>
                </div>
              )}

              {/* Show ReportHeader component when editing */}
              {editor.isEditing && <ReportHeader report={report} />}

              {/* IMAGES - Carrusel Compact */}
              {imageUrls.length > 0 && (
                <div className="rounded-xl overflow-hidden border border-border">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {imageUrls.slice(0, 4).map((url, idx) => (
                      <div key={idx} className={`relative ${idx === 0 && imageUrls.length === 1 ? 'col-span-full' : ''}`}>
                        <img 
                          src={url} 
                          alt={`Imagen ${idx + 1}`}
                          className="w-full h-48 sm:h-64 object-cover"
                        />
                        {idx === 3 && imageUrls.length > 4 && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="text-white font-bold text-lg">+{imageUrls.length - 4}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DESCRIPTION */}
              <ReportDescription report={report} editor={editor} />

              {/* DESKTOP: Contact Author CTA */}
              {!editor.isEditing && !isOwner && (
                <Button
                  onClick={handleCreateChat}
                  disabled={createChatMutation.isPending}
                  className="hidden lg:flex w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl py-4 h-auto items-center justify-center gap-2"
                >
                  <MessageSquare className="h-5 w-5" />
                  <span className="font-semibold">Contactar con el Autor</span>
                </Button>
              )}

              {/* COMMENTS PREVIEW */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    Comentarios
                    <span className="text-sm text-muted-foreground">({initialReport?.comments_count || 0})</span>
                  </h3>
                </div>
                
                <CommentsSection
                  reportId={id!}
                  totalCount={initialReport?.comments_count || 0}
                  reportOwnerId={initialReport?.author?.id}
                  reportOwnerAlias={initialReport?.author?.alias || undefined}
                  reportOwnerAvatar={initialReport?.author?.avatarUrl || undefined}
                />
              </div>

              {/* MOBILE: Related Reports at bottom of left column */}
              <div className="lg:hidden">
                <RelatedReports reportId={id!} />
              </div>
            </div>

            {/* RIGHT COLUMN (30%) - Sidebar Context */}
            <div className="space-y-4 sm:space-y-6">
              
              {/* RESUMEN COMPACT */}
              <Card className="bg-card border-border">
                <CardContent className="p-4 space-y-4">
                  <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Resumen</h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <Calendar className="h-4 w-4 text-neon-green shrink-0" />
                      <span className="text-muted-foreground">Fecha:</span>
                      <span className="font-medium ml-auto">{formatReportDate(report.incident_date || report.created_at)}</span>
                    </div>
                    
                    <div className="flex items-center gap-3 text-sm">
                      <ThumbsUp className="h-4 w-4 text-sky-400 shrink-0" />
                      <span className="text-muted-foreground">Likes:</span>
                      <span className="font-medium ml-auto">{report.upvotes_count ?? 0}</span>
                    </div>
                    
                    <div className="flex items-center gap-3 text-sm">
                      <GitBranch className="h-4 w-4 text-blue-400 shrink-0" />
                      <span className="text-muted-foreground">Hilos:</span>
                      <span className="font-medium ml-auto">{report.threads_count ?? 0}</span>
                    </div>
                    
                    <div className="flex items-center gap-3 text-sm">
                      <MessageCircle className="h-4 w-4 text-green-400 shrink-0" />
                      <span className="text-muted-foreground">Comentarios:</span>
                      <span className="font-medium ml-auto">{initialReport?.comments_count || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* LOCATION - Mini Map */}
              <Card className="bg-card border-border overflow-hidden">
                <CardContent className="p-0">
                  <div className="h-32 bg-muted relative">
                    {report.latitude && report.longitude ? (
                      <img 
                        src={`https://static-maps.yandex.ru/1.x/?ll=${report.longitude},${report.latitude}&z=15&l=map&size=300,150&pt=${report.longitude},${report.latitude},pm2rdm`}
                        alt="Mapa"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <MapPin className="h-8 w-8 opacity-20" />
                      </div>
                    )}
                  </div>
                  <div className="p-3 space-y-1">
                    <p className="text-sm font-medium line-clamp-2">{report.fullAddress}</p>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full h-8 text-xs text-neon-green hover:text-neon-green hover:bg-neon-green/10"
                      onClick={() => navigate(`/explorar?reportId=${report.id}`, {
                        state: { focusReportId: report.id, lat: report.latitude, lng: report.longitude, report }
                      })}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Abrir en Maps
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* AUTHOR CARD */}
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">Autor</h3>
                  
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border-2 border-neon-green/30">
                      <AvatarImage src={report.author?.avatarUrl} />
                      <AvatarFallback className="bg-muted text-lg">
                        {report.author?.alias?.[0] || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-neon-green truncate">@{report.author?.alias || 'Anónimo'}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Award className="h-3 w-3" />
                        <span>Nivel 1</span>
                      </div>
                    </div>
                  </div>

                  {!isOwner && (
                    <Button
                      onClick={handleCreateChat}
                      disabled={createChatMutation.isPending}
                      className="w-full mt-3 bg-neon-green/10 hover:bg-neon-green/20 text-neon-green border border-neon-green/20"
                      size="sm"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Mensaje privado
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* DESKTOP: Related Reports */}
              <div className="hidden lg:block">
                <RelatedReports reportId={id!} />
              </div>
            </div>
          </div>
        </div>

        {/* STICKY MOBILE FOOTER */}
        {!editor.isEditing && (
          <div className="fixed bottom-0 left-0 right-0 z-50 p-3 md:hidden bg-background border-t border-border">
            <div className="flex items-center gap-2">
              {!isOwner && (
                <Button
                  onClick={handleCreateChat}
                  disabled={createChatMutation.isPending}
                  className="flex-1 bg-neon-green text-dark-bg hover:bg-neon-green/90 font-semibold h-11"
                >
                  <MessageSquare className="h-5 w-5 mr-2" />
                  Contactar
                </Button>
              )}
              <div className="flex-1">
                <ShareButton
                  category={report.category}
                  zone={report.address || report.zone || 'Ubicación desconocida'}
                  reportId={report.id}
                  variant="prominent"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <DeleteReportDialog
        isOpen={flagManager.isDeleteDialogOpen}
        deleting={flagManager.deletingReport}
        onConfirm={flagManager.deleteReport}
        onCancel={flagManager.closeDialog}
      />

      <FlagReportDialog
        isOpen={flagManager.isFlagDialogOpen}
        flagging={flagManager.flaggingReport}
        onSubmit={flagManager.flagReport}
        onCancel={flagManager.closeDialog}
      />
    </ErrorBoundary>
  )
}
