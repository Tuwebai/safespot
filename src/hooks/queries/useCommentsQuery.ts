import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { commentsApi, type CreateCommentData, type Comment } from '@/lib/api'
import { commentsCache } from '@/lib/cache-helpers'
import { useAnonymousId } from '@/hooks/useAnonymousId'
// ✅ PHASE 2: Auth Guard for Mutations
import { useAuthGuard } from '@/hooks/useAuthGuard'
// 🔵 ROBUSTNESS FIX: Resolve creator correctly in optimistic updates
import { resolveMutationIdentity } from '@/lib/auth/identityResolver'
import { getAvatarUrl } from '@/lib/avatar'
import { guardIdentityReady, IdentityNotReadyError } from '@/lib/guards/identityGuard'
import { useToast } from '@/components/ui/toast'
import { sessionAuthority } from '@/engine/session/SessionAuthority'

/**
 * Fetch a single comment from the canonical cache
 */
export function useComment(commentId: string | undefined) {
    const queryClient = useQueryClient();

    return useQuery({
        queryKey: queryKeys.comments.detail(commentId ?? ''),
        queryFn: async () => {
            // ✅ ENTERPRISE RULE: Strict queryFn invariant
            if (!commentId) throw new Error('Comment ID is required');
            // Check cache first to avoid unnecessary network calls for optimistic items
            const cached = queryClient.getQueryData<Comment>(queryKeys.comments.detail(commentId));
            if (cached?.is_optimistic) return cached;

            return commentsApi.getById(commentId);
        },
        enabled: !!commentId,
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
    const toast = useToast()

    return useMutation({
        mutationFn: async (data: CreateCommentData & { id?: string }) => {
            // ✅ AUTH GUARD: Block anonymous users
            if (!checkAuth()) {
                throw new Error('AUTH_REQUIRED');
            }
            return commentsApi.create(data);
        },
        onMutate: async (newCommentData) => {
            // ✅ ENTERPRISE FIX: Identity Gate (ANTES de optimistic update)
            try {
                guardIdentityReady();
            } catch (e) {
                if (e instanceof IdentityNotReadyError) {
                    toast.warning('Identidad no lista. Intenta nuevamente en unos segundos.');
                }
                throw e;
            }

            const listKey = queryKeys.comments.byReport(newCommentData.report_id)
            const reportKey = queryKeys.reports.detail(newCommentData.report_id)

            // 1. Cancel outgoing refetches
            // ✅ ENTERPRISE FIX: Manejar CancelledError silenciosamente
            // Esto puede ocurrir si hay queries en progreso que se cancelan
            try {
                await queryClient.cancelQueries({ queryKey: listKey })
                await queryClient.cancelQueries({ queryKey: reportKey })
            } catch (error) {
                // CancelledError es esperado y seguro de ignorar
                if (error instanceof Error && error.name !== 'CancelledError') {
                    throw error;
                }
            }

            // 2. Snapshot previous values
            const previousComments = queryClient.getQueryData<any>(listKey)
            const previousReport = queryClient.getQueryData<any>(reportKey)

            // 3. ENTERPRISE OPTIMISTIC UPDATE (0ms Percibido)
            // Strategy: Use client-generated ID + SSOT Identity
            const commentId = newCommentData.id || crypto.randomUUID();

            // ✅ FRAME-0 IDENTITY RESOLUTION (SSOT)
            // 🔴 CRITICAL FIX: NO usar cachedProfile del report owner
            // El cache ['users', 'profile'] contiene el perfil del USUARIO QUE SE ESTÁ VIENDO
            // (ej: dueño del reporte), no del usuario actual.
            // Usar SIEMPRE SessionAuthority para identidad del usuario actual.
            const identity = resolveMutationIdentity();

            // 🔍 DEBUG LOG: Verificar identidad usada en optimistic
            console.log('[CreateComment] OPTIMISTIC IDENTITY:', {
                authorId: identity.id,
                type: identity.type,
                alias: identity.alias,
                fromSession: sessionAuthority.getAnonymousId(),
                commentId: commentId,
                timestamp: new Date().toISOString()
            });

            const optimisticComment: Comment = {
                id: commentId,
                report_id: newCommentData.report_id,
                content: newCommentData.content,
                upvotes_count: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                parent_id: newCommentData.parent_id ?? undefined,
                is_thread: newCommentData.is_thread ?? false,

                // ✅ IDENTITY RECONSTRUCTION (SSOT)
                author: {
                    id: identity.id,
                    alias: identity.alias,
                    avatarUrl: identity.avatarUrl || getAvatarUrl(identity.id),
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
        onSuccess: (newComment, variables, context) => {
            // 🔍 DEBUG LOG: Verificar respuesta del backend
            console.log('[CreateComment] SERVER RESPONSE:', {
                commentId: newComment.id,
                authorId: newComment.author.id,
                authorAlias: newComment.author.alias,
                expectedAuthorId: context?.commentId ? 'check context' : 'no context',
                isOptimisticMatch: context?.commentId === newComment.id,
                timestamp: new Date().toISOString()
            });

            // ✅ ZERO-LATENCY FINALIZATION
            // The optimistic comment had the REAL ID.
            // Backend returned the same ID.
            // We just ensure the data is authoritative (e.g. is_local calculation).

            // 1. Silent Update: Update the detail cache with authoritative data
            commentsCache.store(queryClient, newComment);

            // 2. ✅ ENTERPRISE FIX (Capa 3 - UX): Reconciliar Lista Estructuralmente
            // Problema: Lista tiene comentario optimista con estructura parcial
            // Root Cause: commentsCache.store() solo actualiza detail, NO lista
            // Solución: Reemplazar optimista en lista con versión real del backend
            // Esto NO es normalización de IDs, la lista YA tiene IDs correctos
            // Esto ES reconciliación de objetos completos si la lista los almacena

            // NOTA: Actualmente la lista almacena solo IDs (string[])
            // Por lo tanto, esta reconciliación es NO-OP pero semánticamente correcta
            // Si en el futuro la lista almacena objetos, esto funcionará automáticamente
            queryClient.setQueryData<any>(
                queryKeys.comments.byReport(variables.report_id),
                (old: any) => {
                    if (!old) return old;

                    // Normalizar estructura (array directo o { comments: [...] })
                    const isList = Array.isArray(old);
                    const list = isList ? old : (old.comments ?? []);

                    // Si la lista almacena objetos, reemplazar optimista con real
                    // Si la lista almacena IDs, esto es NO-OP (pero correcto)
                    const reconciled = list.map((item: any) => {
                        // Si es objeto con id, reemplazar si coincide
                        if (typeof item === 'object' && item?.id === newComment.id) {
                            return newComment;
                        }
                        // Si es string (ID), mantener
                        return item;
                    });

                    // Retornar en la misma estructura que entró
                    return isList ? reconciled : { ...old, comments: reconciled };
                }
            );

            // 3. NO Invalidation. NO Refetch. (Preserve 0ms state)
            // La mutación estructural triggerea re-render natural
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
            // ✅ CLAUSULA 1: Optimistic Cancel
            const cached = queryClient.getQueryData<Comment>(queryKeys.comments.detail(id));
            if (cached?.is_optimistic) {
                console.log('[useDeleteCommentMutation] 🛡️ Optimistic item detected. Skipping network DELETE.');
                return { skipped: true };
            }

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

            // ✅ CLAUSULA 1: Cancel any ongoing creation for this ID
            const isOptimistic = queryClient.getQueryData<Comment>(queryKeys.comments.detail(id))?.is_optimistic;
            if (isOptimistic) {
                // This will prevent the POST onSuccess from reviving the comment
                await queryClient.cancelQueries({ queryKey: ['createComment'] });
            }

            // USE HELPER: Remove from SSOT, Lists, and Decrement Counter
            commentsCache.remove(queryClient, id, reportId)

            return { previousComments, previousReport, listKey, reportKey, id }
        },
        onError: (error, variables, context) => {
            // ✅ ENTERPRISE FIX: IdentityNotReadyError no es un error de red
            // No hacer rollback porque no hubo optimistic update
            if (error instanceof IdentityNotReadyError) {
                console.log('[useCommentsQuery] Mutation blocked by identity guard. State:', error.state);
                return; // Early return, no rollback necesario
            }

            const listKey = queryKeys.comments.byReport(variables.reportId)
            const reportKey = queryKeys.reports.detail(variables.reportId)

            // Rollback solo para errores reales (después de optimistic update)
            if (context?.previousComments) {
                queryClient.setQueryData(listKey, context.previousComments)
            }
            if (context?.previousReport) {
                queryClient.setQueryData(reportKey, context.previousReport)
            }

            console.error('[useCommentsQuery] Error creating comment:', error)
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
        onSettled: () => {
            // ✅ SSOT FIX: No manual invalidation. State is synced via SSE.
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
        onSettled: () => {
            // ✅ SSOT FIX: No manual invalidation. State is synced via SSE.
        }
    })
}
