import { useCallback, useReducer, useMemo } from 'react'
import { useToast } from '@/components/ui/toast'
import { getAnonymousIdSafe } from '@/lib/identity'
import { handleErrorWithMessage } from '@/lib/errorHandler'
import { triggerBadgeCheck } from '@/hooks/useBadgeNotifications'
import { getPlainTextFromTipTap } from '@/lib/tiptap-content'
import {
    useCommentsQuery,
    useCreateCommentMutation,
    useUpdateCommentMutation,
    useDeleteCommentMutation,
    useToggleLikeCommentMutation,
    useFlagCommentMutation,
    usePinCommentMutation,
    useUnpinCommentMutation
} from '@/hooks/queries/useCommentsQuery'

// ============================================
// STATE TYPES
// ============================================

interface CommentsState {
    // Input texts
    commentText: string
    replyText: string
    editText: string
    threadText: string

    // Active operations (which item is being acted on)
    replyingTo: string | null
    editingId: string | null
    creatingThread: boolean

    // Network states
    submitting: 'comment' | 'reply' | 'edit' | 'thread' | 'delete' | 'flag' | 'like' | null
    processingId: string | null // ID of item being processed
}

type CommentsAction =
    // Input actions
    | { type: 'SET_COMMENT_TEXT'; payload: string }
    | { type: 'SET_REPLY_TEXT'; payload: string }
    | { type: 'SET_EDIT_TEXT'; payload: string }
    | { type: 'SET_THREAD_TEXT'; payload: string }

    // Operation mode actions
    | { type: 'START_REPLY'; payload: string }
    | { type: 'CANCEL_REPLY' }
    | { type: 'START_EDIT'; payload: { id: string; text: string } }
    | { type: 'CANCEL_EDIT' }
    | { type: 'START_THREAD' }
    | { type: 'CANCEL_THREAD' }

    // Network actions
    | { type: 'START_SUBMIT'; payload: { operation: CommentsState['submitting']; id?: string } }
    | { type: 'END_SUBMIT' }
    | { type: 'RESET_AFTER_SUBMIT'; payload: 'comment' | 'reply' | 'edit' | 'thread' }

const initialState: CommentsState = {
    commentText: '',
    replyText: '',
    editText: '',
    threadText: '',
    replyingTo: null,
    editingId: null,
    creatingThread: false,
    submitting: null,
    processingId: null,
}

function commentsReducer(state: CommentsState, action: CommentsAction): CommentsState {
    switch (action.type) {
        // Input text actions
        case 'SET_COMMENT_TEXT':
            return { ...state, commentText: action.payload }
        case 'SET_REPLY_TEXT':
            return { ...state, replyText: action.payload }
        case 'SET_EDIT_TEXT':
            return { ...state, editText: action.payload }
        case 'SET_THREAD_TEXT':
            return { ...state, threadText: action.payload }

        // Operation mode actions
        case 'START_REPLY':
            return { ...state, replyingTo: action.payload, replyText: '' }
        case 'CANCEL_REPLY':
            return { ...state, replyingTo: null, replyText: '' }
        case 'START_EDIT':
            return { ...state, editingId: action.payload.id, editText: action.payload.text }
        case 'CANCEL_EDIT':
            return { ...state, editingId: null, editText: '' }
        case 'START_THREAD':
            return { ...state, creatingThread: true, threadText: '' }
        case 'CANCEL_THREAD':
            return { ...state, creatingThread: false, threadText: '' }

        // Network actions
        case 'START_SUBMIT':
            return { ...state, submitting: action.payload.operation, processingId: action.payload.id ?? null }
        case 'END_SUBMIT':
            return { ...state, submitting: null, processingId: null }
        case 'RESET_AFTER_SUBMIT':
            switch (action.payload) {
                case 'comment':
                    return { ...state, commentText: '', submitting: null, processingId: null }
                case 'reply':
                    return { ...state, replyingTo: null, replyText: '', submitting: null, processingId: null }
                case 'edit':
                    return { ...state, editingId: null, editText: '', submitting: null, processingId: null }
                case 'thread':
                    return { ...state, creatingThread: false, threadText: '', submitting: null, processingId: null }
                default:
                    return { ...state, submitting: null, processingId: null }
            }

        default:
            return state
    }
}

