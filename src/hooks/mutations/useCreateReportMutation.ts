import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { reportsApi, type CreateReportData } from '@/lib/api'
import { type Report } from '@/lib/schemas'
import { reportsCache } from '@/lib/cache-helpers'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { resolveCreator } from '@/lib/auth/resolveCreator'
import { getAvatarUrl } from '@/lib/avatar'
import { guardIdentityReady, IdentityNotReadyError } from '@/lib/guards/identityGuard'
import { useToast } from '@/components/ui/toast'

/**
 * CONTRACT: 0ms Optimistic Creation
 * 
 * Reports Feed must support 0ms optimistic insertion for high perceived performance.
 * 
 * RULES:
 * - NEVER invalidate ['reports', 'list'] manually (causes flicker & race conditions).
 * - ALWAYS use reportsCache.prepend (setQueriesData with exact:false).
 * - SSE / Server Success is the only authority for final reconciliation.
 * - Optimistic object MUST satisfy ReportSchema.strict() to pass UI selectors.
 * 
 * Breaking this contract will reintroduce regression #OPT-001
 * DO NOT MODIFY without architectural review.
 */
export function useCreateReportMutation() {
    const queryClient = useQueryClient()
    const { checkAuth } = useAuthGuard()
    const toast = useToast()

    return useMutation({
        mutationKey: ['createReport'],
        mutationFn: async (data: CreateReportData) => {
            if (!checkAuth()) {
                throw new Error('AUTH_REQUIRED');
            }
            return reportsApi.create(data);
        },
        onMutate: async (newReportData) => {
            // ✅ ENTERPRISE FIX: Identity Gate (ANTES de optimistic update)
            try {
                guardIdentityReady();
            } catch (e) {
                if (e instanceof IdentityNotReadyError) {
                    toast.warning('Identidad no lista. Intenta nuevamente en unos segundos.');
                }
                throw e;
            }

            // 1. Authority ID Generation (Immediate)
            if (!newReportData.id) {
                newReportData.id = crypto.randomUUID()
            }
            const reportId = newReportData.id!

            const cachedProfile = queryClient.getQueryData(queryKeys.user.profile);
            const creator = resolveCreator(cachedProfile);

            // 2. Create Authoritative Optimistic Entity
            const optimisticReport: Report = {
                id: reportId,
                title: newReportData.title,
                description: newReportData.description,
                category: newReportData.category,
                status: (newReportData.status as any) || 'pendiente',
                upvotes_count: 0,
                comments_count: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                author: {
                    id: creator.creator_id,
                    alias: creator.displayAlias,
                    avatarUrl: creator.avatarUrl || getAvatarUrl(creator.creator_id),
                    isAuthor: true,
                    is_official: false,
                    role: 'citizen'
                },
                zone: newReportData.zone || null,
                address: newReportData.address || null,
                latitude: newReportData.latitude ?? null,
                longitude: newReportData.longitude ?? null,
                last_edited_at: null,
                incident_date: newReportData.incident_date ?? null,
                priority_zone: null,
                distance_meters: null,
                threads_count: 0,
                image_urls: [],
                is_favorite: false,
                is_liked: false,
                is_flagged: false,
                is_hidden: false,
                flags_count: 0,
                province: undefined,
                locality: undefined,
                department: undefined,
                _isOptimistic: true
            }

            // 3. 0ms UI INSERTION (SYNC)
            reportsCache.prepend(queryClient, optimisticReport)

            // 4. Async Cancel & Snapshot
            // We don't await BEFORE the insert to ensure sync 0ms response.
            await queryClient.cancelQueries({ queryKey: ['reports', 'list'] })
            const previousReportsSnapshot = queryClient.getQueriesData({ queryKey: ['reports', 'list'] })

            return { previousReportsSnapshot, reportId }
        },
        onSuccess: (serverReport, _variables, context) => {
            // Reconciliation (SSE handles merging, but we patch here for reliability)
            if (context?.reportId) {
                if (serverReport.id !== context.reportId) {
                    reportsCache.swapId(queryClient, context.reportId, serverReport.id)
                }

                reportsCache.patch(queryClient, serverReport.id, {
                    ...serverReport,
                    _isOptimistic: false
                })
            }
        },
        onError: (error, _variables, context) => {
            // ✅ ENTERPRISE FIX: IdentityNotReadyError no es un error de red
            // No hacer rollback porque no hubo optimistic update
            if (error instanceof IdentityNotReadyError) {
                console.log('[useCreateReportMutation] Mutation blocked by identity guard. State:', error.state);
                return; // Early return, no rollback necesario
            }

            if (context?.reportId) {
                reportsCache.remove(queryClient, context.reportId)
            }
            if (context?.previousReportsSnapshot) {
                context.previousReportsSnapshot.forEach(([key, data]) => {
                    queryClient.setQueryData(key, data)
                })
            }
            console.error('[useCreateReportMutation] Error creating report:', error)
        },
        onSettled: () => {
            // ✅ ENTERPRISE RULE: Never invalidate reports or stats manually.
            // SSE is the authoritative sync source. 
            // Invalidation might trigger refetch loops that overwrite optimistic states.
        },
    })
}
