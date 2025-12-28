import { useCallback, useReducer } from 'react'
import { commentsApi } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { getAnonymousIdSafe } from '@/lib/identity'
import { handleErrorWithMessage } from '@/lib/errorHandler'
import { triggerBadgeCheck } from '@/hooks/useBadgeNotifications'
import type { Comment } from '@/lib/api'

// ============================================
// STATE TYPES
// ============================================

interface CommentsState {
    comments: Comment[]

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
    | { type: 'SET_COMMENTS'; payload: Comment[] }
    | { type: 'ADD_COMMENT'; payload: Comment }
    | { type: 'UPDATE_COMMENT'; payload: { id: string; updates: Partial<Comment> } }
    | { type: 'REMOVE_COMMENT'; payload: string }
    | { type: 'REPLACE_COMMENT'; payload: { tempId: string; comment: Comment } }

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
    comments: [],
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
        case 'SET_COMMENTS':
            return { ...state, comments: action.payload }

        case 'ADD_COMMENT':
            return { ...state, comments: [...state.comments, action.payload] }

        case 'UPDATE_COMMENT':
            return {
                ...state,
                comments: state.comments.map(c =>
                    c.id === action.payload.id ? { ...c, ...action.payload.updates } : c
                )
            }

        case 'REMOVE_COMMENT':
            return {
                ...state,
                comments: state.comments.filter(c => c.id !== action.payload)
            }

        case 'REPLACE_COMMENT':
            return {
                ...state,
                comments: state.comments.map(c =>
                    c.id === action.payload.tempId ? action.payload.comment : c
                )
            }

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
    // DATA LOADING
    // ============================================

    const loadComments = useCallback(async () => {
        if (!reportId) return

        try {
            const data = await commentsApi.getByReportId(reportId)
            dispatch({ type: 'SET_COMMENTS', payload: data })
        } catch (error) {
            handleErrorWithMessage(error, 'Error al cargar comentarios', toast.error, 'useCommentsManager.loadComments')
        }
    }, [reportId, toast])

    // ============================================
    // COMMENT OPERATIONS
    // ============================================

    const submitComment = useCallback(async () => {
        if (!reportId || !state.commentText.trim() || state.submitting) return

        const tempId = `temp-${Date.now()}`
        const anonymousId = getAnonymousIdSafe()
        const contentToSubmit = state.commentText.trim()

        // Optimistic update
        const optimisticComment: Comment = {
            id: tempId,
            report_id: reportId,
            anonymous_id: anonymousId,
            content: contentToSubmit,
            upvotes_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            liked_by_me: false,
            is_flagged: false,
        }

        dispatch({ type: 'ADD_COMMENT', payload: optimisticComment })
        dispatch({ type: 'SET_COMMENT_TEXT', payload: '' })
        dispatch({ type: 'START_SUBMIT', payload: { operation: 'comment' } })
        onCommentCountChange?.(1)

        try {
            const createdComment = await commentsApi.create({
                report_id: reportId,
                content: contentToSubmit,
            })

            dispatch({
                type: 'REPLACE_COMMENT',
                payload: { tempId, comment: { ...createdComment, liked_by_me: false, is_flagged: false } }
            })
            dispatch({ type: 'RESET_AFTER_SUBMIT', payload: 'comment' })
            triggerBadgeCheck()
        } catch (error) {
            // Rollback
            dispatch({ type: 'REMOVE_COMMENT', payload: tempId })
            dispatch({ type: 'SET_COMMENT_TEXT', payload: contentToSubmit })
            onCommentCountChange?.(-1)

            handleErrorWithMessage(error, 'Error al crear comentario', toast.error, 'useCommentsManager.submitComment')
            dispatch({ type: 'END_SUBMIT' })
        }
    }, [reportId, state.commentText, state.submitting, onCommentCountChange, toast])

    const submitReply = useCallback(async (parentId: string) => {
        if (!reportId || !state.replyText.trim() || state.submitting) return

        const parentComment = state.comments.find(c => c.id === parentId)
        if (!parentComment) {
            toast.error('El comentario al que intentas responder ya no existe')
            dispatch({ type: 'CANCEL_REPLY' })
            return
        }

        dispatch({ type: 'START_SUBMIT', payload: { operation: 'reply', id: parentId } })

        try {
            const createdComment = await commentsApi.create({
                report_id: reportId,
                content: state.replyText.trim(),
                parent_id: parentId,
            })

            dispatch({ type: 'ADD_COMMENT', payload: { ...createdComment, liked_by_me: false, is_flagged: false } })
            dispatch({ type: 'RESET_AFTER_SUBMIT', payload: 'reply' })
            onCommentCountChange?.(1)
            triggerBadgeCheck()
        } catch (error) {
            handleErrorWithMessage(error, 'Error al responder', toast.error, 'useCommentsManager.submitReply')
            dispatch({ type: 'END_SUBMIT' })
        }
    }, [reportId, state.replyText, state.submitting, state.comments, onCommentCountChange, toast])

