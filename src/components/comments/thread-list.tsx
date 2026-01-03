import { useState, memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { RichTextEditor } from '@/components/ui/LazyRichTextEditor'
import { CommentThread } from './comment-thread'
import { Search, Plus } from 'lucide-react'
import type { Comment } from '@/lib/api'

interface ThreadListProps {
  comments: Comment[]
  onNewThread?: () => void
  onReply?: (commentId: string) => void
  onEdit?: (commentId: string) => void
  onDelete?: (commentId: string) => void
  onFlag?: (commentId: string) => void
  onLikeChange?: (commentId: string, liked: boolean, newCount: number) => void
  isOwner?: (commentId: string) => boolean
  isMod?: boolean
  editingCommentId?: string | null
  editText?: string
  onEditTextChange?: (text: string) => void
  onEditSubmit?: (commentId: string) => void
  onEditCancel?: () => void
  submittingEdit?: boolean
  creatingThread?: boolean
  threadText?: string
  onThreadTextChange?: (text: string) => void
  onThreadSubmit?: () => void
  onThreadCancel?: () => void
  submittingThread?: boolean
  replyingTo?: string | null
  replyText?: string
  onReplyTextChange?: (text: string) => void
  onReplySubmit?: (parentId: string) => void
  onReplyCancel?: () => void
  submittingReply?: boolean
}

type ThreadType = 'all' | 'investigation' | 'evidence' | 'coordination' | 'testimony'
type SortOrder = 'newest' | 'oldest' | 'most_replies' | 'priority'

export const ThreadList = memo(function ThreadList({
  comments,
  onNewThread,
  onReply,
  onEdit,
  onDelete,
  onFlag,
  onLikeChange,
  isOwner = () => false,
  isMod = false,
  editingCommentId = null,
  editText = '',
  onEditTextChange,
  onEditSubmit,
  onEditCancel,
  submittingEdit = false,
  creatingThread = false,
  threadText = '',
  onThreadTextChange,
  onThreadSubmit,
  onThreadCancel,
  submittingThread = false,
  replyingTo = null,
  replyText = '',
  onReplyTextChange,
  onReplySubmit,
  onReplyCancel,
  submittingReply = false,
  activeMenuId,
  onMenuOpen
}: ThreadListProps & { activeMenuId?: string | null; onMenuOpen?: (id: string | null) => void }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [threadType, setThreadType] = useState<ThreadType>('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')

  // Filtrar solo hilos (is_thread = true y parent_id IS NULL)
  const threads = comments.filter(c => c.is_thread === true && !c.parent_id)
  const repliesMap = new Map<string, Comment[]>()

  comments.forEach(comment => {
    if (comment.parent_id) {
      const parentId = comment.parent_id
      if (!repliesMap.has(parentId)) {
        repliesMap.set(parentId, [])
      }
      repliesMap.get(parentId)!.push(comment)
    }
  })

  // Filtrar y ordenar
  let filteredComments = threads

  // Filtrar por búsqueda
  if (searchTerm) {
    filteredComments = filteredComments.filter(c =>
      c.content.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }

  // Ordenar
  filteredComments = [...filteredComments].sort((a, b) => {
    switch (sortOrder) {
      case 'newest':
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      case 'oldest':
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      case 'most_replies': {
        const aReplies = repliesMap.get(a.id)?.length || 0
        const bReplies = repliesMap.get(b.id)?.length || 0
        return bReplies - aReplies
      }
      case 'priority': {
        // Por ahora, ordenar por upvotes
        return (b.upvotes_count || 0) - (a.upvotes_count || 0)
      }
      default:
        return 0
    }
  })

  // Calcular estadísticas
  // Calcular estadísticas (solo de hilos y sus respuestas)
  const threadRelatedComments = new Set<string>() // IDs of comments in threads
  const threadParticipants = new Set<string>()
  let lastThreadActivity = 0

  // 1. Start with thread roots
  threads.forEach(t => {
    threadRelatedComments.add(t.id)
    threadParticipants.add(t.anonymous_id)
    const tTime = new Date(t.created_at).getTime()
    if (tTime > lastThreadActivity) lastThreadActivity = tTime
  })

  // 2. Process descendants (using repliesMap which is already built)
  // We need to traverse because repliesMap is keyed by parentID
  const processReplies = (parentId: string) => {
    const replies = repliesMap.get(parentId) || []
    replies.forEach(r => {
      threadRelatedComments.add(r.id)
      threadParticipants.add(r.anonymous_id)
      const rTime = new Date(r.created_at).getTime()
      if (rTime > lastThreadActivity) lastThreadActivity = rTime

      // Recurse
      processReplies(r.id)
    })
  }

  threads.forEach(t => processReplies(t.id))

  const stats = {
    threads: threads.length,
    participants: threadParticipants.size,
    lastActivity: lastThreadActivity > 0
      ? new Date(lastThreadActivity).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : 'N/A'
  }

  return (
    <div className="space-y-4">
      {/* Control Header */}
      <Card className="bg-dark-card border-dark-border">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <CardTitle>Hilos de Conversación</CardTitle>
            {onNewThread && (
              <Button
                onClick={onNewThread}
                className="bg-neon-green text-dark-bg hover:bg-neon-green/90"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Hilo
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Controls Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar en hilos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filters */}
            <Select
              value={threadType}
              onChange={(e) => setThreadType(e.target.value as ThreadType)}
            >
              <option value="all">Todos los tipos</option>
              <option value="investigation">Investigación</option>
              <option value="evidence">Evidencia</option>
              <option value="coordination">Coordinación</option>
              <option value="testimony">Testimonio</option>
            </Select>

            {/* Sort */}
            <Select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
            >
              <option value="newest">Más recientes</option>
              <option value="oldest">Más antiguos</option>
              <option value="most_replies">Más respuestas</option>
              <option value="priority">Prioridad</option>
            </Select>
          </div>

          {/* Stats Row */}
          <div className="flex items-center gap-6 text-sm text-foreground/60 pt-2 border-t border-dark-border">
            <div>
              <span className="font-medium text-foreground">{stats.threads}</span> hilos
            </div>
            <div>
              <span className="font-medium text-foreground">{stats.participants}</span> participantes
            </div>
            <div>
              Última actividad: <span className="font-medium text-foreground">{stats.lastActivity}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* New Thread Editor */}
      {creatingThread && onThreadTextChange && onThreadSubmit && onThreadCancel && (
        <Card className="bg-dark-card border-dark-border border-2 border-neon-green/30">
          <CardHeader>
            <CardTitle className="text-neon-green">Nuevo Hilo</CardTitle>
          </CardHeader>
          <CardContent>
            <RichTextEditor
              value={threadText}
              onChange={onThreadTextChange}
              onSubmit={onThreadSubmit}
              disabled={submittingThread}
              placeholder="Escribe el contenido de tu nuevo hilo..."
              hideHelp={true}
              showCancel={true}
              onCancel={onThreadCancel}
            />
          </CardContent>
        </Card>
      )}

      {/* Thread Rendering */}
      <div className="space-y-4">
        {filteredComments.length === 0 ? (
          <Card className="bg-dark-card border-dark-border">
            <CardContent className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                {searchTerm ? 'No se encontraron hilos con esa búsqueda' : 'No hay hilos aún'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredComments.map((comment) => {
            const isThreadOwner = isOwner(comment.id)

            return (
              <CommentThread
                key={comment.id}
                comment={comment}
                allComments={comments}
                depth={0}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
                onFlag={onFlag}
                onLikeChange={onLikeChange}
                isOwner={isThreadOwner}
                isMod={isMod}
                replyingTo={replyingTo}
                replyText={replyText}
                onReplyTextChange={onReplyTextChange}
                onReplySubmit={onReplySubmit}
                onReplyCancel={onReplyCancel}
                submittingReply={submittingReply}
                editingCommentId={editingCommentId}
                editText={editText}
                onEditTextChange={onEditTextChange}
                onEditSubmit={onEditSubmit}
                onEditCancel={onEditCancel}
                submittingEdit={submittingEdit}
                activeMenuId={activeMenuId}
                onMenuOpen={onMenuOpen}
              />
            )
          })
        )}
      </div>
    </div>
  )
})
