import { useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
// import { Helmet } from 'react-helmet-async'
// import { generateSEOTags } from '@/lib/seo' 
import { generateReportStructuredData } from '@/lib/seo'
import { normalizeReportForUI } from '@/lib/normalizeReport'
import type { Report } from '@/lib/schemas'
import { SEO } from '@/components/SEO'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ReportCardSkeleton as ReportSkeleton } from '@/components/ui/skeletons'
import { ArrowLeft, MapPin, MessageSquare } from 'lucide-react'
import { ShareButton } from '@/components/ShareButton'
import { useCreateChatMutation } from '@/hooks/queries/useChatsQuery'

// Hooks
import { useReportDetail } from '@/hooks/useReportDetail'
import { useReportEditor } from '@/hooks/useReportEditor'
import { useFlagManager } from '@/hooks/useFlagManager'
import { useRealtimeComments } from '@/hooks/useRealtimeComments'
import { useReportDeletionListener } from '@/hooks/useReportDeletionListener'
import { useHighlightContext } from '@/hooks/useHighlightContext'
import { isOwner as isOwnerPermission } from '@/lib/permissions'

// Components
import {
  ReportHeader,
  ReportActions,
  ReportDescription,
  ReportImages,
  ReportMeta,
  CommentsSection,
  DeleteReportDialog,
  FlagReportDialog,
} from '@/components/report-detail'
import { RelatedReports } from '@/components/report-detail/RelatedReports'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { STATUS_OPTIONS } from '@/lib/constants'

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
      // Mark as deleted BEFORE the API call to prevent any refetch attempts
      markAsDeleted()
    },
    onReportFlagged: () => {
      if (initialReport) {
        updateReport({ ...initialReport, is_flagged: true })
      }
    },
    onReportDeleted: () => {
      navigate('/')
    },
  })

  // REALTIME: Subscribe to instant comment updates via SSE
  useRealtimeComments(id)

  // REALTIME: Listen for report deletion to redirect
  useReportDeletionListener(id)

  // HIGHLIGHT: Auto-scroll to comment if param exists
  useHighlightContext({
    paramName: 'highlight_comment',
    selectorPrefix: 'comment-',
    delay: 1000 // Wait a bit for comments to load
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

  // ✅ ENTERPRISE FIX #1: Use SSOT for identity via centralized permissions
  const isOwner = isOwnerPermission(report);



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


  // ============================================
  // CONDITIONAL RETURNS (after all hooks)
  // ============================================

  if (reportDetail.isDeleted) {
    return null // Component will unmount after navigation
  }

  // ============================================
  // LOADING STATE
  // ============================================

  if (reportDetail.loading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <SEO title="Cargando reporte..." />
        <ReportSkeleton />
      </div>
    )
  }

  // ============================================
  // ERROR STATE
  // ============================================

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

  // ============================================
  // MAIN RENDER
  // ============================================

  // Extract data for SEO
  const category = report.category
  const zone = report.address || report.zone
  const statusLabel = STATUS_OPTIONS.find(opt => opt.value === report.status)?.label || report.status
  const formattedDate = new Date(report.created_at).toLocaleDateString()



  // JSON-LD Structured Data
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
    province: report.province ?? undefined
  })

  return (
    <ErrorBoundary
      fallbackTitle="Error en el detalle del reporte"
      onReset={() => reportDetail.refetch()}
    >
      <SEO
        title={`${category} en ${zone}`}
        description={`Reporte de ${category} en ${zone}. Estado: ${statusLabel}. Publicado el ${formattedDate}.`}
        url={`https://safespot.tuweb-ai.com/reporte/${report.id}`}
        image={imageUrls.length > 0 ? imageUrls[0] : undefined}
        type="article"
        author="SafeSpot Community"
        structuredData={structuredData}
      />

      <div className="bg-background pb-24 md:pb-8">
        <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          {/* Top Navigation */}
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="text-foreground/60 hover:text-foreground hover:bg-border/30"
              disabled={isBusy}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                title="Ver en el mapa"
                onClick={() => navigate(`/explorar?reportId=${report.id}`, {
                  state: {
                    focusReportId: report.id,
                    lat: report.latitude,
                    lng: report.longitude,
                    report: report // Pass full report to ensure it renders on map
                  }
                })}
                disabled={isBusy}
                className="text-foreground/60 hover:text-neon-green hover:bg-neon-green/10"
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

          {/* Main Content Layout */}
          <div className="space-y-6">
            {/* 1. Header Section (Title, Badge, Location) */}
            {!editor.isEditing && <ReportHeader report={report} />}

            {/* 2. Description (includes edit form) */}
            <ReportDescription report={report} editor={editor} />

            {/* 3. Images Section */}
            <ReportImages
              imageUrls={imageUrls}
              lat={report.latitude ?? undefined}
              lng={report.longitude ?? undefined}
            />

            {/* 4. Stats Section */}
            <ReportMeta report={report} commentsCount={report.comments_count || 0} />

            {/* 5. Desktop Share CTA (Prominent) */}
            {!editor.isEditing && (
              <div className="hidden md:block py-4">
                <ShareButton
                  category={report.category}
                  zone={report.address || report.zone || 'Ubicación desconocida'}
                  reportId={report.id}
                  variant="prominent"
                />
              </div>
            )}

            {/* 6. Contact Author CTA (Contextual Messaging) */}
            {!editor.isEditing && !isOwner && (
              <Button
                onClick={handleCreateChat}
                disabled={createChatMutation.isPending}
                className="w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-2xl py-6 h-auto flex flex-col gap-1 shadow-sm"
              >
                <div className="flex items-center gap-2 font-bold text-base">
                  <MessageSquare className="h-5 w-5" />
                  Contactar con el Autor
                </div>
                <span className="text-[10px] opacity-70 font-normal">Inicia un chat privado sobre este incidente</span>
              </Button>
            )}

            {/* 7. Comments Section */}
            <CommentsSection
              reportId={id!}
              totalCount={initialReport?.comments_count || 0}
              reportOwnerId={initialReport?.anonymous_id}
              reportOwnerAlias={initialReport?.alias || undefined}
              reportOwnerAvatar={initialReport?.avatar_url || undefined}
            />

            {/* 7. Related Reports */}
            <RelatedReports reportId={id!} />
          </div>
        </div>

        {/* STICKY MOBILE SHARE CTA */}
        {!editor.isEditing && (
          <div className="fixed bottom-16 left-0 right-0 z-[45] p-4 md:hidden bg-gradient-to-t from-background via-background/95 to-transparent pt-8">
            <ShareButton
              category={report.category}
              zone={report.address || report.zone || 'Ubicación desconocida'}
              reportId={report.id}
              variant="prominent"
            />
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
