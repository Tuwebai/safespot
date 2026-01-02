import { useState, memo, useRef, useEffect } from 'react'
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
  depth?: number
}

export const EnhancedComment = memo(function EnhancedComment({
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
  onUnpin,
  depth = 0,
  activeMenuId = null,
  onMenuOpen,
}: EnhancedCommentProps & { activeMenuId?: string | null; onMenuOpen?: (id: string | null) => void }) {
  const toast = useToast()
  // Use props if available, otherwise fall back to local state (though we intend to use props)
  const [localIsContextMenuOpen, setLocalIsContextMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const isContextMenuOpen = onMenuOpen ? activeMenuId === comment.id : localIsContextMenuOpen

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isContextMenuOpen && menuRef.current && !menuRef.current.contains(event.target as Node)) {
        closeMenu()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isContextMenuOpen, activeMenuId]) // activeMenuId dependency ensures fresh closure if using global state logic

  const handleToggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onMenuOpen) {
      onMenuOpen(isContextMenuOpen ? null : comment.id)
    } else {
      setLocalIsContextMenuOpen(!localIsContextMenuOpen)
    }
  }

  const closeMenu = () => {
    if (onMenuOpen) {
      onMenuOpen(null)
    } else {
      setLocalIsContextMenuOpen(false)
    }
  }

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

  // ... (rest of methods)

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(comment.content)
      closeMenu()
      toast.success('Texto copiado al portapapeles')
    } catch (error) {
      toast.error('No se pudo copiar el texto al portapapeles')
    }
  }

  const handleViewDirectLink = async () => {
    const url = `${window.location.href}#comment-${comment.id}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Enlace copiado')
      closeMenu()
    } catch (error) {
      toast.error('No se pudo copiar el enlace')
    }
  }

  const handleLike = () => {
    // Delegate entirely to parent mutation (which handles optimistic UI)
    onLikeChange?.(comment.id, !comment.liked_by_me, 0)
  }

  const isThread = comment.is_thread === true

  // Adjust visual styling based on depth
  const avatarSize = depth === 0 ? 'w-10 h-10' : depth === 1 ? 'w-8 h-8' : 'w-7 h-7'
  const cardPadding = depth === 0 ? 'p-6' : depth === 1 ? 'p-4' : 'p-3'
  const textOpacity = depth > 0 ? 'opacity-95' : 'opacity-100'

  return (
    <Card className={`card-glow transition-all duration-200 ${textOpacity} ${isThread
      ? 'border-2 border-purple-500/50 hover:border-purple-500/80 bg-dark-card'
      : 'border-dark-border hover:border-neon-green/30 bg-dark-card/60'
      }`}>
      <CardContent className={cardPadding}>
        {/* Header Section */}
        <div className="flex items-start justify-between mb-3">
          {/* Left Side (User & Meta) */}
          <div className="flex items-start gap-3 flex-1">
            {/* Avatar */}
            <div className={`${avatarSize} rounded-full bg-neon-green text-dark-bg flex items-center justify-center ${depth === 0 ? 'font-semibold' : 'font-medium text-sm'} hover:ring-2 hover:ring-neon-green/50 transition-all cursor-pointer`}>
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
          <div className="relative" ref={menuRef}>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleToggleMenu}
              title="Más opciones"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>

            {/* Context Menu Dropdown */}
            {isContextMenuOpen && (
              <>
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
                          closeMenu()
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-dark-bg flex items-center gap-2"
                      >
                        <Edit className="h-4 w-4" />
                        Editar
                      </button>
                      <button
                        onClick={() => {
                          onDelete?.(comment.id)
                          closeMenu()
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
                          closeMenu()
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-dark-bg flex items-center gap-2"
                      >
                        <Edit className="h-4 w-4" />
                        Editar
                      </button>
                      <button
                        onClick={() => {
                          onDelete?.(comment.id)
                          closeMenu()
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
                            closeMenu()
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
                            closeMenu()
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
              className={comment.liked_by_me ? "text-yellow-400 font-medium" : "text-foreground/60 hover:text-foreground"}
            >
              <>
                <ThumbsUp className={`h-4 w-4 mr-1 ${comment.liked_by_me ? 'fill-current' : ''}`} />
                Me gusta {comment.upvotes_count > 0 && `(${comment.upvotes_count})`}
              </>
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

        {/* Replies are now handled by CommentThread component recursively */}
      </CardContent>
    </Card>
  )
})
