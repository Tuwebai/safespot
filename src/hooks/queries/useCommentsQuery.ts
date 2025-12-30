import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { commentsApi, type CreateCommentData } from '@/lib/api'
import { triggerBadgeCheck } from '@/hooks/useBadgeNotifications'
import { getSmartRefetchInterval } from '@/lib/queryClient'

/**
 * Fetch comments for a report with cursor-based pagination
 * Polling enabled with network-aware frequency
 */
export function useCommentsQuery(reportId: string | undefined, limit = 20, cursor?: string) {
    return useQuery({
        queryKey: queryKeys.comments.byReportPaginated(reportId ?? '', cursor),
        queryFn: () => commentsApi.getByReportId(reportId!, limit, cursor),
        enabled: !!reportId,
        staleTime: 30 * 1000,
        refetchInterval: getSmartRefetchInterval(30000), // 30s base, scales up on slow mobile
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

            // Snapshot previous value
            const previousComments = queryClient.getQueryData<any>(queryKeys.comments.byReport(newCommentData.report_id))

            // Create temporary optimistic comment
            const optimisticComment = {
                id: `temp-${Date.now()}`,
                ...newCommentData,
                created_at: new Date().toISOString(),
                is_optimistic: true, // Helper to show a "sending" state if needed
                likes_count: 0,
                is_liked: false,
                author: 'Tú', // Generic for instant feedback
            }

            // Update cache
            queryClient.setQueryData(
                queryKeys.comments.byReport(newCommentData.report_id),
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
                    return old
                }
            )

            return { previousComments, reportId: newCommentData.report_id }
        },
        onError: (_, _variables, context) => {
            if (context?.reportId) {
                queryClient.setQueryData(
                    queryKeys.comments.byReport(context.reportId),
                    context.previousComments
                )
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
                                is_liked: !isLiked,
                                likes_count: (c.likes_count || 0) + (isLiked ? -1 : 1)
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
                                is_liked: context.isLiked,
                                likes_count: (c.likes_count || 0) + (context.isLiked ? 1 : -1)
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
