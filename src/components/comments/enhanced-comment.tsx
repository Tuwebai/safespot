import { useState, memo, useRef, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TipTapRenderer } from '@/components/ui/tiptap-renderer'
import { useToast } from '@/components/ui/toast'
import { Link, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar"
import { getAvatarFallback } from '@/lib/avatar'
import { isRealUser } from '@/lib/adapters' // ✅ Centralized Helper
import { useIsOwner } from '@/hooks/useIsOwner' // ✅ SSOT
import { useAnonymousId } from '@/hooks/useAnonymousId' // ✅ Reactive Identity
import {
  MessageCircle,
  ThumbsUp,
  Pin,
  Edit,
  Trash2,
  Flag,
  MoreHorizontal,
  Copy,
  Link as LinkIcon,
  Trophy
} from 'lucide-react'
import type { Comment } from '@/lib/schemas'

interface EnhancedCommentProps {
  comment: Comment & {
    thread_type?: 'investigation' | 'evidence' | 'coordination' | 'testimony'
    priority?: 'urgent' | 'high' | 'medium' | 'low'
    is_pinned?: boolean
  }
  replies?: Comment[]
  // _isOwner removed
  isMod?: boolean
  onReply?: (commentId: string) => void
  onEdit?: (commentId: string, content: string) => void
  onDelete?: (commentId: string) => void
  onFlag?: (commentId: string, isFlagged: boolean, ownerId: string) => void
  onLikeChange?: (commentId: string, liked: boolean, newCount: number) => void
  onPin?: (commentId: string) => void
  onUnpin?: (commentId: string) => void
  depth?: number
  repliesCount?: number
  onToggleReplies?: () => void
  isExpanded?: boolean
  isThreadView?: boolean
  canPin?: boolean
  activeMenuId?: string | null
  onMenuOpen?: (id: string | null) => void
}

export const EnhancedComment = memo(function EnhancedComment({
  comment,
  replies = [],
  // _isOwner removed
  isMod = false,
  onReply,
  onEdit,
  onDelete,
  onFlag,
  onLikeChange,
  onPin,
  onUnpin,
  depth = 0,
  repliesCount = 0,
  canPin = false,
  onToggleReplies,
  isExpanded = false,
  isThreadView = false,
  activeMenuId = null,
  onMenuOpen,
}: EnhancedCommentProps) {
  const navigate = useNavigate()
  const toast = useToast()
  // Use props if available, otherwise fall back to local state (though we intend to use props)
  const [localIsContextMenuOpen, setLocalIsContextMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // ✅ ENTERPRISE FIX: Force re-render when identity resolves
  // Root Cause: Race condition de hydration
  // - resolveCreator() usa sessionAuthority.getAnonymousId() directo (síncrono)
  // - useAnonymousId() usa useState(sessionAuthority.getAnonymousId()) (reactivo)
  // Si SessionAuthority está BOOTSTRAPPING → useAnonymousId retorna null
  // Component renderiza con isMe=false → botón "Reportar"
  // Cuando SessionAuthority → READY, useAnonymousId actualiza
  // Esta dependencia reactiva fuerza re-render → isMe actualiza → botón correcto
  const currentId = useAnonymousId()

  // ✅ SSOT Permission: Calculate ownership directly
  const isMe = useIsOwner(comment.author.id)

  // 🔍 DIAGNOSTIC LOGS (Remove after debugging)
  useEffect(() => {
    const canEditValue = isMe
    const canModerateValue = isMe || isMod
    console.group(`[EnhancedComment] ${comment.id.substring(0, 8)}`)
    console.log('comment.id:', comment.id)
    console.log('comment.is_optimistic:', comment.is_optimistic)
    console.log('author.id:', comment.author.id)
    console.log('author.alias:', comment.author.alias)
    console.log('currentId:', currentId)
    console.log('isMe:', isMe)
    console.log('Direct comparison:', currentId === comment.author.id)
    console.log('author.id type:', typeof comment.author.id)
    console.log('currentId type:', typeof currentId)
    console.log('canEdit:', canEditValue)
    console.log('canModerate:', canModerateValue)
    console.groupEnd()
  }, [comment.id, comment.author.id, comment.author.alias, comment.is_optimistic, currentId, isMe, isMod])

  // [CMT-001] Permission Separation:
  // canEdit: Only the author can edit their own content.
  // canModerate: The author OR a moderator (Report Owner/Admin) can delete or pin.
  const canEdit = isMe
  const canModerate = isMe || isMod

  const isContextMenuOpen = onMenuOpen ? activeMenuId === comment.id : localIsContextMenuOpen

  const closeMenu = useCallback(() => {
    if (onMenuOpen) {
      onMenuOpen(null)
    } else {
      setLocalIsContextMenuOpen(false)
    }
  }, [onMenuOpen])

  const handleToggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onMenuOpen) {
      onMenuOpen(isContextMenuOpen ? null : comment.id)
    } else {
      setLocalIsContextMenuOpen(!localIsContextMenuOpen)
    }
  }

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
  }, [isContextMenuOpen, activeMenuId, closeMenu])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getThreadTypeColor = (type?: string) => {
    switch (type) {
      case 'investigation':
        return 'bg-[hsl(var(--badge-investigation)/0.15)] text-[hsl(var(--badge-investigation))] border-[hsl(var(--badge-investigation)/0.3)]'
      case 'evidence':
        return 'bg-[hsl(var(--badge-evidence)/0.15)] text-[hsl(var(--badge-evidence))] border-[hsl(var(--badge-evidence)/0.3)]'
      case 'coordination':
        return 'bg-[hsl(var(--badge-coordination)/0.15)] text-[hsl(var(--badge-coordination))] border-[hsl(var(--badge-coordination)/0.3)]'
      case 'testimony':
        return 'bg-[hsl(var(--badge-testimony)/0.15)] text-[hsl(var(--badge-testimony))] border-[hsl(var(--badge-testimony)/0.3)]'
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
    // Pass CURRENT like state so mutation knows which way to toggle
    onLikeChange?.(comment.id, !!comment.liked_by_me, 0)
  }

  const isThread = comment.is_thread === true

  // Adjust visual styling based on depth
  const cardPadding = 'p-4 sm:p-5'
  const textOpacity = depth > 0 ? 'opacity-95' : 'opacity-100'

  const isEdited = useMemo(() => {
    // Si tenemos last_edited_at del servidor (manejado por trigger de contenido), lo usamos
    if (comment.last_edited_at) {
      return true
    }
    return false
  }, [comment.last_edited_at])

  const handleCardClick = () => {
    if (isThreadView) return // Already in thread view, don't navigate

    if (onToggleReplies) {
      onToggleReplies()
    } else {
      navigate(`/reporte/${comment.report_id}/hilo/${comment.id}`)
    }
  }

  // ✅ IDENTITY SSOT: Access via author object
  const { author } = comment;
  const isReal = isRealUser(author);

  return (
    <Card
      onClick={handleCardClick}
      className={cn(
        "card-glow transition-all duration-300 cursor-pointer group relative",
        textOpacity,
        isThread
          ? 'border-2 border-purple-500/50 hover:border-purple-500/80 bg-card'
          : isThreadView
            ? 'border-neon-green/60 bg-muted/60 ring-2 ring-neon-green/20'
            : isExpanded
              ? 'border-neon-green/40 bg-muted/90 ring-1 ring-neon-green/10'
              : 'border-border hover:border-neon-green/20 bg-card',

        // FIX: Lift card above siblings when menu is open to prevent dropdown clipping
        isContextMenuOpen ? "z-[60]" : "z-auto",

        comment.is_pinned
          ? 'border-neon-green/50 bg-neon-green/5 ring-1 ring-neon-green/20'
          : comment.is_highlighted
            ? 'border-yellow-500/50 bg-yellow-500/5 ring-1 ring-yellow-500/20'
            : ''
      )}
    >
      <CardContent className={cardPadding}>
        {/* Header Section */}
        <div className="flex items-start justify-between mb-3">
          {/* Left Side (User & Meta) */}
          <div className="flex items-start gap-3 flex-1">
            {/* Avatar linkeable */}
            <Link
              to={`/usuario/${author.alias || 'anonimo'}`}
              className="cursor-pointer z-10"
              onClick={(e) => e.stopPropagation()}
            >
              <Avatar className={cn(
                "h-8 w-8 sm:h-10 sm:w-10 border border-border group-hover:border-neon-green/40 transition-colors",
                isMe && "ring-2 ring-neon-green/20"
              )}>
                <AvatarImage src={author.avatarUrl} />
                <AvatarFallback>{getAvatarFallback(author.alias)}</AvatarFallback>
              </Avatar>
            </Link>

            <div className="flex-1 min-w-0">
              {/* Name Row */}
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {/* Alias linkeable */}
                <Link
                  to={`/usuario/${author.alias || 'anonimo'}`}
                  className="hover:underline z-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className={cn(
                    "font-semibold text-sm sm:text-base cursor-pointer",
                    // ✅ VISUAL LOGIC: Green if Real User
                    isReal ? "text-neon-green" : "text-foreground"
                  )}>
                    @{author.alias}
                  </span>
                </Link>

                {/* Contextual Role Badges */}
                {/* isAuthor comes from Author object context */}
                {author.isAuthor && (
                  <Badge className="bg-neon-green/10 text-neon-green border-neon-green/30 px-1.5 py-0 h-5 text-[10px] font-black tracking-tighter shadow-[0_0_10px_rgba(57,255,20,0.1)]">
                    AUTOR
                  </Badge>
                )}

                {comment.is_local && !author.isAuthor && (
                  <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 px-1.5 py-0 h-5 text-[10px] font-black tracking-tighter shadow-[0_0_10px_rgba(34,211,238,0.1)]">
                    VECINO LOCAL
                  </Badge>
                )}
              </div>

              {/* Badges Row (Visual Indicators) */}
              <div className="flex items-center gap-1 flex-wrap mb-1">
                {/* Thread Badge */}
                {isThread && (
                  <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 font-semibold">
                    💬 Hilo
                  </Badge>
                )}

                {/* Highlighted Badge */}
                {comment.is_highlighted && (
                  <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 flex items-center gap-1">
                    <Trophy className="h-3 w-3" />
                    Destacado
                  </Badge>
                )}

                {/* Pinned Badge */}
                {comment.is_pinned && (
                  <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                    <Pin className="h-3 w-3 mr-1" aria-hidden="true" />
                    Fijado
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
                {isEdited && (
                  <>
                    <span>•</span>
                    <span>(editado)</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Side (Context Menu) */}
          <div className="relative" ref={menuRef} onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleToggleMenu}
              aria-label="Más opciones de comentario"
              title="Más opciones"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </Button>

            {/* Context Menu Dropdown */}
            {isContextMenuOpen && (
              <>
                {/* Menu */}
                <div className="absolute right-0 top-8 z-50 w-48 bg-card border border-border rounded-lg shadow-xl py-1 transform transition-all duration-200 ease-out origin-top-right animate-in fade-in zoom-in-95">
                  {/* General User Actions */}
                  <button
                    onClick={handleCopyText}
                    className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-muted flex items-center gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    Copiar texto
                  </button>
                  <button
                    onClick={handleViewDirectLink}
                    className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-muted flex items-center gap-2"
                  >
                    <LinkIcon className="h-4 w-4" />
                    Link directo
                  </button>

                  {/* Flag Action (Non-owners) */}
                  {!isMe && (
                    <button
                      onClick={() => {
                        if (!comment.is_flagged) {
                          onFlag?.(comment.id, comment.is_flagged || false, author.id)
                          closeMenu()
                        }
                      }}
                      disabled={comment.is_flagged ?? false}
                      className={cn(
                        "w-full px-4 py-2 text-left text-sm flex items-center gap-2 hover:bg-muted",
                        comment.is_flagged ? "text-yellow-500 opacity-80 cursor-default" : "text-foreground hover:text-yellow-500"
                      )}
                    >
                      <Flag className={cn("h-4 w-4", comment.is_flagged && "fill-current")} />
                      {comment.is_flagged ? 'Reportado' : 'Reportar'}
                    </button>
                  )}

                  {/* Consolidated User/Admin Actions */}
                  {(canEdit || canModerate) && (
                    <>
                      <div className="border-t border-border my-1" />

                      {/* Edit (Strictly only for Author) */}
                      {canEdit && (
                        <button
                          onClick={() => {
                            onEdit?.(comment.id, comment.content)
                            closeMenu()
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-muted flex items-center gap-2"
                        >
                          <Edit className="h-4 w-4" />
                          Editar
                        </button>
                      )}

                      {/* Moderation Actions (Author or Mod) */}
                      {canModerate && (
                        <>
                          {/* Pin/Unpin (Report Owner or Mod only - though here isMod is the Report Owner) */}
                          {(canPin || isMod) && (
                            comment.is_pinned ? (
                              <button
                                onClick={() => {
                                  onUnpin?.(comment.id)
                                  closeMenu()
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-muted flex items-center gap-2"
                              >
                                <Pin className="h-4 w-4 rotate-45 transform" />
                                Desfijar
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  onPin?.(comment.id)
                                  closeMenu()
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-muted flex items-center gap-2"
                              >
                                <Pin className="h-4 w-4" />
                                Fijar
                              </button>
                            )
                          )}

                          {/* Delete */}
                          <button
                            onClick={() => {
                              onDelete?.(comment.id)
                              closeMenu()
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2"
                          >
                            <Trash2 className="h-4 w-4" />
                            Eliminar
                          </button>
                        </>
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
        <div className="flex items-center justify-between pt-3 border-t border-border">
          {/* Left Actions (Interactions) */}
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onReply?.(comment.id)}
              className={cn(
                "transition-all duration-200",
                isExpanded
                  ? "text-neon-green bg-neon-green/10"
                  : "text-foreground/60 hover:text-foreground"
              )}
              aria-label="Responder a este comentario"
            >
              <MessageCircle className={cn("h-4 w-4 mr-1", isExpanded && "fill-current")} aria-hidden="true" />
              {repliesCount > 0 && <span>{repliesCount}</span>}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLike}
              className={comment.liked_by_me ? "text-yellow-400 font-medium" : "text-foreground/60 hover:text-foreground"}
              aria-label={comment.liked_by_me ? `Quitar me gusta. Total: ${comment.upvotes_count}` : `Dar me gusta. Total: ${comment.upvotes_count}`}
            >
              <>
                <ThumbsUp className={`h-4 w-4 mr-1 ${comment.liked_by_me ? 'fill-current' : ''}`} aria-hidden="true" />
                {comment.upvotes_count > 0 && <span>{comment.upvotes_count}</span>}
              </>
            </Button>
          </div>

          {/* Right Actions moved to Context Menu */}
        </div>


        {/* Replies are now handled by CommentThread component recursively */}
      </CardContent>
    </Card >
  )
})
