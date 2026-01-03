import { memo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { RichTextEditor } from '@/components/ui/LazyRichTextEditor'
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
    initialExpanded?: boolean
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
    activeMenuId?: string | null
    onMenuOpen?: (id: string | null) => void
}

export const CommentThread = memo(function CommentThread({
    comment,
    allComments,
    depth = 0,
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
    submittingEdit = false,
    activeMenuId,
    onMenuOpen,
    initialExpanded = false,
}: CommentThreadProps) {
    // Find direct replies to this comment and sort them chronologically (oldest first)
    const replies = allComments
        .filter(c => c.parent_id === comment.id)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    // Get parent comment for context (if this is a reply)
    const parentComment = comment.parent_id
        ? allComments.find(c => c.id === comment.parent_id)
        : undefined

    // Calculate indentation and visual adjustments based on depth
    const indentClass = depth > 0 ? `ml-${Math.min(depth * 6, 18)}` : ''

    // State for handling accordion expansion - Hidden by default (Twitter style)
    const [isExpanded, setIsExpanded] = useState(initialExpanded)

    // Show replies if user expanded explicitly via the counter
    const shouldShowReplies = replies.length > 0 && isExpanded

    return (
        <div className={`${indentClass} ${depth > 0 ? 'mt-3' : ''}`}>
            {/* Comment Card with Thread Line */}
            <div className={`relative ${depth > 0 ? 'pl-4 border-l-2 border-foreground/10' : ''}`}>
                {/* Thread indicator icon for nested comments */}
                {depth > 0 && (
                    <div className="absolute -left-3 top-6 bg-background px-1">
                        <CornerDownRight className="h-3 w-3 text-foreground/30" />
                    </div>
                )}

                {/* Context Badge: "Respondiendo a..." */}
                {depth > 0 && parentComment && (
                    <div className="mb-2 text-xs text-foreground/60 flex items-center gap-1 ml-1">
                        <span>Respondiendo a</span>
                        <span className="text-neon-green font-medium">
                            {parentComment.alias ? `@${parentComment.alias}` : `Usuario Anónimo ${parentComment.anonymous_id.substring(0, 2).toUpperCase()}`}
                        </span>
                    </div>
                )}

                {/* Enhanced Comment Component: Navigates on root (depth 0), Accordion on nested (depth > 0) */}
                <EnhancedComment
                    comment={comment}
                    repliesCount={replies.length}
                    isExpanded={isExpanded}
                    onToggleReplies={depth > 0 ? () => setIsExpanded(!isExpanded) : undefined}
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
                    activeMenuId={activeMenuId}
                    onMenuOpen={onMenuOpen}
                />

                {/* Editors (Inline) */}
                {editingCommentId === comment.id && onEditTextChange && onEditSubmit && onEditCancel && (
                    <Card className="mt-3 bg-card border-border">
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
                    <Card className="mt-3 bg-card border-border border-neon-green/30">
                        <CardContent className="p-4">
                            <div className="mb-2 text-sm text-foreground/70 flex items-center gap-1">
                                <CornerDownRight className="h-3 w-3" />
                                <span>Respondiendo a</span>
                                <span className="text-neon-green font-medium">
                                    {comment.alias ? `@${comment.alias}` : `Usuario Anónimo ${comment.anonymous_id.substring(0, 2).toUpperCase()}`}
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

            {/* Recursive Rendering of Replies - Hidden behind accordion */}
            {shouldShowReplies && (
                <div className="space-y-3 mt-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    {replies.map((reply) => {
                        return (
                            <CommentThread
                                key={reply.id}
                                comment={reply}
                                allComments={allComments}
                                depth={depth + 1}
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
                                activeMenuId={activeMenuId}
                                onMenuOpen={onMenuOpen}
                            />
                        )
                    })}
                </div>
            )}
        </div>
    )
})
