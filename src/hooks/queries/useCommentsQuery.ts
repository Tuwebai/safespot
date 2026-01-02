import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { commentsApi, type CreateCommentData } from '@/lib/api'
import { triggerBadgeCheck } from '@/hooks/useBadgeNotifications'

/**
 * Fetch comments for a report with cursor-based pagination
 * Polling enabled with network-aware frequency
 */
export function useCommentsQuery(reportId: string | undefined, limit = 20, cursor?: string) {
    return useQuery({
        queryKey: queryKeys.comments.byReportPaginated(reportId ?? '', cursor),
        queryFn: () => commentsApi.getByReportId(reportId!, limit, cursor),
        enabled: !!reportId,
        staleTime: 30 * 1000, // Consider data stale after 30s
        refetchOnWindowFocus: true, // Refetch when user returns to the tab
        refetchInterval: 2000, // Poll every 2s for near-instant updates
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
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: queryKeys.comments.byReport(newCommentData.report_id) })
            await queryClient.cancelQueries({ queryKey: queryKeys.reports.detail(newCommentData.report_id) })

            // Snapshot previous values
            const previousComments = queryClient.getQueryData<any>(queryKeys.comments.byReport(newCommentData.report_id))
            const previousReport = queryClient.getQueryData<any>(queryKeys.reports.detail(newCommentData.report_id))

            // Create temporary optimistic comment
            const optimisticComment = {
                id: `temp-${Date.now()}`,
                ...newCommentData,
                created_at: new Date().toISOString(),
                is_optimistic: true, // Helper to show a "sending" state if needed
                upvotes_count: 0,
                liked_by_me: false,
                author: 'Tú', // Generic for instant feedback
                anonymous_id: 'Tú', // Needed for getUserInitials
            }

            // Update comments cache
            queryClient.setQueriesData(
                { queryKey: queryKeys.comments.byReport(newCommentData.report_id) },
                (old: any) => {
                    if (!old) return [optimisticComment]
                    if (Array.isArray(old)) return [optimisticComment, ...old]
                    // If it's a paginated object, add to the first page
                    if (old.pages) {
                        const newPages = [...old.pages]
                        if (newPages[0]) {
                            newPages[0] = {
                                ...newPages[0],
                                data: [optimisticComment, ...(newPages[0].data || [])]
                            }
                        }
                        return { ...old, pages: newPages }
                    }
                    // Handle PaginatedComments ({ comments: [] })
                    if (old.comments && Array.isArray(old.comments)) {
                        return { ...old, comments: [optimisticComment, ...old.comments] }
                    }
                    return old
                }
            )

            // INSTANT COUNTER UPDATE: Optimistically increment comment count in report
            queryClient.setQueryData(
                queryKeys.reports.detail(newCommentData.report_id),
                (old: any) => {
                    if (!old) return old
                    // Handle both { data: report } and direct report object
                    if (old.data) {
                        return {
                            ...old,
                            data: {
                                ...old.data,
                                comments_count: (old.data.comments_count || 0) + 1
                            }
                        }
                    }
                    return {
                        ...old,
                        comments_count: (old.comments_count || 0) + 1
                    }
                }
            )

            return { previousComments, previousReport, reportId: newCommentData.report_id }
        },
        onError: (_, _variables, context) => {
            if (context?.reportId) {
                // Restore comments
                queryClient.setQueriesData(
                    { queryKey: queryKeys.comments.byReport(context.reportId) },
                    context.previousComments
                )
                // Restore report data (including comment count)
                if (context.previousReport) {
                    queryClient.setQueryData(
                        queryKeys.reports.detail(context.reportId),
                        context.previousReport
                    )
                }
            }
        },
        onSuccess: (newComment, _variables) => {
            // Check for badges
            triggerBadgeCheck(newComment.newBadges)
        },
        onSettled: (_, __, variables) => {
            // Final sync with server to replace temp ID with real one
            queryClient.invalidateQueries({ queryKey: queryKeys.comments.byReport(variables.report_id) })
            queryClient.invalidateQueries({ queryKey: queryKeys.reports.detail(variables.report_id) })
        },
    })
}

