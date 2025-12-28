import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ReportSkeleton } from '@/components/ui/skeletons'
import { ArrowLeft } from 'lucide-react'

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
        return parsed.filter((url): url is string =>
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
    onReportFlagged: () => {
      if (reportDetail.report) {
        reportDetail.updateReport({ ...reportDetail.report, is_flagged: true })
      }
    },
    onReportDeleted: () => navigate('/'),
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

  // ============================================
  // LOADING STATE
  // ============================================

  if (reportDetail.loading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <ReportSkeleton />
      </div>
    )
  }

  // ============================================
  // ERROR STATE
  // ============================================

  if (reportDetail.error || !reportDetail.report) {
    return (
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
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

  const { report } = reportDetail
  const imageUrls = normalizeImageUrls(report.image_urls)

  // ============================================
  // MAIN RENDER
  // ============================================

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        className="mb-6"
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
          <ReportActions
            report={report}
            isFavorite={reportDetail.isFavorite}
            savingFavorite={reportDetail.savingFavorite}
            isEditing={editor.isEditing}
            updating={editor.updating}
            onFavorite={reportDetail.toggleFavorite}
            onStartEdit={editor.startEditing}
            onSaveEdit={editor.saveChanges}
            onCancelEdit={editor.cancelEditing}
            onFlag={flagManager.openFlagDialog}
            onDelete={flagManager.openDeleteDialog}
          />
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
  )
}
