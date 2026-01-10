import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { commentsApi, type CreateCommentData, type Comment } from '@/lib/api'
import { triggerBadgeCheck } from '@/hooks/useBadgeNotifications'
import { commentsCache } from '@/lib/cache-helpers'

/**
 * Fetch a single comment from the canonical cache
 */
export function useComment(commentId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.comments.detail(commentId ?? ''),
        enabled: false, // Strictly passive cache reader (no single-comment API)
        staleTime: Infinity,
        gcTime: 1000 * 60 * 60, // Keep in cache for 1 hour
    })
}

/**
 * Fetch comments for a report with cursor-based pagination
 * Polling enabled with network-aware frequency
 */
export function useCommentsQuery(reportId: string | undefined, limit = 20, cursor?: string) {
    const queryClient = useQueryClient()
    return useQuery({
        queryKey: queryKeys.comments.byReportPaginated(reportId ?? '', cursor),
        queryFn: async () => {
            const data = await commentsApi.getByReportId(reportId!, limit, cursor)

            // Normalize and Store in SSOT
            if (Array.isArray(data)) {
                commentsCache.store(queryClient, data)
                return data.map(c => c.id)
            } else {
                commentsCache.store(queryClient, data.comments)
                return {
                    ...data,
                    comments: data.comments.map(c => c.id)
                }
            }
        },
        enabled: !!reportId,
        staleTime: 30 * 1000, // Consider data stale after 30s
        refetchOnWindowFocus: true, // Refetch when user returns to the tab
        // SAFETY: Firewall against cache corruption (Object[] -> string[])
        select: (data: any) => {
            if (!data) return data;

            const extractIds = (list: any[]) => list.map(item => {
                if (typeof item === 'object' && item !== null && 'id' in item) {
                    return item.id
                }
                return item
            });

            if (Array.isArray(data)) return extractIds(data)
            if (data.comments) return { ...data, comments: extractIds(data.comments) }
            return data
        }
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
        onMutate: async (newCommentData) => {
            const listKey = queryKeys.comments.byReport(newCommentData.report_id)
            const reportKey = queryKeys.reports.detail(newCommentData.report_id)

            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: listKey })
            await queryClient.cancelQueries({ queryKey: reportKey })

            // Snapshot previous values
            const previousComments = queryClient.getQueryData<any>(listKey)
            const previousReport = queryClient.getQueryData<any>(reportKey)
            const userProfile = queryClient.getQueryData<any>(queryKeys.user.profile)

            // Create temporary optimistic comment
            const optimisticComment: Comment = {
                id: `temp-${Date.now()}`,
                report_id: newCommentData.report_id,
                content: newCommentData.content,
                anonymous_id: userProfile?.anonymous_id || 'Tú',
                upvotes_count: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                liked_by_me: false,
                is_flagged: false,
                is_optimistic: true,
                parent_id: newCommentData.parent_id,
                is_thread: newCommentData.is_thread,
                alias: userProfile?.alias,
                avatar_url: userProfile?.avatar_url,
                // Add required fields with defaults to satisfy type
                is_highlighted: false,
                is_pinned: false,
                is_author: previousReport?.anonymous_id && userProfile?.anonymous_id
                    ? previousReport.anonymous_id === userProfile.anonymous_id
                    : false,
                is_local: false
            }

            // USE HELPER: Prepend Optimistic Comment (SSOT + List + Counter)
            commentsCache.prepend(queryClient, optimisticComment)

            return { previousComments, previousReport, reportId: newCommentData.report_id, optimisticComment }
        },
        onError: (_, _variables, context) => {
            if (context?.reportId) {
                // Rollback List
                queryClient.setQueriesData({ queryKey: queryKeys.comments.byReport(context.reportId) }, context.previousComments)
                // Rollback Report
                queryClient.setQueryData(queryKeys.reports.detail(context.reportId), context.previousReport)
                // Rollback Optimistic Detail
                if (context.optimisticComment?.id) {
                    queryClient.removeQueries({ queryKey: queryKeys.comments.detail(context.optimisticComment.id) })
                }
            }
        },
        onSuccess: (newComment, variables, context) => {
            // A. Store Real Detail
            commentsCache.store(queryClient, newComment)

            // B. Swap ID in List (Temp -> Real)
            queryClient.setQueriesData<any>({ queryKey: queryKeys.comments.byReport(variables.report_id) }, (old: any) => {
                const swap = (list: string[]) => list.map(id => id === context?.optimisticComment?.id ? newComment.id : id)
                if (Array.isArray(old)) return swap(old)
                if (old && old.comments) return { ...old, comments: swap(old.comments) }
                return old
            })

            // C. Remove Optimistic Detail Entry
            if (context?.optimisticComment?.id) {
                queryClient.removeQueries({ queryKey: queryKeys.comments.detail(context.optimisticComment.id) })
            }

            // Check for badges
            triggerBadgeCheck(newComment.newBadges)
        },
        onSettled: () => {
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
        onMutate: async ({ id, content }) => {
            await queryClient.cancelQueries({ queryKey: ['comments'] })
            const previousComment = queryClient.getQueryData(queryKeys.comments.detail(id))

            // SSOT Optimistic Update: Patch the detail ONLY
            commentsCache.patch(queryClient, id, {
                content,
                updated_at: new Date().toISOString()
            })

            return { previousComment }
        },
        onError: (_err, { id }, context) => {
            if (context?.previousComment) {
                queryClient.setQueryData(queryKeys.comments.detail(id), context.previousComment)
            }
        },
        onSettled: (updatedComment) => {
            if (updatedComment) {
                commentsCache.store(queryClient, updatedComment)
            }
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
        onMutate: async ({ id, reportId }) => {
            const listKey = queryKeys.comments.byReport(reportId)
            const reportKey = queryKeys.reports.detail(reportId)

            // Cancel outgoing queries
            await queryClient.cancelQueries({ queryKey: listKey })
            await queryClient.cancelQueries({ queryKey: reportKey })

            // Snapshot
            const previousComments = queryClient.getQueryData(listKey)
            const previousReport = queryClient.getQueryData(reportKey)

            // USE HELPER: Remove from SSOT, Lists, and Decrement Counter
            commentsCache.remove(queryClient, id, reportId)

            return { previousComments, previousReport, listKey, reportKey, id }
        },
        onError: (_err, _vars, context) => {
            if (context?.previousComments) {
                queryClient.setQueryData(context.listKey, context.previousComments)
            }
            if (context?.previousReport) {
                queryClient.setQueryData(context.reportKey, context.previousReport)
            }
            // Restore detail if we had it? (Ideally yes, but omitted for brevity as fetch refetches)
        },
        onSettled: () => {
            // queryClient.invalidateQueries({ queryKey: queryKeys.reports.detail(reportId) })
        },
    })
}