/**
 * Update a comment
 */
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
            const previousComments = queryClient.getQueriesData({ queryKey: ['comments'] })

            queryClient.setQueriesData<any>(
                { queryKey: ['comments'] },
                (old: any) => {
                    if (!old) return old
                    const transform = (comments: any[]) => comments.map((c: any) =>
                        c.id === id ? { ...c, content, updated_at: new Date().toISOString() } : c
                    )

                    if (Array.isArray(old)) return transform(old)
                    if (old.pages) {
                        return {
                            ...old,
                            pages: old.pages.map((page: any) => ({
                                ...page,
                                data: transform(page.data || [])
                            }))
                        }
                    }
                    if (old.comments && Array.isArray(old.comments)) {
                        return { ...old, comments: transform(old.comments) }
                    }
                    if (old.data && Array.isArray(old.data)) {
                        return { ...old, data: transform(old.data) }
                    }
                    return old
                }
            )

            return { previousComments }
        },
        onError: (_err, _vars, context) => {
            if (context?.previousComments) {
                context.previousComments.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data)
                })
            }
        },
        onSettled: (updatedComment) => {
            if (updatedComment?.report_id) {
                queryClient.invalidateQueries({ queryKey: queryKeys.comments.byReport(updatedComment.report_id) })
            } else {
                queryClient.invalidateQueries({ queryKey: ['comments'] })
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
        onMutate: async ({ id }) => {
            await queryClient.cancelQueries({ queryKey: ['comments'] })
            const previousComments = queryClient.getQueriesData({ queryKey: ['comments'] })

            queryClient.setQueriesData<any>(
                { queryKey: ['comments'] },
                (old: any) => {
                    if (!old) return old
                    const transform = (comments: any[]) => comments.filter((c: any) => c.id !== id)

                    if (Array.isArray(old)) return transform(old)
                    if (old.pages) {
                        return {
                            ...old,
                            pages: old.pages.map((page: any) => ({
                                ...page,
                                data: transform(page.data || [])
                            }))
                        }
                    }
                    if (old.comments && Array.isArray(old.comments)) {
                        return { ...old, comments: transform(old.comments) }
                    }
                    if (old.data && Array.isArray(old.data)) {
                        return { ...old, data: transform(old.data) }
                    }
                    return old
                }
            )

            return { previousComments }
        },
        onError: (_err, _vars, context) => {
            if (context?.previousComments) {
                context.previousComments.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data)
                })
            }
        },
        onSettled: (_, __, { reportId }) => {
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
        mutationFn: ({ id, isLiked }: { id: string; isLiked: boolean; reportId?: string }) =>
            isLiked ? commentsApi.unlike(id) : commentsApi.like(id),
        onMutate: async ({ id, isLiked }) => {
            // 1. Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['comments'] })

            // 2. Snapshot previous values (not doing full snapshot for all lists to avoid perf hit, 
            // but we can undo the toggle on error easily)

            // 3. Optimistically update all comment lists that might contain this comment
            queryClient.setQueriesData<any>(
                { queryKey: ['comments'] },
                (old: any) => {
                    if (!old) return old

                    // Handle both simple arrays and paginated objects
                    const transform = (comments: any[]) => comments.map((c: any) => {
                        if (c.id === id) {
                            return {
                                ...c,
                                liked_by_me: !isLiked,
                                upvotes_count: (c.upvotes_count || 0) + (isLiked ? -1 : 1)
                            }
                        }
                        return c
                    })

                    if (Array.isArray(old)) return transform(old)
                    if (old.pages) {
                        return {
                            ...old,
                            pages: old.pages.map((page: any) => ({
                                ...page,
                                data: transform(page.data || [])
                            }))
                        }
                    }
                    // Handle PaginatedComments structure explicitly ({ comments: [...], nextCursor: ... })
                    if (old.comments && Array.isArray(old.comments)) {
                        return { ...old, comments: transform(old.comments) }
                    }
                    if (old.data && Array.isArray(old.data)) {
                        return { ...old, data: transform(old.data) }
                    }
                    return old
                }
            )

            return { id, isLiked }
        },
        onError: (_, __, context) => {
            if (!context) return
            // Rollback: reverse the logic
            queryClient.setQueriesData<any>(
                { queryKey: ['comments'] },
                (old: any) => {
                    if (!old) return old
                    const transform = (comments: any[]) => comments.map((c: any) => {
                        if (c.id === context.id) {
                            return {
                                ...c,
                                liked_by_me: context.isLiked,
                                upvotes_count: (c.upvotes_count || 0) + (context.isLiked ? 1 : -1)
                            }
                        }
                        return c
                    })
                    if (Array.isArray(old)) return transform(old)
                    if (old.pages) {
                        return {
                            ...old,
                            pages: old.pages.map((page: any) => ({
                                ...page,
                                data: transform(page.data || [])
                            }))
                        }
                    }
                    return old
                }
            )
        },
        onSettled: () => {
            // No need to invalidate everything immediately if we trust our optimistic UI,
            // but a background sync is good.
            // queryClient.invalidateQueries({ queryKey: ['comments'] })
            triggerBadgeCheck()
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
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['comments'] })

            // Optimistically update
            queryClient.setQueriesData<any>(
                { queryKey: ['comments'] },
                (old: any) => {
                    if (!old) return old
                    const transform = (comments: any[]) => comments.map((c: any) =>
                        c.id === id ? { ...c, is_flagged: true } : c
                    )
                    if (Array.isArray(old)) return transform(old)
                    if (old.pages) {
                        return {
                            ...old,
                            pages: old.pages.map((page: any) => ({
                                ...page,
                                data: transform(page.data || [])
                            }))
                        }
                    }
                    return old
                }
            )

            return { id }
        },
        onError: (_, __, context) => {
            if (context?.id) {
                queryClient.setQueriesData<any>(
                    { queryKey: ['comments'] },
                    (old: any) => {
                        if (!old) return old
                        const transform = (comments: any[]) => comments.map((c: any) =>
                            c.id === context.id ? { ...c, is_flagged: false } : c
                        )
                        if (Array.isArray(old)) return transform(old)
                        if (old.pages) {
                            return {
                                ...old,
                                pages: old.pages.map((page: any) => ({
                                    ...page,
                                    data: transform(page.data || [])
                                }))
                            }
                        }
                        return old
                    }
                )
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['comments'] })
        },
    })
}
