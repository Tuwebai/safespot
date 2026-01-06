import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RichTextEditor } from '@/components/ui/LazyRichTextEditor'
import { CommentThread } from '@/components/comments/comment-thread'
import { ThreadList } from '@/components/comments/thread-list'
import { useCommentsManager } from '@/hooks/useCommentsManager'
import { getAnonymousIdSafe } from '@/lib/identity'
import { commentsApi } from '@/lib/api'
import { MessageCircle } from 'lucide-react'
import { SightingActions, SightingType } from './SightingActions'
import { SightingFormDialog } from './SightingFormDialog'
import { SightingCard, SightingData } from './SightingCard'
import { ReplyModal } from '@/components/comments/ReplyModal'
import { MentionParticipant } from '@/components/ui/tiptap-extensions/mention/suggestion'

// ============================================
// TYPES
// ============================================

export interface CommentsSectionProps {
    reportId: string
    totalCount: number
    onCommentCountChange: (delta: number) => void
    reportOwnerId?: string
    reportOwnerAlias?: string
    reportOwnerAvatar?: string
}

// ============================================
// COMPONENT
// ============================================

export function CommentsSection({
    reportId,
    totalCount,
    onCommentCountChange,
    reportOwnerId,
    reportOwnerAlias,
    reportOwnerAvatar
}: CommentsSectionProps) {
    const [viewMode, setViewMode] = useState<'comments' | 'threads'>('comments')
    const [sightingModalType, setSightingModalType] = useState<SightingType | null>(null)
    const [isSubmittingSighting, setIsSubmittingSighting] = useState(false)



    // Global state for comment context menus (only one can be open)
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null)

    const commentsManager = useCommentsManager({
        reportId,
        onCommentCountChange,
    })

    const {
        comments,
        commentText,
        replyText,
        editText,
        threadText,
        replyingTo,
        editingId,
        creatingThread,
        submitting,
        isProcessing,
        hasMore,
        isLoading,
        isLoadingMore,
        loadComments,
        loadMore,
        submitComment,
        submitReply,
        submitThread,
        submitEdit,
        deleteComment,
        flagComment,
        toggleLike,
        startReply,
        cancelReply,
        startEdit,
        cancelEdit,
        startThread,
        cancelThread,
        setCommentText,
        setReplyText,
        setEditText,
        setThreadText,
        pinComment,
        unpinComment,
    } = commentsManager

    // Load comments on mount
    useEffect(() => {
        loadComments()
    }, [loadComments])

    // Handle like change locally
    const handleLikeChange = useCallback((commentId: string, _liked: boolean, _newCount: number) => {
        toggleLike(commentId)
    }, [toggleLike])

    // Handle delete with confirmation
    const handleDeleteComment = useCallback(async (commentId: string) => {
        if (!confirm('¿Estás seguro de que quieres eliminar este comentario?')) return
        await deleteComment(commentId)
    }, [deleteComment])

    // Handle flag with confirmation
    const handleFlagComment = useCallback(async (commentId: string) => {
        if (!confirm('¿Estás seguro de que quieres reportar este comentario como inapropiado?')) return
        await flagComment(commentId)
    }, [flagComment])

    // Handle sighting submission
    const handleSightingSubmit = async (data: { zone: string, content: string, type: SightingType }) => {
        try {
            setIsSubmittingSighting(true)

            // Construct JSON payload for sighting
            const payload = JSON.stringify({
                type: 'sighting',
                subtype: data.type,
                data: {
                    zone: data.zone,
                    text: data.content
                }
            })

            await commentsApi.create({
                report_id: reportId,
                content: payload
            })

            // Refresh comments to show new sighting
            await loadComments()
            setSightingModalType(null)
        } catch (error) {
            console.error('Error submitting sighting:', error)
            alert('Error al enviar el reporte. Por favor intentá de nuevo.')
        } finally {
            setIsSubmittingSighting(false)
        }
    }

    const currentAnonymousId = getAnonymousIdSafe()


    // Split comments into Sightings and Discussion
    const { sightings, discussionComments } = useMemo(() => {
        const sightingsList: SightingData[] = []
        const discussionList: typeof comments = []

        comments.forEach(c => {
            try {
                // Peek content to see if it looks like JSON
                if (c.content.trim().startsWith('{')) {
                    const parsed = JSON.parse(c.content)
                    if (parsed.type === 'sighting') {
                        sightingsList.push({
                            id: c.id,
                            subtype: parsed.subtype,
                            data: parsed.data,
                            created_at: c.created_at
                        })
                        return // Skip adding to discussion
                    }
                }
            } catch {
                // Not JSON, treat as normal comment
            }
            discussionList.push(c)
        })

        return { sightings: sightingsList, discussionComments: discussionList }
    }, [comments])

    // Virtualization setup
    const listRef = useRef<HTMLDivElement>(null)
    const topLevelComments = useMemo(() =>
        discussionComments.filter(c => !c.parent_id && !(c.is_thread === true)),
        [discussionComments]
    )

    const rowVirtualizer = useWindowVirtualizer({
        count: topLevelComments.length,
        estimateSize: () => 150,
        overscan: 5,
        scrollMargin: listRef.current?.offsetTop ?? 0,
    })

    // Calculate unique participants for mention prioritization
    const participants = useMemo(() => {
        const uniqueEntries = new Map<string, MentionParticipant>()

        // Add report owner
        if (reportOwnerId && reportOwnerAlias) {
            uniqueEntries.set(reportOwnerId, {
                anonymous_id: reportOwnerId,
                alias: reportOwnerAlias,
                avatar_url: reportOwnerAvatar
            })
        }

        // Add all commenters
        comments.forEach(c => {
            if (c.alias) {
                uniqueEntries.set(c.anonymous_id, {
                    anonymous_id: c.anonymous_id,
                    alias: c.alias,
                    avatar_url: c.avatar_url
                })
            }
        })

        return Array.from(uniqueEntries.values())
    }, [comments, reportOwnerId, reportOwnerAlias, reportOwnerAvatar])

    // Find the comment being replied to for the modal
    const parentCommentToReply = useMemo(() =>
        replyingTo ? comments.find(c => c.id === replyingTo) || null : null
        , [replyingTo, comments])

    return (
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
                        className={viewMode === 'comments' ? 'bg-neon-green text-black' : 'border-border text-foreground'}
                    >
                        Comentarios
                    </Button>
                    <Button
                        variant={viewMode === 'threads' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('threads')}
                        className={viewMode === 'threads' ? 'bg-neon-green text-black' : 'border-border text-foreground'}
                    >
                        Hilos
                    </Button>
                </div>
            </div>

            {/* ACTIONABLE SIGHTINGS BUTTONS - Always visible in comments view */}
            {viewMode === 'comments' && (
                <SightingActions
                    onActionClick={setSightingModalType}
                    disabled={isSubmittingSighting}
                />
            )}

            {/* Add Comment Card - ONLY in comments view */}
            {viewMode === 'comments' && (
                <Card className="mb-6 bg-card border-border">
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
                            onSubmit={submitComment}
                            disabled={submitting === 'comment'}
                            prioritizedUsers={participants}
                        />
                    </CardContent>
                </Card>
            )}

            {/* Comments List */}
            {viewMode === 'comments' && (
                <div ref={listRef} className="space-y-4 min-h-[200px]">
                    {/* Render Sightings First */}
                    {sightings.length > 0 && (
                        <div className="mb-6 space-y-3">
                            {sightings.map(sighting => (
                                <SightingCard key={sighting.id} sighting={sighting} />
                            ))}
                            <div className="border-b border-border/50 my-4" />
                        </div>
                    )}

                    {isLoading && comments.length === 0 ? (
                        <div className="py-12 text-center text-muted-foreground">
                            Cargando comentarios...
                        </div>
                    ) : discussionComments.length === 0 && sightings.length === 0 ? (
                        <Card className="bg-card border-border">
                            <CardContent className="py-12 text-center">
                                <MessageCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                <p className="text-sm font-medium text-foreground mb-2">No hay comentarios aún</p>
                                <p className="text-xs text-muted-foreground">Sé el primero en comentar este reporte</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <>
                            <div
                                style={{
                                    height: `${rowVirtualizer.getTotalSize()}px`,
                                    width: '100%',
                                    position: 'relative',
                                }}
                            >
                                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                    const comment = topLevelComments[virtualRow.index]
                                    const isCommentOwner = comment.anonymous_id === currentAnonymousId

                                    return (
                                        <div
                                            key={virtualRow.key}
                                            data-index={virtualRow.index}
                                            ref={rowVirtualizer.measureElement}
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                transform: `translateY(${virtualRow.start}px)`,
                                            }}
                                            className="pb-4"
                                        >
                                            <CommentThread
                                                key={comment.id} // Important for React key reconciliation inside the virtual row
                                                comment={comment}
                                                allComments={comments} // Original comments array for threading context
                                                depth={0}
                                                onReply={startReply}
                                                onEdit={startEdit}
                                                onDelete={handleDeleteComment}
                                                onFlag={handleFlagComment}
                                                onLikeChange={handleLikeChange}
                                                isOwner={isCommentOwner}
                                                isMod={currentAnonymousId === reportOwnerId}
                                                onPin={pinComment}
                                                onUnpin={unpinComment}
                                                replyingTo={replyingTo}
                                                replyText={replyText}
                                                onReplyTextChange={setReplyText}
                                                onReplySubmit={submitReply}
                                                onReplyCancel={cancelReply}
                                                submittingReply={submitting === 'reply' && isProcessing(comment.id)}
                                                editingCommentId={editingId}
                                                editText={editText}
                                                onEditTextChange={setEditText}
                                                onEditSubmit={submitEdit}
                                                onEditCancel={cancelEdit}
                                                submittingEdit={submitting === 'edit' && isProcessing(comment.id)}
                                                activeMenuId={activeMenuId}
                                                onMenuOpen={setActiveMenuId}
                                            />
                                        </div>
                                    )
                                })}
                            </div>

                            {/* Load More Button & Counter */}
                            {hasMore && (
                                <div className="mt-6 space-y-3">
                                    <div className="text-center text-xs text-muted-foreground">
                                        Mostrando {comments.length} de {Math.max(comments.length, totalCount)} comentarios
                                    </div>
                                    <Button
                                        variant="outline"
                                        className="w-full h-12 text-base font-medium border-dashed border-border hover:border-neon-green hover:text-neon-green hover:bg-neon-green/5 transition-all"
                                        onClick={() => loadMore()}
                                        disabled={isLoadingMore}
                                    >
                                        {isLoadingMore ? (
                                            <div className="flex items-center gap-2">
                                                <div className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full" />
                                                <span>Cargando...</span>
                                            </div>
                                        ) : (
                                            'Cargar más comentarios'
                                        )}
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Threads View */}
            {viewMode === 'threads' && (
                <ThreadList
                    comments={discussionComments} // Show only discussion comments in threads view too? Or all? "discussionComments" roughly corresponds to user threads.
                    onNewThread={startThread}
                    onReply={startReply}
                    onEdit={startEdit}
                    onDelete={handleDeleteComment}
                    onFlag={handleFlagComment}
                    onLikeChange={handleLikeChange}
                    isOwner={(commentId) => {
                        const comment = comments.find(c => c.id === commentId)
                        return comment ? comment.anonymous_id === currentAnonymousId : false
                    }}
                    isMod={currentAnonymousId === reportOwnerId} // "Report Owner" logic
                    onPin={pinComment}
                    onUnpin={unpinComment}
                    editingCommentId={editingId}
                    editText={editText}
                    onEditTextChange={setEditText}
                    onEditSubmit={submitEdit}
                    onEditCancel={cancelEdit}
                    submittingEdit={submitting === 'edit'}
                    creatingThread={creatingThread}
                    threadText={threadText}
                    onThreadTextChange={setThreadText}
                    onThreadSubmit={submitThread}
                    onThreadCancel={cancelThread}
                    submittingThread={submitting === 'thread'}
                    replyingTo={replyingTo}
                    replyText={replyText}
                    onReplyTextChange={setReplyText}
                    onReplySubmit={submitReply}
                    onReplyCancel={cancelReply}
                    submittingReply={submitting === 'reply'}
                    activeMenuId={activeMenuId}
                    onMenuOpen={setActiveMenuId}
                />
            )}

            <SightingFormDialog
                isOpen={!!sightingModalType}
                type={sightingModalType}
                onClose={() => setSightingModalType(null)}
                onSubmit={handleSightingSubmit}
                submitting={isSubmittingSighting}
            />

            {/* Reply Modal (Twitter-style) */}
            <ReplyModal
                isOpen={!!replyingTo}
                onClose={cancelReply}
                parentComment={parentCommentToReply}
                replyText={replyText}
                onReplyTextChange={setReplyText}
                onReplySubmit={submitReply}
                submitting={submitting === 'reply'}
                prioritizedUsers={participants}
            />
        </div>
    )
}
