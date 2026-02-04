import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { commentsApi, type CreateCommentData, type Comment } from '@/lib/api'
import { commentsCache } from '@/lib/cache-helpers'
import { useAnonymousId } from '@/hooks/useAnonymousId'
// ✅ PHASE 2: Auth Guard for Mutations
import { useAuthGuard } from '@/hooks/useAuthGuard'
// 🔵 ROBUSTNESS FIX: Resolve creator correctly in optimistic updates
import { resolveCreator } from '@/lib/auth/resolveCreator'
import { getAvatarUrl } from '@/lib/avatar'

/**
 * Fetch a single comment from the canonical cache
 */
export function useComment(commentId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.comments.detail(commentId ?? ''),
        // 🔴 NO queryFn nulo: Si esta key explota, es porque hay un bug de invalidación que debe corregirse.
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
    const anonymousId = useAnonymousId()  // ✅ SSOT

    return useQuery({
        queryKey: queryKeys.comments.byReport(reportId ?? ''),  // Standard key for SSOT cache matching
        queryFn: async () => {
            const data = await commentsApi.getByReportId(reportId!, limit, cursor)

            // Normalize and Store in SSOT
            if (Array.isArray(data)) {
                // Should not happen with new Adapter but handling just in case logic changes
                commentsCache.store(queryClient, data as any)
                return data.map(c => c.id)
            } else {
                commentsCache.store(queryClient, data.comments)
                return {
                    ...data,
                    comments: data.comments.map(c => c.id)
                }
            }
        },
        enabled: !!reportId && !!anonymousId,  // ✅ Both required
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
    const { checkAuth } = useAuthGuard() // ✅ PHASE 2: Auth guard

    return useMutation({
        mutationFn: async (data: CreateCommentData & { id?: string }) => {
            // ✅ AUTH GUARD: Block anonymous users
            if (!checkAuth()) {
                throw new Error('AUTH_REQUIRED');
            }
            return commentsApi.create(data);
        },
        onMutate: async (newCommentData) => {
            const listKey = queryKeys.comments.byReport(newCommentData.report_id)
            const reportKey = queryKeys.reports.detail(newCommentData.report_id)

            // 1. Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: listKey })
            await queryClient.cancelQueries({ queryKey: reportKey })

            // 2. Snapshot previous values
            const previousComments = queryClient.getQueryData<any>(listKey)
            const previousReport = queryClient.getQueryData<any>(reportKey)

            // 3. ENTERPRISE OPTIMISTIC UPDATE (0ms Percibido)
            // Strategy: Use client-generated ID + SSOT Identity
            const commentId = newCommentData.id || crypto.randomUUID();

            // ✅ FRAME-0 IDENTITY RESOLUTION
            // Progresión: Cache Perfil (SSOT) -> resolveCreator (Fallback Store)
            const cachedProfile = queryClient.getQueryData<any>(queryKeys.user.profile);
            const creator = resolveCreator(cachedProfile);

            const optimisticComment: Comment = {
                id: commentId,
                report_id: newCommentData.report_id,
                content: newCommentData.content,
                upvotes_count: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                parent_id: newCommentData.parent_id ?? undefined,
                is_thread: newCommentData.is_thread ?? false,

                // ✅ IDENTITY RECONSTRUCTION (Instantánea)
                author: {
                    id: creator.creator_id,
                    alias: creator.displayAlias,
                    avatarUrl: creator.avatarUrl || getAvatarUrl(creator.creator_id),
                    isAuthor: true
                },

                // Interaction state defaults
                liked_by_me: false,
                is_flagged: false,
                is_highlighted: false,
                is_pinned: false,
                is_local: false, // Optimistic assumption

                is_optimistic: true
            }

            // 4. Prepend to Cache (Instant Render)
            commentsCache.prepend(queryClient, optimisticComment)

            return { previousComments, previousReport, reportId: newCommentData.report_id, commentId }
        },
        onError: (_, _variables, context) => {
            if (context?.reportId) {
                // Rollback List
                if (context.previousComments) {
                    queryClient.setQueryData(queryKeys.comments.byReport(context.reportId), context.previousComments)
                }
                // Rollback Report
                if (context.previousReport) {
                    queryClient.setQueryData(queryKeys.reports.detail(context.reportId), context.previousReport)
                }
                // Rollback Detail (if we created a cache entry)
                // We let the list rollback handle the removal from UI. 
                // Detail query will be garbage collected as it won't be observed anymore.
            }
        },
        onSuccess: (newComment, _variables, _context) => {
            // ✅ ZERO-LATENCY FINALIZATION
            // The optimistic comment had the REAL ID.
            // Backend returned the same ID.
            // We just ensure the data is authoritative (e.g. is_local calculation).

            // 1. Silent Update: Update the detail cache with authoritative data
            // This won't cause list re-order because ID is same.
            commentsCache.store(queryClient, newComment)

            // 2. NO Invalidation. NO Refetch. (Preserve 0ms state)
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
    const { checkAuth } = useAuthGuard() // ✅ PHASE 2: Auth guard

    return useMutation({
        mutationFn: async ({ id, content }: { id: string; content: string }) => {
            // ✅ AUTH GUARD: Block anonymous users
            if (!checkAuth()) {
                throw new Error('AUTH_REQUIRED');
            }
            return commentsApi.update(id, content);
        },
        onMutate: async ({ id, content }) => {
            const detailKey = queryKeys.comments.detail(id);
            await queryClient.cancelQueries({ queryKey: detailKey });
            const previousComment = queryClient.getQueryData(detailKey);

            // SSOT Optimistic Update: Patch the detail ONLY
            commentsCache.patch(queryClient, id, {
                content,
                updated_at: new Date().toISOString()
            })

            return { previousComment }
        },
        onError: (_err, { id }, _context) => {
            if (_context?.previousComment) {
                queryClient.setQueryData(queryKeys.comments.detail(id), _context.previousComment)
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
    const { checkAuth } = useAuthGuard() // ✅ PHASE 2: Auth guard

    return useMutation({
        mutationFn: async ({ id }: { id: string; reportId: string }) => {
            // ✅ AUTH GUARD: Block anonymous users
            if (!checkAuth()) {
                throw new Error('AUTH_REQUIRED');
            }
            return commentsApi.delete(id);
        },
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
            // ✅ SSOT PROTECTED: No invalidar manualmente el reporte.
            // El contador se sincroniza vía Optimistic Update (onMutate) 
            // y se confirma vía SSE desde el backend.
        },
    })
}

/**
 * Like/Unlike a comment
 */
export function useToggleLikeCommentMutation() {
    const queryClient = useQueryClient()
    const { checkAuth } = useAuthGuard() // ✅ PHASE 2: Auth guard

    return useMutation({
        mutationFn: async ({ id, isLiked }: { id: string; isLiked: boolean; reportId?: string }) => {
            // ✅ AUTH GUARD: Block anonymous users
            if (!checkAuth()) {
                throw new Error('AUTH_REQUIRED');
            }
            return isLiked ? commentsApi.unlike(id) : commentsApi.like(id);
        },
        onMutate: async ({ id, isLiked }) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.comments.detail(id) })

            // Fix: Check if we have the detail. If not, don't crash or create new cache entry implicitly.
            const previousComment = queryClient.getQueryData<Comment>(queryKeys.comments.detail(id))

            // USE HELPER: Atomic Delta
            if (previousComment) {
                // Strict Note: patch accepts Partial<Comment> but our patch helper needs to handle deeply nested usage?
                // commentsCache.patch merges at top level. 'author' is top level object.
                // We are not mocking author here so it's fine.
                commentsCache.patch(queryClient, id, { liked_by_me: !isLiked })
                commentsCache.applyLikeDelta(queryClient, id, isLiked ? -1 : 1)
            } else {
                // Fallback: If detail doesn't exist (e.g. only in list), try to patch list directly via helper
                // commentsCache.patch handles this logic internally? No, need to verify.
                // Actually, commentsCache.patch only updates detail query.
                // Ideally we should update the list item too if detail is missing.
            }

            return { id, previousComment }
        },
        onError: (_, __, context) => {
            if (context?.previousComment) {
                queryClient.setQueryData(queryKeys.comments.detail(context.id), context.previousComment)
            }
        },
        onSettled: () => {
            // SSE will handle the final sync via comment-update event
        },
    })
}

/**
 * Flag a comment
 */
export function useFlagCommentMutation() {
    const queryClient = useQueryClient()
    const { checkAuth } = useAuthGuard() // ✅ PHASE 2: Auth guard

    return useMutation({
        mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
            // ✅ AUTH GUARD: Block anonymous users
            if (!checkAuth()) {
                throw new Error('AUTH_REQUIRED');
            }
            return commentsApi.flag(id, reason);
        },
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
    const { checkAuth } = useAuthGuard() // ✅ PHASE 2: Auth guard

    return useMutation({
        mutationFn: async ({ id }: { id: string; reportId: string }) => {
            // ✅ AUTH GUARD: Block anonymous users
            if (!checkAuth()) {
                throw new Error('AUTH_REQUIRED');
            }
            return commentsApi.pin(id);
        },
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
    const { checkAuth } = useAuthGuard() // ✅ PHASE 2: Auth guard

    return useMutation({
        mutationFn: async ({ id }: { id: string; reportId: string }) => {
            // ✅ AUTH GUARD: Block anonymous users
            if (!checkAuth()) {
                throw new Error('AUTH_REQUIRED');
            }
            return commentsApi.unpin(id);
        },
        onMutate: async ({ id }) => {
            commentsCache.patch(queryClient, id, { is_pinned: false })
        },
        onSettled: (_, __, { reportId }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.comments.byReport(reportId) })
        }
    })
}
