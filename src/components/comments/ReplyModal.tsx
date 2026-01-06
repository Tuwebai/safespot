import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar"
import { RichTextEditor } from '@/components/ui/LazyRichTextEditor'
import { getPlainTextFromTipTap } from '@/lib/tiptap-content'
import { useProfileQuery } from '@/hooks/queries/useProfileQuery'
import { getAnonymousIdSafe } from '@/lib/identity'
import { getAvatarUrl } from '@/lib/avatar'
import type { Comment } from '@/lib/api'

import { MentionParticipant } from '@/components/ui/tiptap-extensions/mention/suggestion'

interface ReplyModalProps {
    isOpen: boolean
    onClose: () => void
    parentComment: Comment | null
    replyText: string
    onReplyTextChange: (text: string) => void
    onReplySubmit: (parentId: string) => void
    submitting: boolean
    prioritizedUsers?: MentionParticipant[]
}

export function ReplyModal({
    isOpen,
    onClose,
    parentComment,
    replyText,
    onReplyTextChange,
    onReplySubmit,
    submitting,
    prioritizedUsers = []
}: ReplyModalProps) {
    const { data: profile } = useProfileQuery()
    const anonymousId = getAnonymousIdSafe()

    if (!parentComment) return null

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                    {/* Backdrop with blur */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-background/80 backdrop-blur-md"
                    />

                    {/* Modal Container */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-border/50">
                            <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-muted">
                                <X className="h-5 w-5" />
                            </Button>
                            <span className="text-sm font-semibold text-neon-green">Nueva Respuesta</span>
                            <div className="w-10" /> {/* Spacer */}
                        </div>

                        <div className="p-4 sm:p-6 pb-2">
                            {/* Parent Comment Context */}
                            <div className="relative flex gap-3">
                                {/* Vertical Line Connector */}
                                <div className="absolute left-[19px] top-[40px] bottom-[-20px] w-[2px] bg-border/80" />

                                <Avatar className="h-10 w-10 border border-border z-10">
                                    <AvatarImage src={parentComment.avatar_url || getAvatarUrl(parentComment.anonymous_id)} />
                                    <AvatarFallback>{parentComment.alias?.substring(0, 2).toUpperCase() || 'AN'}</AvatarFallback>
                                </Avatar>

                                <div className="flex-1 pt-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-sm text-foreground">@{parentComment.alias || 'Anónimo'}</span>
                                        <span className="text-xs text-muted-foreground">• {new Date(parentComment.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <div className="text-sm text-foreground/80 line-clamp-3">
                                        {/* Accurately extract plain text from TipTap JSON */}
                                        {getPlainTextFromTipTap(parentComment.content).substring(0, 150)}
                                        {getPlainTextFromTipTap(parentComment.content).length > 150 ? '...' : ''}
                                    </div>
                                    <div className="mt-3 text-xs text-muted-foreground">
                                        Replying to <span className="text-neon-green">@{parentComment.alias || 'Anónimo'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Your Reply Area */}
                            <div className="mt-6 flex gap-3">
                                <Avatar className="h-10 w-10 border border-neon-green/20 z-10 bg-card">
                                    <AvatarImage src={profile?.avatar_url || getAvatarUrl(anonymousId)} />
                                    <AvatarFallback className="text-neon-green bg-neon-green/10 text-xs">
                                        {profile?.alias?.substring(0, 2).toUpperCase() || 'TÚ'}
                                    </AvatarFallback>
                                </Avatar>

                                <div className="flex-1 min-w-0">
                                    <RichTextEditor
                                        value={replyText}
                                        onChange={onReplyTextChange}
                                        onSubmit={() => onReplySubmit(parentComment.id)}
                                        disabled={submitting}
                                        placeholder="Escribe tu respuesta..."
                                        hideSubmitButton={true}
                                        prioritizedUsers={prioritizedUsers}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Footer with Submit Button */}
                        <div className="p-4 flex justify-end gap-3 bg-muted/40">
                            <Button variant="ghost" onClick={onClose} disabled={submitting} className="text-foreground hover:bg-background/50">
                                Cancelar
                            </Button>
                            <Button
                                onClick={() => onReplySubmit(parentComment.id)}
                                disabled={submitting || !replyText.trim()}
                                className="bg-neon-green text-black hover:bg-neon-green/90 font-bold px-6"
                            >
                                {submitting ? 'Enviando...' : 'Responder'}
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
