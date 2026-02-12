import { useEffect, useState, useCallback, useMemo, lazy, Suspense, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RichTextEditor } from '@/components/ui/LazyRichTextEditor'
import { CommentThread } from '@/components/comments/comment-thread'
import { ThreadList } from '@/components/comments/thread-list'
import { useCommentsManager } from '@/hooks/useCommentsManager'

import { MessageCircle, ChevronDown } from 'lucide-react'
import { SightingType } from './SightingActions'
import { SightingFormDialog } from './SightingFormDialog'
import { SightingCard, SightingData } from './SightingCard'
import type { MentionParticipant } from '@/lib/tiptap/mention-suggestion'
import { useConfirm } from '@/components/ui/useConfirm'
// 🔴 CRITICAL FIX: Import mutation to replace direct API bypass
import { useCreateCommentMutation } from '@/hooks/queries/useCommentsQuery'
import { getCurrentUserId } from '@/lib/permissions'

// ✅ PERFORMANCE FIX: Lazy load ReplyModal (193 KB) - only loads when user opens modal
const ReplyModal = lazy(() => import('@/components/comments/ReplyModal').then(m => ({ default: m.ReplyModal })))

// ============================================
// TYPES
// ============================================

export interface CommentsSectionProps {
    reportId: string
    totalCount: number
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
    reportOwnerId,
    reportOwnerAlias,
    reportOwnerAvatar
}: CommentsSectionProps) {
    const [viewMode, setViewMode] = useState<'comments' | 'threads'>('comments')
    const [sightingModalType, setSightingModalType] = useState<SightingType | null>(null)
    const [isSubmittingSighting, setIsSubmittingSighting] = useState(false)
    
    // 🏛️ EXPANDIBLE COMMENT FORM: Colapsado por defecto en mobile, expandido en desktop
    const [isCommentFormExpanded, setIsCommentFormExpanded] = useState(() => {
        // Default: collapsed on mobile (< 640px), expanded on desktop
        if (typeof window !== 'undefined') {
            return window.innerWidth >= 640
        }
        return true
    })
    const editorRef = useRef<HTMLDivElement>(null)

    // 🔴 CRITICAL FIX: Use protected mutation instead of direct API call
    const { mutateAsync: createComment } = useCreateCommentMutation()

    // Global state for comment context menus (only one can be open)
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
    const { confirm } = useConfirm()

    const commentsManager = useCommentsManager({
        reportId,
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
    
    // 🏛️ EXPANDIBLE: Auto-focus editor when expanded and handle resize
    useEffect(() => {
        const handleResize = () => {
            // Only auto-update on resize if user hasn't manually interacted
            if (typeof window !== 'undefined') {
                const shouldBeExpanded = window.innerWidth >= 640
                setIsCommentFormExpanded(prev => {
                    // Don't change if there's text (user is typing)
                    if (commentText && commentText.length > 0) return prev
                    return shouldBeExpanded
                })
            }
        }
        
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [commentText])
    
    // 🏛️ EXPANDIBLE: Scroll into view and focus when expanded
    useEffect(() => {
        if (isCommentFormExpanded && editorRef.current) {
            // Small delay to allow animation to start
            setTimeout(() => {
                editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            }, 100)
        }
    }, [isCommentFormExpanded])

    // Handle like change locally
    const handleLikeChange = useCallback((commentId: string, liked: boolean, _newCount: number) => {
        toggleLike(commentId, liked)
    }, [toggleLike])

    // Handle delete with confirmation
    const handleDeleteComment = useCallback(async (commentId: string) => {
        if (!await confirm({
            title: '¿Eliminar comentario?',
            description: '¿Estás seguro de que quieres eliminar este comentario?',
            confirmText: 'Eliminar',
            variant: 'danger'
        })) return
        await deleteComment(commentId)
    }, [deleteComment, confirm])

    // Handle flag with confirmation
    const handleFlagComment = useCallback(async (commentId: string, isFlagged: boolean, ownerId: string) => {
        if (!await confirm({
            title: '¿Reportar comentario?',
            description: '¿Estás seguro de que quieres reportar este comentario como inapropiado?',
            confirmText: 'Reportar',
            variant: 'danger'
        })) return
        await flagComment(commentId, isFlagged, ownerId)
    }, [flagComment, confirm])

    // 🔴 CRITICAL FIX: Sighting submission now uses protected mutation
    // Anonymous users will see auth modal automatically via useAuthGuard in the mutation
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

            // ✅ ENTERPRISE FIX: Use protected mutation instead of direct API call
            // This ensures auth guard is applied (anonymous users see modal)
            await createComment({
                report_id: reportId,
                content: payload
            })

            // Refresh comments to show new sighting
            await loadComments()
            setSightingModalType(null)
        } catch (error) {
            // Handle AUTH_REQUIRED silently (modal already shown)
            if (error instanceof Error && error.message === 'AUTH_REQUIRED') {
                // User canceled auth, just close the sighting modal
                setSightingModalType(null)
                return
            }

            console.error('Error submitting sighting:', error)
            alert('Error al enviar el reporte. Por favor intentá de nuevo.')
        } finally {
            setIsSubmittingSighting(false)
        }
    }

    const currentUserId = getCurrentUserId()


    const { sightings, discussionComments } = useMemo(() => {
        const sightingsList: SightingData[] = []
        const discussionList: typeof comments = []


        comments.forEach(c => {
            try {
                // Peek content to see if it looks like JSON
                if (c.content && typeof c.content === 'string' && c.content.trim().startsWith('{')) {
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
            } catch (err) {
                // Ignore parsing errors for non-JSON comments
            }
            discussionList.push(c)
        })

        return { sightings: sightingsList, discussionComments: discussionList }
    }, [comments])

    const topLevelComments = useMemo(() => {
        const filtered = discussionComments.filter(c => !c.parent_id && !(c.is_thread === true));
        return filtered;
    }, [discussionComments])

    // Simplified list rendering (removing virtualization for stability)

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
            if (c.author.alias) {
                uniqueEntries.set(c.author.id, {
                    anonymous_id: c.author.id,
                    alias: c.author.alias,
                    avatar_url: c.author.avatarUrl
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
            {/* Header Row - Responsive */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground">
                    Comentarios <span className="text-sm sm:text-lg text-muted-foreground">({totalCount})</span>
                </h2>
                {/* View Toggle */}
                <div className="flex items-center space-x-2">
                    <Button
                        variant={viewMode === 'comments' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('comments')}
                        className={`text-xs sm:text-sm h-8 ${viewMode === 'comments' ? 'bg-neon-green text-black' : 'border-border text-foreground'}`}
                    >
                        Comentarios
                    </Button>
                    <Button
                        variant={viewMode === 'threads' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('threads')}
                        className={`text-xs sm:text-sm h-8 ${viewMode === 'threads' ? 'bg-neon-green text-black' : 'border-border text-foreground'}`}
                    >
                        Hilos
                    </Button>
                </div>
            </div>

            {/* Add Comment Card - Collapsible (ONLY in comments view) */}
            {viewMode === 'comments' && (
                <Card 
                    className={`mb-6 bg-card border-border transition-all duration-300 ease-in-out overflow-hidden ${
                        isCommentFormExpanded ? 'shadow-md' : 'shadow-sm hover:shadow-md'
                    }`}
                >
                    {/* 🏛️ COLLAPSIBLE HEADER: Clickable to toggle */}
                    <CardHeader 
                        className={`cursor-pointer select-none transition-colors duration-200 ${
                            isCommentFormExpanded ? 'pb-4' : 'pb-0'
                        }`}
                        onClick={() => {
                            // 🏛️ ALWAYS allow manual toggle - user can collapse/expand anytime
                            // Content is preserved in state, never lost
                            setIsCommentFormExpanded(!isCommentFormExpanded)
                        }}
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                                <CardTitle className="font-semibold text-base sm:text-lg flex items-center gap-2">
                                    <MessageCircle className="h-5 w-5 text-primary" />
                                    {isCommentFormExpanded || (commentText && commentText.length > 0) 
                                        ? 'Agregar Comentario' 
                                        : 'Escribe un comentario...'}
                                </CardTitle>
                                <CardDescription className={`text-xs sm:text-sm text-muted-foreground transition-all duration-300 ${
                                    isCommentFormExpanded ? 'mt-1 opacity-100 max-h-10' : 'mt-0 opacity-0 max-h-0 overflow-hidden'
                                }`}>
                                    Comparte información útil sobre este reporte con formato enriquecido
                                </CardDescription>
                            </div>
                            {/* Chevron indicator with rotation animation */}
                            <div className={`ml-4 p-2 rounded-full transition-all duration-300 hover:bg-muted ${
                                isCommentFormExpanded ? 'rotate-180' : 'rotate-0'
                            }`}>
                                <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            </div>
                        </div>
                    </CardHeader>
                    
                    {/* 🏛️ EXPANDABLE CONTENT: Rich Text Editor */}
                    <div className={`transition-all duration-300 ease-in-out ${
                        isCommentFormExpanded 
                            ? 'max-h-[600px] opacity-100' 
                            : 'max-h-0 opacity-0 overflow-hidden'
                    }`}>
                        <CardContent className="pt-0" ref={editorRef}>
                            <RichTextEditor
                                value={commentText}
                                onChange={setCommentText}
                                onSubmit={submitComment}
                                disabled={submitting === 'comment'}
                                prioritizedUsers={participants}
                                autoFocus={isCommentFormExpanded}
                            />
                        </CardContent>
                    </div>
                </Card>
            )}

            {/* Comments List */}
            {viewMode === 'comments' && (
                <div className="space-y-4 min-h-[200px]">
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
                            <div className="space-y-4">
                                {topLevelComments.map((comment) => (
                                    <div key={comment.id} className="pb-4">
                                        <CommentThread
                                            comment={comment}
                                            allComments={comments}
                                            depth={0}
                                            onReply={startReply}
                                            onEdit={startEdit}
                                            onDelete={handleDeleteComment}
                                            onFlag={handleFlagComment}
                                            onLikeChange={handleLikeChange}
                                            // ✅ SSOT: Ownership se calcula internamente en EnhancedComment vía useIsOwner
                                            // No pasar isOwner aquí para evitar doble fuente de verdad
                                            isMod={currentUserId === reportOwnerId}
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
                                ))}
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
                    // isOwner prop removed (handled internally by ThreadList -> CommentThread)
                    isMod={currentUserId === reportOwnerId} // "Report Owner" logic
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

            {/* Reply Modal (Twitter-style) - Lazy loaded */}
            {replyingTo && (
                <Suspense fallback={null}>
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
                </Suspense>
            )}
        </div>
    )
}
