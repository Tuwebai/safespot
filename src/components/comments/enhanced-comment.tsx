import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TipTapRenderer } from '@/components/ui/tiptap-renderer'
import { useToast } from '@/components/ui/toast'
import { 
  MessageCircle, 
  ThumbsUp, 
  Pin, 
  Edit, 
  Trash2, 
  Flag,
  MoreHorizontal,
  Copy,
  Link as LinkIcon
} from 'lucide-react'
import type { Comment } from '@/lib/api'
import { commentsApi } from '@/lib/api'

interface EnhancedCommentProps {
  comment: Comment & {
    thread_type?: 'investigation' | 'evidence' | 'coordination' | 'testimony'
    priority?: 'urgent' | 'high' | 'medium' | 'low'
    is_pinned?: boolean
  }
  replies?: Comment[]
  isOwner?: boolean
  isMod?: boolean
  onReply?: (commentId: string) => void
  onEdit?: (commentId: string) => void
  onDelete?: (commentId: string) => void
  onFlag?: (commentId: string) => void
  onLikeChange?: (commentId: string, liked: boolean, newCount: number) => void
  onPin?: (commentId: string) => void
  onUnpin?: (commentId: string) => void
}

export function EnhancedComment({
  comment,
  replies = [],
  isOwner = false,
  isMod = false,
  onReply,
  onEdit,
  onDelete,
  onFlag,
  onLikeChange,
  onPin,
  onUnpin
}: EnhancedCommentProps) {
  const toast = useToast()
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false)
  const [isLiking, setIsLiking] = useState(false)
  const [localLiked, setLocalLiked] = useState(comment.liked_by_me ?? false)
  const [localCount, setLocalCount] = useState(comment.upvotes_count ?? 0)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getUserInitials = (anonymousId: string) => {
    return anonymousId.substring(0, 2).toUpperCase()
  }

  const getThreadTypeColor = (type?: string) => {
    switch (type) {
      case 'investigation':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'evidence':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'coordination':
        return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'testimony':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      default:
        return ''
    }
  }

  const getThreadTypeLabel = (type?: string) => {
    switch (type) {
      case 'investigation':
        return '🔍 Investigación'
      case 'evidence':
        return '📸 Evidencia'
      case 'coordination':
        return '🤝 Coordinación'
      case 'testimony':
        return '🎤 Testimonio'
      default:
        return ''
    }
  }

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'high':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'low':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
      default:
        return ''
    }
  }

  const getPriorityLabel = (priority?: string) => {
    switch (priority) {
      case 'urgent':
        return '🚨 Urgente'
      case 'high':
        return '⚠️ Alta'
      case 'medium':
        return '📌 Media'
      case 'low':
        return 'Baja'
      default:
        return ''
    }
  }

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(comment.content)
      setIsContextMenuOpen(false)
      toast.success('Texto copiado al portapapeles')
    } catch (error) {
      toast.error('No se pudo copiar el texto al portapapeles')
    }
  }

  const handleViewDirectLink = () => {
    const url = `${window.location.origin}/comments/${comment.id}`
    window.open(url, '_blank')
    setIsContextMenuOpen(false)
  }

  const handleLike = async () => {
    if (isLiking) return // Prevent double clicks
    
    // Guardar estado previo para revertir en caso de error
    const previousLiked = localLiked
    const previousCount = localCount
    
    // Optimistic UI: actualizar estado inmediatamente
    const newLiked = !localLiked
    const newCount = newLiked ? localCount + 1 : Math.max(0, localCount - 1)
    
    setLocalLiked(newLiked)
    setLocalCount(newCount)
    setIsLiking(true)
    
    try {
      let result: { liked: boolean; upvotes_count: number } | undefined
      
      if (previousLiked) {
        // Unlike
        result = await commentsApi.unlike(comment.id)
      } else {
        // Like
        result = await commentsApi.like(comment.id)
      }
      
      // Validación defensiva: solo actualizar si result es válido
      if (result && typeof result.liked === 'boolean' && typeof result.upvotes_count === 'number') {
        setLocalLiked(result.liked)
        setLocalCount(result.upvotes_count)
        onLikeChange?.(comment.id, result.liked, result.upvotes_count)
      } else {
        // Si la respuesta es inválida, mantener el estado optimistic
        // (asumimos que funcionó si no hay error)
        onLikeChange?.(comment.id, newLiked, newCount)
      }
    } catch (error) {
      console.error('Error toggling like:', error)
      // Revertir al estado previo en caso de error
      setLocalLiked(previousLiked)
      setLocalCount(previousCount)
    } finally {
      setIsLiking(false)
    }
  }

  const isThread = comment.is_thread === true
  
  return (
    <Card className={`card-glow bg-dark-card transition-all duration-200 ${
      isThread 
        ? 'border-2 border-purple-500/50 hover:border-purple-500/80' 
        : 'border-dark-border hover:border-neon-green/30'
    }`}>
      <CardContent className="p-4">
        {/* Header Section */}
        <div className="flex items-start justify-between mb-3">
          {/* Left Side (User & Meta) */}
          <div className="flex items-start gap-3 flex-1">
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-neon-green text-dark-bg flex items-center justify-center font-semibold hover:ring-2 hover:ring-neon-green/50 transition-all cursor-pointer">
              {getUserInitials(comment.anonymous_id)}
            </div>

            {/* User Details */}
            <div className="flex-1 min-w-0">
              {/* Name Row */}
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-medium text-foreground hover:text-neon-green cursor-pointer">
                  Usuario Anónimo
                </span>
              </div>

              {/* Badges Row (Visual Indicators) */}
              <div className="flex items-center gap-1 flex-wrap mb-1">
                {/* Thread Badge */}
                {isThread && (
                  <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 font-semibold">
                    💬 Hilo
                  </Badge>
                )}
                
                {/* Pinned Badge */}
                {comment.is_pinned && (
                  <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                    <Pin className="h-3 w-3 mr-1" />
                    📌 Fijado
                  </Badge>
                )}
                
                {/* Thread Type Badge */}
                {comment.thread_type && (
                  <Badge className={getThreadTypeColor(comment.thread_type)}>
                    {getThreadTypeLabel(comment.thread_type)}
                  </Badge>
                )}
                
                {/* Priority Badge */}
                {comment.priority && (
                  <Badge className={getPriorityColor(comment.priority)}>
                    {getPriorityLabel(comment.priority)}
                  </Badge>
                )}
              </div>

              {/* Meta Row */}
              <div className="flex items-center gap-2 text-sm text-foreground/60">
                <span>{formatDate(comment.created_at)}</span>
                {replies.length > 0 && (
                  <>
                    <span>•</span>
                    <span>{replies.length} {replies.length === 1 ? 'respuesta' : 'respuestas'}</span>
                  </>
                )}
                {comment.updated_at && comment.updated_at !== comment.created_at && (
                  <>
                    <span>•</span>
                    <span>(editado)</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Side (Context Menu) */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setIsContextMenuOpen(!isContextMenuOpen)}
              title="Más opciones"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>

            {/* Context Menu Dropdown */}
            {isContextMenuOpen && (
              <>
                {/* Backdrop para cerrar al hacer click fuera */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsContextMenuOpen(false)}
                />
                
                {/* Menu */}
                <div className="absolute right-0 top-8 z-20 w-48 bg-dark-card border border-dark-border rounded-lg shadow-lg py-1">
                  {/* General User Actions */}
                  <button
                    onClick={handleCopyText}
                    className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-dark-bg flex items-center gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    Copiar texto
                  </button>
                  <button
                    onClick={handleViewDirectLink}
                    className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-dark-bg flex items-center gap-2"
                  >
                    <LinkIcon className="h-4 w-4" />
                    Ver enlace directo
                  </button>

                  {/* Owner Actions */}
                  {isOwner && (
                    <>
                      <div className="border-t border-dark-border my-1" />
                      <button
                        onClick={() => {
                          onEdit?.(comment.id)
                          setIsContextMenuOpen(false)
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-dark-bg flex items-center gap-2"
                      >
                        <Edit className="h-4 w-4" />
                        Editar
                      </button>
                      <button
                        onClick={() => {
                          onDelete?.(comment.id)
                          setIsContextMenuOpen(false)
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-destructive hover:bg-dark-bg flex items-center gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Eliminar
                      </button>
                    </>
                  )}

                  {/* Moderator Actions */}
                  {isMod && (
                    <>
                      <div className="border-t border-dark-border my-1" />
                      <button
                        onClick={() => {
                          onEdit?.(comment.id)
                          setIsContextMenuOpen(false)
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-dark-bg flex items-center gap-2"
                      >
                        <Edit className="h-4 w-4" />
                        Editar
                      </button>
                      <button
                        onClick={() => {
                          onDelete?.(comment.id)
                          setIsContextMenuOpen(false)
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-destructive hover:bg-dark-bg flex items-center gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Eliminar
                      </button>
                      {comment.is_pinned ? (
                        <button
                          onClick={() => {
                            onUnpin?.(comment.id)
                            setIsContextMenuOpen(false)
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-dark-bg flex items-center gap-2"
                        >
                          <Pin className="h-4 w-4" />
                          Desfijar
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            onPin?.(comment.id)
                            setIsContextMenuOpen(false)
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-dark-bg flex items-center gap-2"
                        >
                          <Pin className="h-4 w-4" />
                          Fijar
                        </button>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div className="text-foreground/80 leading-relaxed mb-3">
          <TipTapRenderer content={comment.content} />
        </div>

        {/* Action Bar (Footer) */}
        <div className="flex items-center justify-between pt-3 border-t border-dark-border">
          {/* Left Actions (Interactions) */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onReply?.(comment.id)}
              className="text-foreground/60 hover:text-foreground"
            >
              <MessageCircle className="h-4 w-4 mr-1" />
              Responder
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLike}
              disabled={isLiking}
              className={localLiked ? "text-yellow-400 font-medium" : "text-foreground/60 hover:text-foreground"}
            >
              <ThumbsUp className={`h-4 w-4 mr-1 ${localLiked ? 'fill-current' : ''}`} />
              Me gusta {localCount > 0 && `(${localCount})`}
            </Button>
          </div>

          {/* Right Actions (Moderation) */}
          <div className="flex items-center gap-1">
            {isMod && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => onEdit?.(comment.id)}
                  title="Editar"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                {comment.is_pinned ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => onUnpin?.(comment.id)}
                    title="Desfijar"
                  >
                    <Pin className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => onPin?.(comment.id)}
                    title="Fijar"
                  >
                    <Pin className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => onDelete?.(comment.id)}
                  title="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
            {!isOwner && (
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 w-7 p-0 ${comment.is_flagged ? 'text-yellow-400 opacity-50 cursor-not-allowed' : 'hover:text-yellow-400'}`}
                onClick={() => onFlag?.(comment.id)}
                disabled={comment.is_flagged ?? false}
                title={comment.is_flagged ? 'Ya has reportado este comentario' : 'Reportar'}
              >
                <Flag className={`h-4 w-4 ${comment.is_flagged ? 'fill-current' : ''}`} />
              </Button>
            )}
          </div>
        </div>

        {/* Replies (Nested) */}
        {replies.length > 0 && (
          <div className="mt-3 ml-8 space-y-3">
            {replies.map((reply) => (
              <div key={reply.id} className="flex items-start gap-2">
                <div className="w-6 h-6 rounded-full bg-neon-green/20 text-neon-green flex items-center justify-center text-xs font-semibold">
                  {getUserInitials(reply.anonymous_id)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-foreground">Usuario Anónimo</span>
                    <span className="text-xs text-foreground/50">
                      {formatDate(reply.created_at)}
                    </span>
                  </div>
                  <div className="text-xs text-foreground/80 leading-relaxed">
                    <TipTapRenderer content={reply.content} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
