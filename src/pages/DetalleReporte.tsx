import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { generateSEOTags, generateReportStructuredData } from '@/lib/seo'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ReportSkeleton } from '@/components/ui/skeletons'
import { ArrowLeft, MapPin } from 'lucide-react'
import { ShareButton } from '@/components/ShareButton'

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
    onReportUpdate: updateReport,
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

  // Local comments count for optimistic updates
  const [commentsCount, setCommentsCount] = useState(0)

  // Sync comments count with report
  useEffect(() => {
    if (initialReport) {
      setCommentsCount(initialReport.comments_count)
    }
  }, [initialReport])

  // Handler for comment count changes
  const handleCommentCountChange = useCallback((delta: number) => {
    setCommentsCount(prev => Math.max(0, prev + delta))
  }, [])

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

  const report = initialReport
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

  // Extract data for SEO
  const category = report.category
  const zone = report.address || report.zone
  const statusLabel = STATUS_OPTIONS.find(opt => opt.value === report.status)?.label || report.status
  const formattedDate = new Date(report.created_at).toLocaleDateString()

  // SEO Configuration
  const seo = generateSEOTags({
    title: `${category} en ${zone}`,
    description: `Reporte de ${category} en ${zone}. Estado: ${statusLabel}. Publicado el ${formattedDate}.`,
    canonical: `https://safespot.netlify.app/reporte/${report.id}`,
    image: imageUrls.length > 0 ? imageUrls[0] : undefined,
    imageAlt: `Imagen del reporte: ${report.title}`,
    type: 'article',
    publishedTime: report.created_at,
    modifiedTime: report.updated_at,
    author: 'SafeSpot Community',
    section: category,
    tags: [category, zone, report.status]
  })

  // JSON-LD Structured Data
  const structuredData = generateReportStructuredData({
    id: report.id,
    title: report.title,
    description: report.description,
    category: report.category,
    created_at: report.created_at,
    updated_at: report.updated_at,
    image_urls: imageUrls,
    latitude: report.latitude,
    longitude: report.longitude,
    locality: report.locality,
    zone: report.zone,
    province: report.province
  })

  return (
    <ErrorBoundary
      fallbackTitle="Error en el detalle del reporte"
      onReset={() => reportDetail.refetch()}
    >
      <Helmet>
        <title>{seo.title}</title>
        <meta name="description" content={seo.description} />
        <link rel="canonical" href={seo.canonical} />

        {/* Open Graph */}
        <meta property="og:type" content={seo.ogType} />
        <meta property="og:url" content={seo.ogUrl} />
        <meta property="og:title" content={seo.ogTitle} />
        <meta property="og:description" content={seo.ogDescription} />
        <meta property="og:image" content={seo.ogImage} />
        <meta property="og:image:width" content={seo.ogImageWidth} />
        <meta property="og:image:height" content={seo.ogImageHeight} />
        <meta property="og:image:alt" content={seo.ogImageAlt} />
        <meta property="og:site_name" content={seo.ogSiteName} />
        <meta property="og:locale" content={seo.ogLocale} />

        {/* Article-specific */}
        {seo.articlePublishedTime && <meta property="article:published_time" content={seo.articlePublishedTime} />}
        {seo.articleModifiedTime && <meta property="article:modified_time" content={seo.articleModifiedTime} />}
        {seo.articleAuthor && <meta property="article:author" content={seo.articleAuthor} />}
        {seo.articleSection && <meta property="article:section" content={seo.articleSection} />}
        {seo.articleTags && seo.articleTags.map((tag, i) => (
          <meta key={i} property="article:tag" content={tag} />
        ))}

        {/* Twitter */}
        <meta name="twitter:card" content={seo.twitterCard} />
        <meta name="twitter:title" content={seo.twitterTitle} />
        <meta name="twitter:description" content={seo.twitterDescription} />
        <meta name="twitter:image" content={seo.twitterImage} />
        <meta name="twitter:image:alt" content={seo.twitterImageAlt} />

        {/* JSON-LD Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
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
              <ShareButton
                category={report.category}
                zone={report.address || report.zone || 'Ubicación desconocida'}
                reportId={report.id}
              />
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
