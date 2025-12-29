import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { commentsApi, type CreateCommentData } from '@/lib/api'

/**
 * Fetch comments for a report with cursor-based pagination
 * Polling enabled (10s) for real-time updates
 */
export function useCommentsQuery(reportId: string | undefined, limit = 20, cursor?: string) {
    return useQuery({
        queryKey: queryKeys.comments.byReportPaginated(reportId ?? '', cursor),
        queryFn: () => commentsApi.getByReportId(reportId!, limit, cursor),
        enabled: !!reportId,
        staleTime: 30 * 1000,
        refetchInterval: 10 * 1000, // Real-time polling
    })
}

/**
 * Create a new comment/reply/thread
 * Invalidates comments and reports to update counters
 */
export function useCreateCommentMutation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (data: CreateCommentData) => commentsApi.create(data),
        onSuccess: (_, variables) => {
            // Update comments list
            queryClient.invalidateQueries({ queryKey: queryKeys.comments.byReport(variables.report_id) })
            // Update report counters (comments_count, threads_count)
            queryClient.invalidateQueries({ queryKey: queryKeys.reports.detail(variables.report_id) })
            queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
        },
    })
}

/**
 * Update a comment
 */
export function useUpdateCommentMutation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ id, content }: { id: string; content: string }) =>
            commentsApi.update(id, content),
        onSuccess: (updatedComment) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.comments.byReport(updatedComment.report_id) })
        },
    })
}

/**
 * Delete a comment
 */
export function useDeleteCommentMutation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ id }: { id: string; reportId: string }) =>
            commentsApi.delete(id),
        onSuccess: (_, { reportId }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.comments.byReport(reportId) })
            queryClient.invalidateQueries({ queryKey: queryKeys.reports.detail(reportId) })
            queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
        },
    })
}

/**
 * Like/Unlike a comment
 */
export function useToggleLikeCommentMutation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ id, isLiked }: { id: string; isLiked: boolean }) =>
            isLiked ? commentsApi.unlike(id) : commentsApi.like(id),
        onSuccess: () => {
            // We don't have the reportId here easily without extra params or cache lookup
            // But invalidating all comments is safe or we can specify part of the key
            queryClient.invalidateQueries({ queryKey: ['comments'] })
        },
    })
}

/**
 * Flag a comment
 */
export function useFlagCommentMutation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
            commentsApi.flag(id, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['comments'] })
        },
    })
}
