import { useMemo, useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, MessageCircle } from 'lucide-react'
import { useCommentsManager } from '@/hooks/useCommentsManager'
import { CommentThread } from '@/components/comments/comment-thread'
import { EnhancedComment } from '@/components/comments/enhanced-comment'
import { useReportDetail } from '@/hooks/useReportDetail'
import { getAnonymousIdSafe } from '@/lib/identity'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { RichTextEditor } from '@/components/ui/LazyRichTextEditor'
import { ReplyModal } from '@/components/comments/ReplyModal'

export function ThreadPage() {
    const { reportId, commentId } = useParams<{ reportId: string; commentId: string }>()
    const navigate = useNavigate()

    // 1. Fetch Report Detail (for SEO/Context)
    useReportDetail({ reportId })

    // 2. Fetch All Comments for this report
    // (Reusing manager logic - we fetch all to have full context for ancestors/descendants)
    const commentsManager = useCommentsManager({
        reportId,
    })

    const {
        comments,
        isLoading,
        loadComments,
        replyText,
        setReplyText,
        submitReply,
        submitting,
        isProcessing,
        startReply,
        replyingTo,
        cancelReply,
        toggleLike,
        startEdit,
        editingId,
        editText,
        setEditText,
        submitEdit,
        cancelEdit,
        deleteComment,
        flagComment
    } = commentsManager

    // State for menu management
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

    useEffect(() => {
        loadComments()
    }, [loadComments])

    // 3. Identify the "Focus Comment" and its Lineage
    const { focusComment, ancestors } = useMemo(() => {
        if (!comments.length || !commentId) return { focusComment: null, ancestors: [] }

        const target = comments.find(c => c.id === commentId)
        if (!target) return { focusComment: null, ancestors: [] }

        const list: any[] = []
        let current = target

        // Trace back to root
        while (current.parent_id) {
            const parent = comments.find(c => c.id === current.parent_id)
            if (parent) {
                list.unshift(parent)
                current = parent
            } else {
                break
            }
        }

        return { focusComment: target, ancestors: list }
    }, [comments, commentId])

    // Find the comment being replied to for the modal
    const parentCommentToReply = useMemo(() =>
        replyingTo ? comments.find(c => c.id === replyingTo) || null : null
        , [replyingTo, comments])

    const currentAnonymousId = getAnonymousIdSafe()

    // 4. Handlers
    const handleLikeChange = useCallback((id: string, liked: boolean, _count: number) => {
        toggleLike(id, liked)
    }, [toggleLike])

    const handleDelete = useCallback(async (id: string) => {
        if (confirm('¿Estás seguro de que quieres eliminar este comentario?')) {
            await deleteComment(id)
            if (id === commentId) navigate(`/reporte/${reportId}`)
        }
    }, [deleteComment, commentId, reportId, navigate])

    const handleFlag = useCallback(async (id: string, isFlagged: boolean, ownerId: string) => {
        if (confirm('¿Reportar como inapropiado?')) {
            await flagComment(id, isFlagged, ownerId)
        }
    }, [flagComment])

    if (isLoading) {
        return (
            <div className="container mx-auto max-w-2xl p-8 text-center text-muted-foreground">
                Cargando hilo...
            </div>
        )
    }

    if (!focusComment) {
        return (
            <div className="container mx-auto max-w-2xl p-8 text-center">
                <p className="text-muted-foreground mb-4">No se pudo encontrar el hilo solicitado.</p>
                <Button onClick={() => navigate(`/reporte/${reportId}`)}>
                    Volver al reporte
                </Button>
            </div>
        )
    }

    return (
        <ErrorBoundary fallbackTitle="Error al cargar el hilo">
            <Helmet>
                <title>Hilo de @{focusComment.alias || 'Anónimo'} – SafeSpot</title>
            </Helmet>

            <div className="min-h-screen bg-background pb-20">
                <div className="container mx-auto max-w-2xl px-4 py-6">

                    {/* Header */}
                    <div className="flex items-center gap-4 mb-6 pt-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(-1)}
                            className="hover:bg-muted"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <h1 className="text-xl font-bold">Post</h1>
                    </div>

                    <div className="space-y-4">
                        {/* 1. Ancestors Lineage (Timeline style) */}
                        {ancestors.map((ancestor) => (
                            <div key={ancestor.id} className="relative pl-0">
                                <EnhancedComment
                                    comment={ancestor}
                                    isOwner={ancestor.anonymous_id === currentAnonymousId}
                                    onLikeChange={handleLikeChange}
                                    onEdit={startEdit}
                                    onDelete={handleDelete}
                                    onFlag={handleFlag}
                                    onReply={startReply}
                                    activeMenuId={activeMenuId}
                                    onMenuOpen={setActiveMenuId}
                                />
                                {/* Visual Connector to next item */}
                                <div className="absolute left-[23px] sm:left-[27px] top-[48px] bottom-[-16px] w-[2px] bg-foreground/10 z-0" />
                            </div>
                        ))}

                        {/* 2. FOCUS COMMENT (The big one) */}
                        <div id="focus-comment" className="relative z-10">
                            <EnhancedComment
                                comment={focusComment}
                                isOwner={focusComment.anonymous_id === currentAnonymousId}
                                isThreadView={true}
                                onLikeChange={handleLikeChange}
                                onEdit={startEdit}
                                onDelete={handleDelete}
                                onFlag={handleFlag}
                                onReply={startReply}
                                activeMenuId={activeMenuId}
                                onMenuOpen={setActiveMenuId}
                            />
                        </div>

                        {/* 3. Reply Box (Always visible under focus if replying) */}
                        <Card className="bg-card border-border border-neon-green/20">
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                                    <MessageCircle className="h-3 w-3" />
                                    <span>Publicar tu respuesta</span>
                                </div>
                                <RichTextEditor
                                    value={replyText}
                                    onChange={setReplyText}
                                    onSubmit={() => submitReply(focusComment.id)}
                                    disabled={submitting === 'reply'}
                                    placeholder="Postea tu respuesta"
                                />
                            </CardContent>
                        </Card>

                        {/* 4. Direct Replies Subtree */}
                        <div className="mt-8">
                            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4 ml-1">
                                Respuestas
                            </h3>
                            <div className="space-y-4">
                                {comments
                                    .filter(c => c.parent_id === focusComment.id)
                                    .map(reply => (
                                        <CommentThread
                                            key={reply.id}
                                            comment={reply}
                                            allComments={comments}
                                            depth={0}
                                            initialExpanded={true}
                                            onReply={startReply}
                                            onLikeChange={handleLikeChange}
                                            onDelete={handleDelete}
                                            onFlag={handleFlag}
                                            onEdit={startEdit}
                                            isOwner={reply.anonymous_id === currentAnonymousId}
                                            replyingTo={replyingTo}
                                            replyText={replyText}
                                            onReplyTextChange={setReplyText}
                                            onReplySubmit={submitReply}
                                            onReplyCancel={cancelReply}
                                            submittingReply={submitting === 'reply' && isProcessing(reply.id)}
                                            editingCommentId={editingId}
                                            editText={editText}
                                            onEditTextChange={setEditText}
                                            onEditSubmit={submitEdit}
                                            onEditCancel={cancelEdit}
                                            submittingEdit={submitting === 'edit' && isProcessing(reply.id)}
                                            activeMenuId={activeMenuId}
                                            onMenuOpen={setActiveMenuId}
                                        />
                                    ))
                                }
                                {comments.filter(c => c.parent_id === focusComment.id).length === 0 && (
                                    <div className="py-8 text-center text-muted-foreground text-sm italic">
                                        No hay respuestas aún. Cuéntanos qué piensas.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Reply Modal (Twitter-style) */}
                <ReplyModal
                    isOpen={!!replyingTo}
                    onClose={cancelReply}
                    parentComment={parentCommentToReply}
                    replyText={replyText}
                    onReplyTextChange={setReplyText}
                    onReplySubmit={submitReply}
                    submitting={submitting === 'reply'}
                />
            </div>
        </ErrorBoundary>
    )
}
