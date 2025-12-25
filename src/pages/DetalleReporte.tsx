import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { reportsApi, commentsApi } from '@/lib/api'
import { getAnonymousIdSafe } from '@/lib/identity'
import { useToast } from '@/components/ui/toast'
import { handleError, handleErrorWithMessage, handleErrorSilently } from '@/lib/errorHandler'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { STATUS_OPTIONS } from '@/lib/constants'
import { EnhancedComment } from '@/components/comments/enhanced-comment'
import { ThreadList } from '@/components/comments/thread-list'
import { 
  MapPin, 
  Calendar, 
  MessageCircle, 
  ArrowLeft, 
  Heart, 
  Flag, 
  Eye,
  Image as ImageIcon,
  Trash2,
  AlertTriangle,
  Edit,
  Save,
  X
} from 'lucide-react'
import type { Report, Comment } from '@/lib/api'

export function DetalleReporte() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const [report, setReport] = useState<Report | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentText, setCommentText] = useState('')
  const [isSaved, setIsSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submittingComment, setSubmittingComment] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'comments' | 'threads'>('comments')
  const [isFlagDialogOpen, setIsFlagDialogOpen] = useState(false)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [submittingReply, setSubmittingReply] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [submittingEdit, setSubmittingEdit] = useState(false)
  const [creatingThread, setCreatingThread] = useState(false)
  const [threadText, setThreadText] = useState('')
  const [submittingThread, setSubmittingThread] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [flaggingReport, setFlaggingReport] = useState(false)
  const [flaggingCommentId, setFlaggingCommentId] = useState<string | null>(null)
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editStatus, setEditStatus] = useState<Report['status']>('pendiente')
  const [updating, setUpdating] = useState(false)
  const [savingFavorite, setSavingFavorite] = useState(false)
  const [failedImageUrls, setFailedImageUrls] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (id) {
      loadReport()
      loadComments()
    }
  }, [id])

  useEffect(() => {
    if (report) {
      checkSaved()
      // Reset failed images when report changes
      setFailedImageUrls(new Set())
    }
  }, [report])

  const loadReport = async () => {
    if (!id) return
    
    try {
      setLoading(true)
      const data = await reportsApi.getById(id)
      setReport(data)
      setError(null)
      // Reset edit mode when loading a new report
      setIsEditing(false)
    } catch (error) {
      const errorInfo = handleError(error, toast.error, 'DetalleReporte.loadReport')
      setError(errorInfo.userMessage)
    } finally {
      setLoading(false)
    }
  }

  const loadComments = async () => {
    if (!id) return
    
    try {
      const data = await commentsApi.getByReportId(id)
      setComments(data)
    } catch (error) {
      // Show error to user but allow page to continue functioning
      handleError(error, toast.error, 'DetalleReporte.loadComments')
    }
  }

  const checkSaved = async () => {
    if (!id || !report) return
    
    try {
      // The is_favorite flag comes from the report data
      setIsSaved(report.is_favorite ?? false)
    } catch (error) {
      // Set default and log error (this is non-critical for page functionality)
      handleErrorSilently(error, 'DetalleReporte.checkSaved')
      setIsSaved(false)
    }
  }

  const handleSave = async () => {
    if (!id || savingFavorite) return
    
    try {
      setSavingFavorite(true)
      const result = await reportsApi.toggleFavorite(id)
      
      // Validate result structure - explicit contract validation
      if (!result || typeof result !== 'object' || typeof result.is_favorite !== 'boolean') {
        throw new Error('Respuesta inválida del servidor: is_favorite debe ser un booleano')
      }
      
      setIsSaved(result.is_favorite)
      // Update report state
      if (report) {
        setReport({ ...report, is_favorite: result.is_favorite })
      }
    } catch (error) {
      handleErrorWithMessage(error, 'Error al guardar en favoritos', toast.error, 'DetalleReporte.handleSave')
    } finally {
      setSavingFavorite(false)
    }
  }

  const handleFlag = () => {
    if (!report) return
    
    // Check if user is trying to flag their own report
    // This should be handled by backend, but we can prevent UI interaction
    setIsFlagDialogOpen(true)
  }

  const handleFlagSubmit = async (reason: string) => {
    if (!id || flaggingReport) return
    
    try {
      setFlaggingReport(true)
      await reportsApi.flag(id, reason)
      setIsFlagDialogOpen(false)
      
      // Update report state
      if (report) {
        setReport({ ...report, is_flagged: true })
      }
      
      // Show success message
      toast.success('Reporte denunciado correctamente. Gracias por ayudar a mantener la comunidad segura.')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : ''
      
      if (errorMessage.includes('own report')) {
        toast.warning('No puedes denunciar tu propio reporte')
      } else if (errorMessage.includes('already flagged')) {
        toast.warning('Ya has denunciado este reporte anteriormente')
      } else {
        handleErrorWithMessage(error, 'Error al denunciar el reporte', toast.error, 'DetalleReporte.handleFlagSubmit')
      }
    } finally {
      setFlaggingReport(false)
    }
  }

  const handleDeleteReport = async () => {
    if (!id) return
    
    try {
      setDeleting(true)
      await reportsApi.delete(id)
      toast.success('Reporte eliminado correctamente')
      // Navigate to home after successful deletion
      navigate('/')
    } catch (error) {
      handleErrorWithMessage(error, 'Error al eliminar el reporte', toast.error, 'DetalleReporte.handleDeleteReport')
    } finally {
      setDeleting(false)
      setIsDeleteDialogOpen(false)
    }
  }

  const handleStartEdit = () => {
    if (!report) return
    setEditTitle(report.title)
    setEditDescription(report.description)
    setEditStatus(report.status)
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditTitle('')
    setEditDescription('')
    setEditStatus('pendiente')
  }

  const handleUpdateReport = async () => {
    if (!id || !report) return
    
    // Validate fields
    if (!editTitle.trim()) {
      toast.error('El título es requerido')
      return
    }
    
    if (!editDescription.trim()) {
      toast.error('La descripción es requerida')
      return
    }

    try {
      setUpdating(true)
      const updatedReport = await reportsApi.update(id, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        status: editStatus
      })
      
      // Update local state
      setReport(updatedReport)
      setIsEditing(false)
      toast.success('Reporte actualizado correctamente')
    } catch (error) {
      handleErrorWithMessage(error, 'Error al actualizar el reporte', toast.error, 'DetalleReporte.handleUpdateReport')
    } finally {
      setUpdating(false)
    }
  }

  const handleCommentSubmit = async () => {
    if (!id || !commentText.trim() || submittingComment) return

    try {
      setSubmittingComment(true)
      await commentsApi.create({
        report_id: id,
        content: commentText.trim(),
      })
      
      setCommentText('')
      await loadComments()
      await loadReport()
    } catch (error) {
      handleErrorWithMessage(error, 'Error al crear comentario', toast.error, 'DetalleReporte.handleCommentSubmit')
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleReply = (commentId: string) => {
    setReplyingTo(commentId)
    setReplyText('')
  }

  const handleReplySubmit = async (parentId: string) => {
    if (!id || !replyText.trim() || submittingReply) return

    // Validate that parent comment exists and belongs to the same report
    const parentComment = comments.find(c => c.id === parentId)
    if (!parentComment) {
      toast.error('El comentario al que intentas responder ya no existe. Por favor, recarga la página.')
      setReplyingTo(null)
      setReplyText('')
      return
    }

    if (parentComment.report_id !== id) {
      toast.error('Error: El comentario padre no pertenece a este reporte.')
      setReplyingTo(null)
      setReplyText('')
      return
    }

    try {
      setSubmittingReply(true)
      await commentsApi.create({
        report_id: id,
        content: replyText.trim(),
        parent_id: parentId,
      })
      
      setReplyText('')
      setReplyingTo(null)
      await loadComments()
      await loadReport()
    } catch (error) {
      const errorInfo = handleErrorWithMessage(error, 'No se pudo crear la respuesta', toast.error, 'DetalleReporte.handleReplySubmit')
      setError(errorInfo.userMessage)
    } finally {
      setSubmittingReply(false)
    }
  }

  const handleLikeChange = (commentId: string, liked: boolean, newCount: number) => {
    // Update local state immediately for better UX
    setComments(prev => prev.map(c => 
      c.id === commentId 
        ? { ...c, liked_by_me: liked, upvotes_count: newCount }
        : c
    ))
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este comentario?') || deletingCommentId === commentId) return

    try {
      setDeletingCommentId(commentId)
      await commentsApi.delete(commentId)
      await loadComments()
      await loadReport()
    } catch (error) {
      const errorInfo = handleErrorWithMessage(error, 'No se pudo eliminar el comentario', toast.error, 'DetalleReporte.handleDeleteComment')
      setError(errorInfo.userMessage)
    } finally {
      setDeletingCommentId(null)
    }
  }

  const handleFlagComment = async (commentId: string) => {
    const comment = comments.find(c => c.id === commentId)
    if (!comment || flaggingCommentId === commentId) return
    
    // Check if already flagged (frontend check)
    if (comment.is_flagged) {
      toast.warning('Ya has reportado este comentario')
      return
    }
    
    // Check if user is trying to flag their own comment
    const currentAnonymousId = getAnonymousIdSafe()
    if (comment.anonymous_id === currentAnonymousId) {
      toast.warning('No puedes reportar tu propio comentario')
      return
    }
    
    if (!confirm('¿Estás seguro de que quieres reportar este comentario como inapropiado?')) {
      return
    }
    
    try {
      setFlaggingCommentId(commentId)
      await commentsApi.flag(commentId)
      
      // Update local state immediately
      setComments(prev => prev.map(c => 
        c.id === commentId 
          ? { ...c, is_flagged: true }
          : c
      ))
      
      toast.success('Comentario reportado correctamente. Gracias por ayudar a mantener la comunidad segura.')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : ''
      
      if (errorMessage.includes('own comment')) {
        toast.warning('No puedes reportar tu propio comentario')
      } else if (errorMessage.includes('already flagged')) {
        // Update local state to reflect already flagged
        setComments(prev => prev.map(c => 
          c.id === commentId 
            ? { ...c, is_flagged: true }
            : c
        ))
        toast.warning('Ya has reportado este comentario anteriormente')
      } else {
        handleErrorWithMessage(error, 'Error al reportar el comentario', toast.error, 'DetalleReporte.handleFlagComment')
      }
    } finally {
      setFlaggingCommentId(null)
    }
  }

  const handleEdit = (commentId: string) => {
    const comment = comments.find(c => c.id === commentId)
    if (comment) {
      setEditingCommentId(commentId)
      setEditText(comment.content)
    }
  }

  const handleEditSubmit = async (commentId: string) => {
    if (!editText.trim() || submittingEdit) return

    try {
      setSubmittingEdit(true)
      const updatedComment = await commentsApi.update(commentId, editText.trim())
      
      // Update local state immediately
      setComments(prev => prev.map(c => 
        c.id === commentId 
          ? { ...c, content: updatedComment.content, updated_at: updatedComment.updated_at }
          : c
      ))
      
      setEditingCommentId(null)
      setEditText('')
    } catch (error) {
      handleErrorWithMessage(error, 'Error al editar el comentario', toast.error, 'DetalleReporte.handleEditSubmit')
    } finally {
      setSubmittingEdit(false)
    }
  }

  const handleEditCancel = () => {
    setEditingCommentId(null)
    setEditText('')
  }

  const handleNewThread = () => {
    setCreatingThread(true)
    setThreadText('')
  }

  const handleNewThreadSubmit = async () => {
    if (!id || !threadText.trim() || submittingThread) return

    try {
      setSubmittingThread(true)
      await commentsApi.create({
        report_id: id,
        content: threadText.trim(),
        is_thread: true
      })
      
      setThreadText('')
      setCreatingThread(false)
      await loadComments()
      await loadReport()
    } catch (error) {
      handleErrorWithMessage(error, 'Error al crear el hilo', toast.error, 'DetalleReporte.handleNewThreadSubmit')
    } finally {
      setSubmittingThread(false)
    }
  }

  const handleNewThreadCancel = () => {
    setCreatingThread(false)
    setThreadText('')
  }

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

  const getStatusLabel = (status: Report['status']) => {
    const labelMap: Record<Report['status'], string> = {
      'pendiente': 'Activo',
      'en_proceso': 'En Proceso',
      'resuelto': 'Recuperado',
      'cerrado': 'Expirado'
    }
    return labelMap[status] || status
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <Card className="bg-dark-card border-dark-border">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Cargando reporte...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <Card className="bg-dark-card border-dark-border">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{error || 'Reporte no encontrado'}</p>
            <Button variant="outline" onClick={() => navigate('/')} className="mt-4">
              Volver al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Botón Volver */}
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        className="mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver
      </Button>

      {/* 2.1 Header Section */}
      <div className="mb-8">
        <div className="flex items-start justify-between">
          {/* Left Column */}
          <div className="flex-1">
            {/* Title Row */}
            {isEditing ? (
              <div className="space-y-4 mb-3">
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-2">
                    Título
                  </label>
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Título del reporte"
                    className="bg-dark-bg border-dark-border"
                    disabled={updating}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground/80 mb-2">
                    Estado
                  </label>
                  <Select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as Report['status'])}
                    className="bg-dark-bg border-dark-border"
                    disabled={updating}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <h1 className="text-3xl font-bold text-foreground">{report.title}</h1>
                  <Badge className={getStatusColor(report.status)}>
                    {getStatusLabel(report.status)}
                  </Badge>
                </div>
                {/* Location Row */}
                <div className="flex items-center text-foreground/60">
                  <MapPin className="h-4 w-4 mr-2" />
                  <span>{report.zone}</span>
                </div>
              </>
            )}
          </div>
          {/* Right Column (Actions) */}
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSave}
              disabled={savingFavorite}
              className={isSaved ? 'text-red-400 hover:text-red-300' : ''}
              title={savingFavorite ? 'Guardando...' : (isSaved ? 'Quitar de favoritos' : 'Guardar en favoritos')}
            >
              {savingFavorite ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                  Guardando...
                </>
              ) : (
                <>
                  <Heart className={`h-4 w-4 mr-2 ${isSaved ? 'fill-current' : ''}`} />
                  Guardar
                </>
              )}
            </Button>
            {(() => {
              const currentAnonymousId = getAnonymousIdSafe()
              const isOwner = report.anonymous_id === currentAnonymousId
              const isFlagged = report.is_flagged ?? false
              
              if (isOwner) {
                return (
                  <>
                    {!isEditing ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleStartEdit}
                          className="hover:text-neon-green"
                          title="Editar reporte"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsDeleteDialogOpen(true)}
                          className="hover:text-red-400"
                          title="Eliminar reporte"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleUpdateReport}
                          disabled={updating}
                          className="hover:text-neon-green"
                          title="Guardar cambios"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          {updating ? 'Guardando...' : 'Guardar'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelEdit}
                          disabled={updating}
                          className="hover:text-red-400"
                          title="Cancelar edición"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Cancelar
                        </Button>
                      </>
                    )}
                  </>
                )
              }
              
              if (isFlagged) {
                return (
                  <span className="text-sm text-foreground/60" title="Ya has denunciado este reporte">
                    Denunciado
                  </span>
                )
              }
              
              return (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleFlag}
                  className="hover:text-yellow-400"
                  title="Reportar contenido inapropiado"
                >
                  <Flag className="h-4 w-4 mr-2" />
                  Reportar
                </Button>
              )
            })()}
          </div>
        </div>
      </div>

      {/* 2.2 Main Content Area */}
      {/* Description Card */}
      <Card className="card-glow bg-dark-card border-dark-border mb-6">
        <CardHeader>
          <CardTitle>Descripción</CardTitle>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <div>
              <label className="block text-sm font-medium text-foreground/80 mb-2">
                Descripción
              </label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Descripción del reporte"
                className="bg-dark-bg border-dark-border min-h-[150px]"
                disabled={updating}
              />
            </div>
          ) : (
            <p className="text-foreground/80 leading-relaxed">
              {report.description}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Images Card */}
      <Card className="card-glow bg-dark-card border-dark-border mb-6">
        <CardHeader>
          <CardTitle>Imágenes</CardTitle>
        </CardHeader>
        <CardContent>
          {report.image_urls && Array.isArray(report.image_urls) && report.image_urls.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {report.image_urls.map((imageUrl, index) => {
                const hasFailed = failedImageUrls.has(imageUrl)
                const imageKey = imageUrl && typeof imageUrl === 'string' && imageUrl.length > 0 
                  ? `image-${imageUrl.substring(0, 50)}-${index}`
                  : `image-${index}`
                
                return (
                  <div
                    key={imageKey}
                    className="relative aspect-square rounded-lg overflow-hidden border border-dark-border bg-dark-bg"
                  >
                    {!hasFailed ? (
                      <img
                        src={imageUrl}
                        alt={`Imagen ${index + 1} del reporte`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={() => {
                          setFailedImageUrls(prev => new Set(prev).add(imageUrl))
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-dark-bg">
                        <div className="text-center p-4">
                          <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                          <p className="text-xs text-muted-foreground">Imagen no disponible</p>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <ImageIcon className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">Este reporte no tiene imágenes</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Card 1 (Date) */}
        <Card className="p-4 bg-dark-card border-dark-border">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-neon-green" />
            <div>
              <div className="text-sm text-muted-foreground mb-1">Fecha del incidente</div>
              <div className="font-medium text-foreground">
                {new Date(report.incident_date || report.created_at).toLocaleDateString('es-AR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          </div>
        </Card>

        {/* Card 2 (Views) */}
        <Card className="p-4 bg-dark-card border-dark-border">
          <div className="flex items-center gap-3">
            <Eye className="h-5 w-5 text-blue-400" />
            <div>
              <div className="text-sm text-muted-foreground mb-1">Visualizaciones</div>
              <div className="font-medium text-foreground">{report.upvotes_count}</div>
            </div>
          </div>
        </Card>

        {/* Card 3 (Comments) */}
        <Card className="p-4 bg-dark-card border-dark-border">
          <div className="flex items-center gap-3">
            <MessageCircle className="h-5 w-5 text-green-400" />
            <div>
              <div className="text-sm text-muted-foreground mb-1">Comentarios</div>
              <div className="font-medium text-foreground">{report.comments_count}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* 2.3 Comments & Collaboration Section */}
      <div>
        {/* Header Row */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-foreground">Comentarios</h2>
          {/* View Toggle */}
          <div className="flex items-center space-x-2">
            <Button
              variant={viewMode === 'comments' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('comments')}
              className={viewMode === 'comments' ? 'bg-neon-green text-dark-bg' : 'border-dark-border text-foreground'}
            >
              Comentarios
            </Button>
            <Button
              variant={viewMode === 'threads' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('threads')}
              className={viewMode === 'threads' ? 'bg-neon-green text-dark-bg' : 'border-dark-border text-foreground'}
            >
              Hilos
            </Button>
          </div>
        </div>

        {/* Add Comment Card */}
        <Card className="mb-6 bg-dark-card border-dark-border">
          <CardHeader>
            <CardTitle className="font-semibold">Agregar Comentario</CardTitle>
            <CardDescription className="text-sm text-foreground/70">
              Comparte información útil sobre este reporte con formato enriquecido
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RichTextEditor
              value={commentText}
              onChange={setCommentText}
              onSubmit={handleCommentSubmit}
              disabled={submittingComment}
            />
          </CardContent>
        </Card>

        {/* Comments List */}
        {viewMode === 'comments' && (
          <div className="space-y-4">
            {comments.length === 0 ? (
              <Card className="bg-dark-card border-dark-border">
                <CardContent className="py-12 text-center">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground mb-2">No hay comentarios aún</p>
                  <p className="text-xs text-muted-foreground">Sé el primero en comentar este reporte</p>
                </CardContent>
              </Card>
            ) : (
              comments
                .filter(c => !c.parent_id && !(c.is_thread === true)) // Solo comentarios top-level que NO son hilos
                .map((comment) => {
                  const commentReplies = comments.filter(c => c.parent_id === comment.id)
                  const currentAnonymousId = getAnonymousIdSafe()
                  const isCommentOwner = comment.anonymous_id === currentAnonymousId
                  const isCommentMod = false // Prepared for future mod system
                  
                  return (
                    <div key={comment.id}>
                      <EnhancedComment
                        comment={comment}
                        replies={commentReplies}
                        isOwner={isCommentOwner}
                        isMod={isCommentMod}
                        onReply={handleReply}
                        onEdit={handleEdit}
                        onDelete={handleDeleteComment}
                        onFlag={handleFlagComment}
                        onLikeChange={handleLikeChange}
                      />
                      
                      {/* Edit Editor (Inline) */}
                      {editingCommentId === comment.id && (
                        <Card className="mt-3 bg-dark-card border-dark-border">
                          <CardContent className="p-4">
                            <RichTextEditor
                              value={editText}
                              onChange={setEditText}
                              onSubmit={() => handleEditSubmit(comment.id)}
                              disabled={submittingEdit}
                              placeholder="Edita tu comentario..."
                              hideHelp={true}
                              showCancel={true}
                              onCancel={handleEditCancel}
                            />
                          </CardContent>
                        </Card>
                      )}
                      
                      {/* Reply Editor (Inline) */}
                      {replyingTo === comment.id && (
                        <Card className="mt-3 ml-8 bg-dark-card border-dark-border">
                          <CardContent className="p-4">
                            <RichTextEditor
                              value={replyText}
                              onChange={setReplyText}
                              onSubmit={() => handleReplySubmit(comment.id)}
                              disabled={submittingReply}
                              placeholder="Escribe tu respuesta..."
                              hideHelp={true}
                              showCancel={true}
                              onCancel={() => {
                                setReplyingTo(null)
                                setReplyText('')
                              }}
                            />
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )
                })
            )}
          </div>
        )}

        {/* Threads View */}
        {viewMode === 'threads' && (() => {
                  const currentAnonymousId = getAnonymousIdSafe()
          const isThreadMod = false // Prepared for future mod system
          
          return (
            <ThreadList
              comments={comments}
              onNewThread={handleNewThread}
              onReply={handleReply}
              onEdit={handleEdit}
              onDelete={handleDeleteComment}
              onFlag={handleFlagComment}
              onLikeChange={handleLikeChange}
              isOwner={(commentId) => {
                const comment = comments.find(c => c.id === commentId)
                return comment ? comment.anonymous_id === currentAnonymousId : false
              }}
              isMod={isThreadMod}
              editingCommentId={editingCommentId}
              editText={editText}
              onEditTextChange={setEditText}
              onEditSubmit={handleEditSubmit}
              onEditCancel={handleEditCancel}
              submittingEdit={submittingEdit}
              creatingThread={creatingThread}
              threadText={threadText}
              onThreadTextChange={setThreadText}
              onThreadSubmit={handleNewThreadSubmit}
              onThreadCancel={handleNewThreadCancel}
              submittingThread={submittingThread}
            />
          )
        })()}
      </div>

      {/* Delete Confirmation Dialog */}
      {isDeleteDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md bg-dark-card border-dark-border">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className="h-6 w-6 text-red-400" />
                <CardTitle>Eliminar Reporte</CardTitle>
              </div>
              <CardDescription>
                Esta acción no se puede deshacer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-foreground/80">
                  ¿Estás seguro de que quieres eliminar este reporte? Todos los datos asociados (comentarios, favoritos, etc.) también se eliminarán permanentemente.
                </p>
                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setIsDeleteDialogOpen(false)}
                    disabled={deleting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteReport}
                    disabled={deleting}
                  >
                    {deleting ? 'Eliminando...' : 'Eliminar'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Flag Dialog */}
      {isFlagDialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md bg-dark-card border-dark-border">
            <CardHeader>
              <CardTitle>Reportar Contenido</CardTitle>
              <CardDescription>
                ¿Por qué quieres reportar este contenido?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {['Spam', 'Contenido Inapropiado', 'Información Falsa', 'Otro'].map((reason) => (
                  <Button
                    key={reason}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => handleFlagSubmit(reason)}
                    disabled={flaggingReport}
                  >
                    {flaggingReport ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                        Reportando...
                      </>
                    ) : (
                      reason
                    )}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  className="w-full mt-4"
                  onClick={() => setIsFlagDialogOpen(false)}
                  disabled={flaggingReport}
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
