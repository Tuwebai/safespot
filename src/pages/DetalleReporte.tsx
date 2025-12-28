import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ReportSkeleton } from '@/components/ui/skeletons'
import { ArrowLeft, MapPin } from 'lucide-react'

// Hooks
import { useReportDetail } from '@/hooks/useReportDetail'
import { useReportEditor } from '@/hooks/useReportEditor'
import { useFlagManager } from '@/hooks/useFlagManager'

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
        return parsed.filter((url: any): url is string =>
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

  const editor = useReportEditor({
    report: reportDetail.report,
    onReportUpdate: reportDetail.updateReport,
  })

  const flagManager = useFlagManager({
    reportId: id,
    onBeforeDelete: () => {
      // Mark as deleted BEFORE the API call to prevent any refetch attempts
      reportDetail.markAsDeleted()
    },
    onReportFlagged: () => {
      if (reportDetail.report) {
        reportDetail.updateReport({ ...reportDetail.report, is_flagged: true })
      }
    },
    onReportDeleted: () => {
      navigate('/')
    },
  })

  // Local comments count for optimistic updates
  const [commentsCount, setCommentsCount] = useState(0)

  // Sync comments count with report
  useEffect(() => {
    if (reportDetail.report) {
      setCommentsCount(reportDetail.report.comments_count)
    }
  }, [reportDetail.report])

  // Handler for comment count changes
  const handleCommentCountChange = useCallback((delta: number) => {
    setCommentsCount(prev => Math.max(0, prev + delta))
  }, [])

  // Handler for favorite toggle - MUST be before any returns (Rules of Hooks)
  const handleFavoriteToggle = useCallback((newState: boolean) => {
    if (reportDetail.report) {
      reportDetail.updateReport({ ...reportDetail.report, is_favorite: newState })
    }
  }, [reportDetail.report, reportDetail.updateReport])

  // Derived state - safe to compute before returns
  const isBusy =
    editor.updating ||
    flagManager.deletingReport ||
    flagManager.flaggingReport

  const report = reportDetail.report
  const imageUrls = report ? normalizeImageUrls(report.image_urls) : []

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
        <Helmet>
          <title>Cargando reporte... – SafeSpot</title>
        </Helmet>
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
        <Helmet>
          <title>Reporte no encontrado – SafeSpot</title>
        </Helmet>
        <Card className="bg-dark-card border-dark-border">
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

  // Metadata for SEO
  const pageTitle = `${report.category} en ${report.zone} – SafeSpot`
  const statusLabel = STATUS_OPTIONS.find(opt => opt.value === report.status)?.label || report.status
  const formattedDate = new Date(report.created_at).toLocaleDateString()
  const pageDescription = `Reporte de ${report.category} en ${report.zone}. Estado: ${statusLabel}. Publicado el ${formattedDate}.`
  const metaImageUrl = imageUrls.length > 0 ? imageUrls[0] : '/favicon.svg'
  const currentUrl = window.location.href

  return (
    <ErrorBoundary
      fallbackTitle="Error en el detalle del reporte"
      onReset={() => reportDetail.refetch()}
    >
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="article" />
        <meta property="og:url" content={currentUrl} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:image" content={metaImageUrl} />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content={currentUrl} />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={metaImageUrl} />
      </Helmet>

      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
          disabled={isBusy}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Button>

        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            {/* Left: Title, Status, Zone (or Edit Form) */}
            {!editor.isEditing && <ReportHeader report={report} />}

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                title="Ver en el mapa"
                onClick={() => navigate(`/explorar?reportId=${report.id}`, {
                  state: {
                    focusReportId: report.id,
                    lat: report.latitude,
                    lng: report.longitude
                  }
                })}
                disabled={isBusy}
              >
                <MapPin className="h-4 w-4" />
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
        </div>

        {/* Description Card (includes edit form when editing) */}
        <ReportDescription report={report} editor={editor} />

        {/* Images Card */}
        <ReportImages imageUrls={imageUrls} />

        {/* Stats Grid */}
        <ReportMeta report={report} commentsCount={commentsCount} />

        {/* Comments Section */}
        <CommentsSection
          reportId={id!}
          totalCount={commentsCount}
          onCommentCountChange={handleCommentCountChange}
        />

        {/* Delete Dialog */}
        <DeleteReportDialog
          isOpen={flagManager.isDeleteDialogOpen}
          deleting={flagManager.deletingReport}
          onConfirm={flagManager.deleteReport}
          onCancel={flagManager.closeDialog}
        />

        {/* Flag Dialog */}
        <FlagReportDialog
          isOpen={flagManager.isFlagDialogOpen}
          flagging={flagManager.flaggingReport}
          onSubmit={flagManager.flagReport}
          onCancel={flagManager.closeDialog}
        />
      </div>
    </ErrorBoundary>
  )
}
