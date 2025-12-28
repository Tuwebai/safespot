import { memo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { RichTextEditor } from '@/components/ui/rich-text-editor'
import { EnhancedComment } from './enhanced-comment'
import { CornerDownRight } from 'lucide-react'
import type { Comment } from '@/lib/api'

interface CommentThreadProps {
    comment: Comment & {
        thread_type?: 'investigation' | 'evidence' | 'coordination' | 'testimony'
        priority?: 'urgent' | 'high' | 'medium' | 'low'
        is_pinned?: boolean
    }
    allComments: Comment[]
    depth?: number
    maxDepth?: number
    onReply?: (commentId: string) => void
    onEdit?: (commentId: string) => void
    onDelete?: (commentId: string) => void
    onFlag?: (commentId: string) => void
    onLikeChange?: (commentId: string, liked: boolean, newCount: number) => void
    onPin?: (commentId: string) => void
    onUnpin?: (commentId: string) => void
    isOwner?: boolean
    isMod?: boolean
    replyingTo?: string | null
    replyText?: string
    onReplyTextChange?: (text: string) => void
    onReplySubmit?: (parentId: string) => void
    onReplyCancel?: () => void
    submittingReply?: boolean
    editingCommentId?: string | null
    editText?: string
    onEditTextChange?: (text: string) => void
    onEditSubmit?: (commentId: string) => void
    onEditCancel?: () => void
    submittingEdit?: boolean
}

export const CommentThread = memo(function CommentThread({
    comment,
    allComments,
    depth = 0,
    maxDepth = 5,
    onReply,
    onEdit,
    onDelete,
    onFlag,
    onLikeChange,
    onPin,
    onUnpin,
    isOwner = false,
    isMod = false,
    replyingTo = null,
    replyText = '',
    onReplyTextChange,
    onReplySubmit,
    onReplyCancel,
    submittingReply = false,
    editingCommentId = null,
    editText = '',
    onEditTextChange,
    onEditSubmit,
    onEditCancel,
    submittingEdit = false
}: CommentThreadProps) {
    // Find direct replies to this comment
    const replies = allComments.filter(c => c.parent_id === comment.id)

    // Get parent comment for context (if this is a reply)
    const parentComment = comment.parent_id
        ? allComments.find(c => c.id === comment.parent_id)
        : undefined

    // Calculate indentation and visual adjustments based on depth
    const indentClass = depth > 0 ? `ml-${Math.min(depth * 6, 18)}` : ''

    // State for handling deep threads expansion
    const [isExpanded, setIsExpanded] = useState(false)

    // Determine if comments are too deep and should be hidden by default
    const isDeepThread = depth >= maxDepth && replies.length > 0

    // Show replies if:
    // 1. Not deep (standard behavior)
    // 2. OR Deep but user expanded explicitly
    const shouldShowReplies = replies.length > 0 && (!isDeepThread || isExpanded)

    return (
        <div className={`${indentClass} ${depth > 0 ? 'mt-3' : ''}`}>
            {/* Comment Card with Thread Line */}
            <div className={`relative ${depth > 0 ? 'pl-4 border-l-2 border-foreground/10' : ''}`}>
                {/* Thread indicator icon for nested comments */}
                {depth > 0 && (
                    <div className="absolute -left-3 top-6 bg-dark-bg px-1">
                        <CornerDownRight className="h-3 w-3 text-foreground/30" />
                    </div>
                )}

                {/* Context Badge: "Respondiendo a..." */}
                {depth > 0 && parentComment && (
                    <div className="mb-2 text-xs text-foreground/60 flex items-center gap-1 ml-1">
                        <span>Respondiendo a</span>
                        <span className="text-neon-green font-medium">
                            Usuario Anónimo {parentComment.anonymous_id.substring(0, 2).toUpperCase()}
                        </span>
                    </div>
                )}

                {/* Enhanced Comment Component */}
                <EnhancedComment
                    comment={comment}
                    replies={[]} // We handle replies recursively, so pass empty array
                    isOwner={isOwner}
                    isMod={isMod}
                    onReply={onReply}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onFlag={onFlag}
                    onLikeChange={onLikeChange}
                    onPin={onPin}
                    onUnpin={onUnpin}
                    depth={depth}
                />

                {/* Edit Editor (Inline) */}
                {editingCommentId === comment.id && onEditTextChange && onEditSubmit && onEditCancel && (
                    <Card className="mt-3 bg-dark-card border-dark-border">
                        <CardContent className="p-4">
                            <RichTextEditor
                                value={editText}
                                onChange={onEditTextChange}
                                onSubmit={() => onEditSubmit(comment.id)}
                                disabled={submittingEdit}
                                placeholder="Edita tu comentario..."
                                hideHelp={true}
                                showCancel={true}
                                onCancel={onEditCancel}
                            />
                        </CardContent>
                    </Card>
                )}

                {/* Reply Editor (Inline) */}
                {replyingTo === comment.id && onReplyTextChange && onReplySubmit && onReplyCancel && (
                    <Card className="mt-3 bg-dark-card border-dark-border border-neon-green/30">
                        <CardContent className="p-4">
                            <div className="mb-2 text-sm text-foreground/70 flex items-center gap-1">
                                <CornerDownRight className="h-3 w-3" />
                                <span>Respondiendo a</span>
                                <span className="text-neon-green font-medium">
                                    Usuario Anónimo {comment.anonymous_id.substring(0, 2).toUpperCase()}
                                </span>
                            </div>
                            <RichTextEditor
                                value={replyText}
                                onChange={onReplyTextChange}
                                onSubmit={() => onReplySubmit(comment.id)}
                                disabled={submittingReply}
                                placeholder="Escribe tu respuesta..."
                                hideHelp={true}
                                showCancel={true}
                                onCancel={onReplyCancel}
                            />
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Recursive Rendering of Replies */}
            {shouldShowReplies && (
                <div className="space-y-3 mt-3">
                    {replies.map((reply) => {
                        return (
                            <CommentThread
                                key={reply.id}
                                comment={reply}
                                allComments={allComments}
                                depth={depth + 1}
                                maxDepth={maxDepth}
                                onReply={onReply}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                onFlag={onFlag}
                                onLikeChange={onLikeChange}
                                onPin={onPin}
                                onUnpin={onUnpin}
                                isOwner={isOwner}
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
                            />
                        )
                    })}
                </div>
            )}

            {/* Collapsed state for very deep threads - Toggle Button */}
            {isDeepThread && (
                <div className={`ml-6 mt-2 ${isExpanded ? 'mb-4' : ''}`}>
                    <button
                        type="button"
                        onClick={() => setIsExpanded(prev => !prev)}
                        className="text-xs text-neon-green hover:underline focus:outline-none focus:ring-1 focus:ring-neon-green rounded px-1 transition-colors"
                        aria-expanded={isExpanded}
                    >
                        {isExpanded
                            ? 'Ocultar respuestas'
                            : `Ver ${replies.length} ${replies.length === 1 ? 'respuesta más' : 'respuestas más'}`
                        }
                    </button>
                </div>
            )}
        </div>
    )
})
