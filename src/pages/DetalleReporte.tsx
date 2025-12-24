import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { reportsApi, commentsApi } from '@/lib/api'
import { getAnonymousId } from '@/lib/identity'
import { useToast } from '@/components/ui/toast'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
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
  Image as ImageIcon
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

  useEffect(() => {
    if (id) {
      loadReport()
      loadComments()
    }
  }, [id])

  useEffect(() => {
    if (report) {
      checkSaved()
    }
  }, [report])

  const loadReport = async () => {
    if (!id) return
    
    try {
      setLoading(true)
      const data = await reportsApi.getById(id)
      setReport(data)
    } catch (error) {
      setError('No se pudo cargar el reporte')
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
      // Silently fail
    }
  }

  const checkSaved = async () => {
    if (!id || !report) return
    
    try {
      // The is_favorite flag comes from the report data
      setIsSaved(report.is_favorite ?? false)
    } catch (error) {
      console.error('Error checking favorite status:', error)
      setIsSaved(false)
    }
  }

  const handleSave = async () => {
    if (!id) return
    
    try {
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
      console.error('Error toggling favorite:', error)
      toast.error(error instanceof Error ? error.message : 'Error al guardar en favoritos')
    }
  }

  const handleFlag = () => {
    if (!report) return
    
    // Check if user is trying to flag their own report
    // This should be handled by backend, but we can prevent UI interaction
    setIsFlagDialogOpen(true)
  }

  const handleFlagSubmit = async (reason: string) => {
    if (!id) return
    
    try {
      await reportsApi.flag(id, reason)
      setIsFlagDialogOpen(false)
      
      // Update report state
      if (report) {
        setReport({ ...report, is_flagged: true })
      }
      
      // Show success message
      toast.success('Reporte denunciado correctamente. Gracias por ayudar a mantener la comunidad segura.')
    } catch (error) {
      console.error('Error flagging report:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error al denunciar el reporte'
      
      if (errorMessage.includes('own report')) {
        toast.warning('No puedes denunciar tu propio reporte')
      } else if (errorMessage.includes('already flagged')) {
        toast.warning('Ya has denunciado este reporte anteriormente')
      } else {
        toast.error(errorMessage)
      }
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
      toast.error(error instanceof Error ? error.message : 'Error al crear comentario')
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
      console.error('Error creating reply:', error)
      setError('No se pudo crear la respuesta')
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
    if (!confirm('¿Estás seguro de que quieres eliminar este comentario?')) return

    try {
      await commentsApi.delete(commentId)
      await loadComments()
      await loadReport()
    } catch (error) {
      console.error('Error deleting comment:', error)
      setError('No se pudo eliminar el comentario')
    }
  }

  const handleFlagComment = async (commentId: string) => {
    const comment = comments.find(c => c.id === commentId)
    if (!comment) return
    
    // Check if already flagged (frontend check)
    if (comment.is_flagged) {
      toast.warning('Ya has reportado este comentario')
      return
    }
    
    // Check if user is trying to flag their own comment
    const currentAnonymousId = getAnonymousId()
    if (comment.anonymous_id === currentAnonymousId) {
      toast.warning('No puedes reportar tu propio comentario')
      return
    }
    
    if (!confirm('¿Estás seguro de que quieres reportar este comentario como inapropiado?')) {
      return
    }
    
    try {
      await commentsApi.flag(commentId)
      
      // Update local state immediately
      setComments(prev => prev.map(c => 
        c.id === commentId 
          ? { ...c, is_flagged: true }
          : c
      ))
      
      toast.success('Comentario reportado correctamente. Gracias por ayudar a mantener la comunidad segura.')
    } catch (error) {
      console.error('Error flagging comment:', error)
      const errorMessage = error instanceof Error ? error.message : 'Error al reportar el comentario'
      
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
        toast.error(errorMessage)
      }
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
      console.error('Error updating comment:', error)
      toast.error(error instanceof Error ? error.message : 'Error al editar el comentario')
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
      console.error('Error creating thread:', error)
      toast.error(error instanceof Error ? error.message : 'Error al crear el hilo')
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
          </div>
          {/* Right Column (Actions) */}
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSave}
              className={isSaved ? 'text-red-400 hover:text-red-300' : ''}
              title={isSaved ? 'Quitar de favoritos' : 'Guardar en favoritos'}
            >
              <Heart className={`h-4 w-4 mr-2 ${isSaved ? 'fill-current' : ''}`} />
              Guardar
            </Button>
            {(() => {
              const currentAnonymousId = getAnonymousId()
              const isOwner = report.anonymous_id === currentAnonymousId
              const isFlagged = report.is_flagged ?? false
              
              if (isOwner) {
                return null // Don't show flag button for own reports
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
          <p className="text-foreground/80 leading-relaxed">
            {report.description}
          </p>
        </CardContent>
      </Card>

      {/* Images Card */}
      <Card className="card-glow bg-dark-card border-dark-border mb-6">
        <CardHeader>
          <CardTitle>Imágenes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-center h-64 rounded-lg bg-dark-bg border border-dark-border border-dashed">
              <div className="text-center">
                <ImageIcon className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Sin imágenes</p>
              </div>
            </div>
          </div>
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
                  const currentAnonymousId = getAnonymousId()
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
          const currentAnonymousId = getAnonymousId()
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
                  >
                    {reason}
                  </Button>
                ))}
                <Button
                  variant="ghost"
                  className="w-full mt-4"
                  onClick={() => setIsFlagDialogOpen(false)}
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