/**
 * Like/Unlike a comment
 */
export function useToggleLikeCommentMutation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ id, isLiked }: { id: string; isLiked: boolean; reportId?: string }) =>
            isLiked ? commentsApi.unlike(id) : commentsApi.like(id),
        onMutate: async ({ id, isLiked }) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.comments.detail(id) })
            const previousComment = queryClient.getQueryData<Comment>(queryKeys.comments.detail(id))

            // USE HELPER: Atomic Delta
            if (previousComment) {
                commentsCache.patch(queryClient, id, { liked_by_me: !isLiked })
                commentsCache.applyLikeDelta(queryClient, id, isLiked ? -1 : 1)
            }

            return { id, previousComment }
        },
        onError: (_, __, context) => {
            if (context?.previousComment) {
                queryClient.setQueryData(queryKeys.comments.detail(context.id), context.previousComment)
            }
        },
        onSettled: () => {
            triggerBadgeCheck()
            // SSE will handle the final sync via comment-update event
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
        onMutate: async ({ id }) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.comments.detail(id) })
            const previousComment = queryClient.getQueryData(queryKeys.comments.detail(id))

            commentsCache.patch(queryClient, id, { is_flagged: true })

            return { id, previousComment }
        },
        onError: (_, __, context) => {
            if (context?.previousComment) {
                queryClient.setQueryData(queryKeys.comments.detail(context.id), context.previousComment)
            }
        },
    })
}

/**
 * Pin a comment
 */
export function usePinCommentMutation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ id }: { id: string; reportId: string }) => commentsApi.pin(id),
        onMutate: async ({ id }) => {
            commentsCache.patch(queryClient, id, { is_pinned: true })
        },
        onSettled: (_, __, { reportId }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.comments.byReport(reportId) })
        }
    })
}

/**
 * Unpin a comment
 */
export function useUnpinCommentMutation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ id }: { id: string; reportId: string }) => commentsApi.unpin(id),
        onMutate: async ({ id }) => {
            commentsCache.patch(queryClient, id, { is_pinned: false })
        },
        onSettled: (_, __, { reportId }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.comments.byReport(reportId) })
        }
    })
}