// ============================================
// HOOK INTERFACE
// ============================================

interface UseCommentsManagerProps {
    reportId: string | undefined
    onCommentCountChange?: (delta: number) => void
}

export function useCommentsManager({ reportId, onCommentCountChange }: UseCommentsManagerProps) {
    const toast = useToast()
    const [state, dispatch] = useReducer(commentsReducer, initialState)

    // ============================================
    // DATA LOADING (React Query)
    // ============================================

    // For now we don't handle deep pagination in this simplified hook 
    // but the query supports it.
    const {
        data: commentsData,
        isLoading,
        isFetching: isLoadingMore,
        refetch
    } = useCommentsQuery(reportId)

    const comments = useMemo(() => commentsData?.comments ?? [], [commentsData?.comments])
    const hasMore = !!commentsData?.nextCursor

    // ============================================
    // MUTATIONS
    // ============================================

    const createMutation = useCreateCommentMutation()
    const updateMutation = useUpdateCommentMutation()
    const deleteMutation = useDeleteCommentMutation()
    const likeMutation = useToggleLikeCommentMutation()
    const flagMutation = useFlagCommentMutation()
    const pinMutation = usePinCommentMutation()
    const unpinMutation = useUnpinCommentMutation()

    // ============================================
    // UTILS
    // ============================================

    const normalizeCommentPayload = useCallback((input: unknown) => {
        // Defensive: If input is a React event or Null, it's NOT a comment
        if (!input || (typeof input === 'object' && input !== null && ('_reactName' in input || 'nativeEvent' in input))) {
            return { plain: '', rich: '' }
        }

        const plain = getPlainTextFromTipTap(input)

        let rich = ''
        if (typeof input === 'string') {
            rich = input.trim()
        } else if (typeof input === 'object') {
            rich = JSON.stringify(input)
        }

        return { plain, rich }
    }, [])

    // ============================================
    // COMMENT OPERATIONS
    // ============================================

    const submitComment = useCallback(async (overridingContent?: unknown) => {
        // Detect if overridingContent is a React event/SyntheticEvent
        const isEvent = overridingContent && typeof overridingContent === 'object' && ('_reactName' in overridingContent || 'nativeEvent' in overridingContent)

        const textToUse = (overridingContent !== undefined && !isEvent) ? overridingContent : state.commentText
        const { plain, rich } = normalizeCommentPayload(textToUse)

        if (!reportId || !plain.trim() || state.submitting) {
            // Only show toast if it's a manual submit (not an event) and content is actually empty
            if (!plain.trim() && !state.submitting && textToUse && typeof textToUse !== 'object' && !('_reactName' in (textToUse as any))) {
                toast.warning('El comentario no puede estar vacío')
            }
            return
        }


        dispatch({ type: 'START_SUBMIT', payload: { operation: 'comment' } })

        // Clear input IMMEDIATELY for instant feedback
        dispatch({ type: 'RESET_AFTER_SUBMIT', payload: 'comment' })

        try {
            await createMutation.mutateAsync({
                report_id: reportId,
                content: rich || plain, // Try rich first, fallback to plain
            })

            onCommentCountChange?.(1)
            triggerBadgeCheck()
        } catch (error) {
            handleErrorWithMessage(error, 'Error al crear comentario', toast.error, 'useCommentsManager.submitComment')
            dispatch({ type: 'END_SUBMIT' })
        }
    }, [reportId, state.commentText, state.submitting, normalizeCommentPayload, createMutation, onCommentCountChange, toast])

    const submitReply = useCallback(async (parentId: string) => {
        const { plain, rich } = normalizeCommentPayload(state.replyText)

        if (!reportId || !plain.trim() || state.submitting) {
            if (!plain.trim() && !state.submitting) {
                toast.warning('La respuesta no puede estar vacía')
            }
            return
        }

        dispatch({ type: 'START_SUBMIT', payload: { operation: 'reply', id: parentId } })

        // Clear input and close form IMMEDIATELY for instant feedback
        dispatch({ type: 'RESET_AFTER_SUBMIT', payload: 'reply' })

        try {
            await createMutation.mutateAsync({
                report_id: reportId,
                content: rich || plain,
                parent_id: parentId,
            })

            onCommentCountChange?.(1)
            triggerBadgeCheck()
        } catch (error) {
            handleErrorWithMessage(error, 'Error al responder', toast.error, 'useCommentsManager.submitReply')
            dispatch({ type: 'END_SUBMIT' })
        }
    }, [reportId, state.replyText, state.submitting, normalizeCommentPayload, createMutation, onCommentCountChange, toast])

    const submitThread = useCallback(async () => {
        const { plain, rich } = normalizeCommentPayload(state.threadText)

        if (!reportId || !plain.trim() || state.submitting) {
            if (!plain.trim() && !state.submitting) {
                toast.warning('El texto del hilo no puede estar vacío')
            }
            return
        }

        dispatch({ type: 'START_SUBMIT', payload: { operation: 'thread' } })

        try {
            await createMutation.mutateAsync({
                report_id: reportId,
                content: rich || plain,
                is_thread: true,
            })

            dispatch({ type: 'RESET_AFTER_SUBMIT', payload: 'thread' })
            onCommentCountChange?.(1)
            triggerBadgeCheck()
            // toast.success removed as per user request
        } catch (error) {
            handleErrorWithMessage(error, 'Error al crear hilo', toast.error, 'useCommentsManager.submitThread')
            dispatch({ type: 'END_SUBMIT' })
        }
    }, [reportId, state.threadText, state.submitting, normalizeCommentPayload, createMutation, onCommentCountChange, toast])

    const submitEdit = useCallback(async (commentId: string) => {
        const { plain, rich } = normalizeCommentPayload(state.editText)

        if (!plain.trim() || state.submitting) return

        dispatch({ type: 'START_SUBMIT', payload: { operation: 'edit', id: commentId } })

        try {
            await updateMutation.mutateAsync({
                id: commentId,
                content: rich || plain
            })
            dispatch({ type: 'RESET_AFTER_SUBMIT', payload: 'edit' })
        } catch (error) {
            handleErrorWithMessage(error, 'Error al editar comentario', toast.error, 'useCommentsManager.submitEdit')
            dispatch({ type: 'END_SUBMIT' })
        }
    }, [state.editText, state.submitting, normalizeCommentPayload, updateMutation, toast])

    const deleteComment = useCallback(async (commentId: string) => {
        if (state.submitting || !reportId) return

        dispatch({ type: 'START_SUBMIT', payload: { operation: 'delete', id: commentId } })

        try {
            await deleteMutation.mutateAsync({ id: commentId, reportId })
            // No toast needed - optimistic update makes it feel instant
            // onCommentCountChange handled by optimistic update in mutation
        } catch (error) {
            handleErrorWithMessage(error, 'Error al eliminar comentario', toast.error, 'useCommentsManager.deleteComment')
        } finally {
            dispatch({ type: 'END_SUBMIT' })
        }
    }, [state.submitting, reportId, deleteMutation, toast])

    const flagComment = useCallback(async (commentId: string) => {
        const comment = comments.find(c => c.id === commentId)
        if (!comment || state.submitting) return

        if (comment.is_flagged) {
            toast.warning('Ya has reportado este comentario')
            return
        }

        const currentAnonymousId = getAnonymousIdSafe()
        if (comment.anonymous_id === currentAnonymousId) {
            toast.warning('No puedes reportar tu propio comentario')
            return
        }

        dispatch({ type: 'START_SUBMIT', payload: { operation: 'flag', id: commentId } })

        try {
            await flagMutation.mutateAsync({ id: commentId })
            toast.success('Comentario reportado correctamente')
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : ''
            if (errorMessage.includes('already flagged')) {
                toast.warning('Ya has reportado este comentario')
            } else {
                handleErrorWithMessage(error, 'Error al reportar comentario', toast.error, 'useCommentsManager.flagComment')
            }
        } finally {
            dispatch({ type: 'END_SUBMIT' })
        }
    }, [comments, state.submitting, flagMutation, toast])

    const toggleLike = useCallback(async (commentId: string) => {
        if (state.submitting === 'like' && state.processingId === commentId) return

        const comment = comments.find(c => c.id === commentId)
        if (!comment) return

        dispatch({ type: 'START_SUBMIT', payload: { operation: 'like', id: commentId } })

        const wasLiked = comment.liked_by_me ?? false

        try {
            await likeMutation.mutateAsync({ id: commentId, isLiked: wasLiked })
        } catch (error) {
            handleErrorWithMessage(error, 'Error al dar like', toast.error, 'useCommentsManager.toggleLike')
        } finally {
            dispatch({ type: 'END_SUBMIT' })
        }
    }, [comments, state.submitting, state.processingId, likeMutation, toast])

    const pinComment = useCallback(async (commentId: string) => {
        if (!reportId) return
        try {
            await pinMutation.mutateAsync({ id: commentId, reportId })
            toast.success('Comentario fijado')
        } catch (error) {
            handleErrorWithMessage(error, 'Error al fijar comentario', toast.error, 'useCommentsManager.pinComment')
        }
    }, [pinMutation, toast, reportId])

    const unpinComment = useCallback(async (commentId: string) => {
        if (!reportId) return
        try {
            await unpinMutation.mutateAsync({ id: commentId, reportId })
            toast.success('Comentario desfijado')
        } catch (error) {
            handleErrorWithMessage(error, 'Error al desfijar comentario', toast.error, 'useCommentsManager.unpinComment')
        }
    }, [unpinMutation, toast, reportId])

    // ============================================
    // ACTION CREATORS (for UI)
    // ============================================

    const startReply = useCallback((commentId: string) => {
        dispatch({ type: 'START_REPLY', payload: commentId })
    }, [])

    const cancelReply = useCallback(() => {
        dispatch({ type: 'CANCEL_REPLY' })
    }, [])

    const startEdit = useCallback((commentId: string) => {
        const comment = comments.find(c => c.id === commentId)
        if (comment) {
            dispatch({ type: 'START_EDIT', payload: { id: commentId, text: comment.content } })
        }
    }, [comments])

    const cancelEdit = useCallback(() => {
        dispatch({ type: 'CANCEL_EDIT' })
    }, [])

    const startThread = useCallback(() => {
        dispatch({ type: 'START_THREAD' })
    }, [])

    const cancelThread = useCallback(() => {
        dispatch({ type: 'CANCEL_THREAD' })
    }, [])

    const setCommentText = useCallback((text: string) => {
        dispatch({ type: 'SET_COMMENT_TEXT', payload: text })
    }, [])

    const setReplyText = useCallback((text: string) => {
        dispatch({ type: 'SET_REPLY_TEXT', payload: text })
    }, [])

    const setEditText = useCallback((text: string) => {
        dispatch({ type: 'SET_EDIT_TEXT', payload: text })
    }, [])

    const setThreadText = useCallback((text: string) => {
        dispatch({ type: 'SET_THREAD_TEXT', payload: text })
    }, [])

    // ============================================
    // DERIVED STATE
    // ============================================

    const isSubmitting = state.submitting !== null
    const isProcessing = useCallback((id: string) => state.processingId === id, [state.processingId])

    const loadMore = useCallback(() => {
        // Implement loadMore if needed by passing cursor to useCommentsQuery and useInfiniteQuery
    }, [])

    return {
        // State
        comments,
        commentText: state.commentText,
        replyText: state.replyText,
        editText: state.editText,
        threadText: state.threadText,
        replyingTo: state.replyingTo,
        editingId: state.editingId,
        creatingThread: state.creatingThread,
        submitting: state.submitting,
        isSubmitting,
        isProcessing,

        // Pagination
        hasMore,
        isLoading,
        isLoadingMore,

        // Actions
        loadComments: refetch,
        loadMore,
        submitComment,
        submitReply,
        submitThread,
        submitEdit,
        deleteComment,
        flagComment,
        toggleLike,
        pinComment,
        unpinComment,

        // UI actions
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
    }
}