    const submitEdit = useCallback(async (commentId: string) => {
        if (!state.editText.trim() || state.submitting) return

        dispatch({ type: 'START_SUBMIT', payload: { operation: 'edit', id: commentId } })

        try {
            const updatedComment = await commentsApi.update(commentId, state.editText.trim())
            dispatch({
                type: 'UPDATE_COMMENT',
                payload: { id: commentId, updates: { content: updatedComment.content, updated_at: updatedComment.updated_at } }
            })
            dispatch({ type: 'RESET_AFTER_SUBMIT', payload: 'edit' })
        } catch (error) {
            handleErrorWithMessage(error, 'Error al editar comentario', toast.error, 'useCommentsManager.submitEdit')
            dispatch({ type: 'END_SUBMIT' })
        }
    }, [state.editText, state.submitting, toast])

    const deleteComment = useCallback(async (commentId: string) => {
        if (state.submitting) return

        dispatch({ type: 'START_SUBMIT', payload: { operation: 'delete', id: commentId } })

        try {
            await commentsApi.delete(commentId)
            dispatch({ type: 'REMOVE_COMMENT', payload: commentId })
            onCommentCountChange?.(-1)
            toast.success('Comentario eliminado')
        } catch (error) {
            handleErrorWithMessage(error, 'Error al eliminar comentario', toast.error, 'useCommentsManager.deleteComment')
        } finally {
            dispatch({ type: 'END_SUBMIT' })
        }
    }, [state.submitting, onCommentCountChange, toast])

    const flagComment = useCallback(async (commentId: string) => {
        const comment = state.comments.find(c => c.id === commentId)
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
            await commentsApi.flag(commentId)
            dispatch({ type: 'UPDATE_COMMENT', payload: { id: commentId, updates: { is_flagged: true } } })
            toast.success('Comentario reportado correctamente')
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : ''
            if (errorMessage.includes('already flagged')) {
                dispatch({ type: 'UPDATE_COMMENT', payload: { id: commentId, updates: { is_flagged: true } } })
                toast.warning('Ya has reportado este comentario')
            } else {
                handleErrorWithMessage(error, 'Error al reportar comentario', toast.error, 'useCommentsManager.flagComment')
            }
        } finally {
            dispatch({ type: 'END_SUBMIT' })
        }
    }, [state.comments, state.submitting, toast])

    const toggleLike = useCallback(async (commentId: string) => {
        if (state.submitting) return

        const comment = state.comments.find(c => c.id === commentId)
        if (!comment) return

        // Optimistic update
        const wasLiked = comment.liked_by_me
        dispatch({
            type: 'UPDATE_COMMENT',
            payload: {
                id: commentId,
                updates: {
                    liked_by_me: !wasLiked,
                    upvotes_count: comment.upvotes_count + (wasLiked ? -1 : 1)
                }
            }
        })

        try {
            const result = await commentsApi.like(commentId)
            dispatch({
                type: 'UPDATE_COMMENT',
                payload: {
                    id: commentId,
                    updates: { liked_by_me: result.liked, upvotes_count: result.upvotes_count }
                }
            })
        } catch (error) {
            // Rollback
            dispatch({
                type: 'UPDATE_COMMENT',
                payload: {
                    id: commentId,
                    updates: { liked_by_me: wasLiked, upvotes_count: comment.upvotes_count }
                }
            })
            handleErrorWithMessage(error, 'Error al dar like', toast.error, 'useCommentsManager.toggleLike')
        }
    }, [state.comments, state.submitting, toast])

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
        const comment = state.comments.find(c => c.id === commentId)
        if (comment) {
            dispatch({ type: 'START_EDIT', payload: { id: commentId, text: comment.content } })
        }
    }, [state.comments])

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

    return {
        // State
        comments: state.comments,
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

        // Actions
        loadComments,
        submitComment,
        submitReply,
        submitEdit,
        deleteComment,
        flagComment,
        toggleLike,

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
