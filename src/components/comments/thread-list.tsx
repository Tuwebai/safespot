import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { EnhancedComment } from './enhanced-comment'
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
}

type ThreadType = 'all' | 'investigation' | 'evidence' | 'coordination' | 'testimony'
type SortOrder = 'newest' | 'oldest' | 'most_replies' | 'priority'

export function ThreadList({
  comments,
  onNewThread,
  onReply,
  onEdit,
  onDelete,
  onFlag,
  onLikeChange,
  isOwner = () => false,
  isMod = false
}: ThreadListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [threadType, setThreadType] = useState<ThreadType>('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')

  // Agrupar comentarios por parentId (los que no tienen parentId son top-level)
  const topLevelComments = comments.filter(c => !c.parent_id)
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
  let filteredComments = topLevelComments

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
      case 'most_replies':
        const aReplies = repliesMap.get(a.id)?.length || 0
        const bReplies = repliesMap.get(b.id)?.length || 0
        return bReplies - aReplies
      case 'priority':
        // Por ahora, ordenar por upvotes
        return (b.upvotes_count || 0) - (a.upvotes_count || 0)
      default:
        return 0
    }
  })

  // Calcular estadísticas
  const stats = {
    threads: filteredComments.length,
    participants: new Set(comments.map(c => c.anonymous_id)).size,
    lastActivity: comments.length > 0 
      ? new Date(Math.max(...comments.map(c => new Date(c.created_at).getTime()))).toLocaleDateString('es-AR')
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
          filteredComments.map((comment) => (
            <EnhancedComment
              key={comment.id}
              comment={comment}
              replies={repliesMap.get(comment.id) || []}
              isOwner={isOwner(comment.id)}
              isMod={isMod}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              onFlag={onFlag}
              onLikeChange={onLikeChange}
            />
          ))
        )}
      </div>
    </div>
  )
}

