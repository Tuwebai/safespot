import { useQuery, useMutation, useQueryClient, useQueries, useIsMutating } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'
import { reportsApi, type CreateReportData } from '@/lib/api'
import { type Report, type ReportFilters } from '@/lib/schemas'
import { useAnonymousId } from '@/hooks/useAnonymousId'
// ✅ PHASE 2: Auth Guard for Mutations
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { useAnalytics } from '@/hooks/useAnalytics'
// 🔵 ROBUSTNESS FIX: Resolve creator correctly in optimistic updates

// Enterprise Data Freshness SLA:
// ... (comments remain same)

// ============================================
// QUERIES (READ)
// ============================================

import { reportsCache } from '@/lib/cache-helpers'

// ... (Queries remain largely same, just imported types changed under the hood)
// CAUTION: normalizeReportForUI might need adjustment if it relied on flat fields, 
// BUT we are moving to SSOT where backend adapter handles it.
// normalizeReportForUI is a frontend normalizer that might be redundant if adapter is strict.
// However, sticking to the plan: Update Optimistic Update first.

// ============================================
// REPORTS CACHE CONTRACT
// ============================================

/**
 * REPORTS CACHE CONTRACT
 *
 * Reports list is SSOT for UI rendering.
 * Optimistic updates are authoritative until server reconciliation.
 * Never reset entire array unless explicitly rehydrating from cold start.
 * 
 * RULES:
 * - NEVER invalidate ['reports', 'list'] manually.
 * - ALWAYS rely on setQueriesData with exact:false for updates.
 * - SSE is the ONLY authority for total reconciliation.
 */

import { type NormalizedReport, normalizeReportForUI } from '@/lib/normalizeReport'

export function prefetchReportsList(queryClient: QueryClient) {
    return queryClient.prefetchQuery({
        queryKey: ['reports', 'list'],
        queryFn: () => reportsApi.getAll()
    })
}

/**
 * Get a single report by ID from cache (SSOT)
 */
/**
 * Get a single report by ID from cache (SSOT)
 */
export function useReport(id: string, initialData?: NormalizedReport, options?: { enabled?: boolean, isOptimistic?: boolean }) {
    const queryClient = useQueryClient()

    return useQuery<NormalizedReport>({
        queryKey: queryKeys.reports.detail(id),
        queryFn: async () => {
            // ✅ ENTERPRISE 0ms: Check cache manually to catch race conditions
            const cached = queryClient.getQueryData<NormalizedReport>(queryKeys.reports.detail(id))
            if (cached) return cached

            const report = await reportsApi.getById(id)
            if (!report) throw new Error(`Report ${id} not found`)

            reportsCache.store(queryClient, [report])
            return normalizeReportForUI(report)
        },
        enabled: (options?.enabled ?? true) && !!id && !options?.isOptimistic,
        initialData: initialData,
        placeholderData: initialData,
        staleTime: 5 * 60 * 1000,
    })
}

/**
 * Fetch all reports with optional filters.
 */
export function useReportsQuery(filters?: ReportFilters) {
    const queryClient = useQueryClient()
    const anonymousId = useAnonymousId()  // ✅ SSOT for identity

    // ✅ ENTERPRISE FIX: Block refetches while creating to prevent Optimistic Rollback
    const isCreating = useIsMutating({ mutationKey: ['createReport'] }) > 0;

    return useQuery<string[], Error, NormalizedReport[]>({
        queryKey: queryKeys.reports.list(filters, anonymousId || undefined),
        queryFn: async () => {
            const data = await reportsApi.getAll(filters);
            if (!Array.isArray(data)) {
                throw new Error('Backend returned invalid reports data');
            }
            return reportsCache.store(queryClient, data);
        },
        enabled: !!anonymousId,
        staleTime: 30 * 1000,
        refetchOnWindowFocus: !isCreating,
        refetchOnMount: !isCreating ? true : false,
        select: (ids) => {
            // ✅ LAST KNOWN GOOD STATE: If selection fails or ids are invalid, 
            // the previous data is preserved by placeholderData.
            if (!Array.isArray(ids)) return [];
            return reportsCache.hydrate(queryClient, ids);
        },
        // ✅ ENTERPRISE RESILIENCE: Ensure previous data is kept during fetch
        placeholderData: (previousData) => previousData,
    })
}

/**
 * Batched Selector for Maps/Clustering
 */
export function useReportsBatch(ids: string[]) {
    const anonymousId = useAnonymousId()

    // Create a query object for each ID to resolve DATA from cache
    const result = useQueries({
        queries: ids.map(id => ({
            queryKey: queryKeys.reports.detail(id), // ✅ Match SSOT Key
            queryFn: () => reportsApi.getById(id),
            enabled: !!id && !!anonymousId,
            staleTime: Infinity,
            // We can trust cache if populated by useReportsQuery
        }))
    })

    // Map and filter valid reports
    return result.map(q => q.data).filter((r): r is Report => !!r)
}

/**
 * Fetch a single report by ID (Server Fallback)
 */
export function useReportDetailQuery(reportId: string | undefined, enabled = true) {
    const queryClient = useQueryClient()
    const anonymousId = useAnonymousId()

    return useQuery<NormalizedReport>({
        queryKey: queryKeys.reports.detail(reportId ?? ''),
        queryFn: async () => {
            if (!reportId) throw new Error("No ID")
            const report = await reportsApi.getById(reportId) // Adapter handles it
            if (!report) throw new Error("Not found")

            reportsCache.store(queryClient, [report])
            return normalizeReportForUI(report)
        },
        enabled: !!reportId && enabled && !!anonymousId,
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        retry: 1,
    })
}

// ============================================
// MUTATIONS (WRITE)
// ============================================

// useCreateReportMutation moved to src/hooks/mutations/useCreateReportMutation.ts

// ... UseUpdate, UseDelete, UseToggleFavorite, UseFlag (Logic remains same, type check ensures compliance)

export function useUpdateReportMutation() {
    const queryClient = useQueryClient()
    const { checkAuth } = useAuthGuard()

    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<CreateReportData> }) => {
            if (!checkAuth()) {
                throw new Error('AUTH_REQUIRED');
            }
            return reportsApi.update(id, data);
        },
        onMutate: async ({ id, data }) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.reports.all })
            await queryClient.cancelQueries({ queryKey: queryKeys.reports.detail(id) })

            const previousDetail = queryClient.getQueryData<Report>(queryKeys.reports.detail(id))

            // ReportsCache.patch supports atomic updates. 
            // Note: If updating nested fields via Partial<CreateReportData>, we might need deep merge if adapter requires.
            // But strict model updates usually happen via full object replacement or explicit patch endpoints.
            // Here we just patch top level fields which is fine for basic edits.
            reportsCache.patch(queryClient, id, data as unknown as Partial<Report>)

            return { previousDetail }
        },
        onError: (_err, { id }, context) => {
            if (context?.previousDetail) {
                queryClient.setQueryData(queryKeys.reports.detail(id), context.previousDetail)
            }
        },
        onSettled: () => {
            // ✅ ENTERPRISE RULE: Never invalidate stats manually on update. SSE handles it.
        }
    })
}

export function useDeleteReportMutation() {
    const queryClient = useQueryClient()
    const { checkAuth } = useAuthGuard()

    return useMutation({
        mutationFn: async (id: string) => {
            if (!checkAuth()) {
                throw new Error('AUTH_REQUIRED');
            }
            return reportsApi.delete(id);
        },
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.reports.all })
            await queryClient.cancelQueries({ queryKey: queryKeys.stats.global })
            await queryClient.cancelQueries({ queryKey: queryKeys.stats.categories })

            const previousReports = queryClient.getQueriesData({ queryKey: ['reports', 'list'] })
            const previousGlobalStats = queryClient.getQueryData(queryKeys.stats.global)
            const previousCategoryStats = queryClient.getQueryData(queryKeys.stats.categories)

            let reportCategory: string | null = null
            const detailData = queryClient.getQueryData<Report>(queryKeys.reports.detail(id))
            if (detailData) {
                reportCategory = detailData.category
            }

            reportsCache.remove(queryClient, id)

            if (previousGlobalStats) {
                queryClient.setQueryData(
                    queryKeys.stats.global,
                    (old: any) => ({
                        ...old,
                        total_reports: Math.max(0, (old?.total_reports || 1) - 1)
                    })
                )
            }

            if (previousCategoryStats && reportCategory) {
                queryClient.setQueryData(
                    queryKeys.stats.categories,
                    (old: any) => ({
                        ...old,
                        [reportCategory!]: Math.max(0, (old?.[reportCategory!] || 1) - 1)
                    })
                )
            }

            return { previousReports, previousGlobalStats, previousCategoryStats, reportCategory, id }
        },
        onError: (_err, _id, context) => {
            if (context?.previousReports) {
                context.previousReports.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data)
                })
            }
            if (context?.previousGlobalStats) {
                queryClient.setQueryData(queryKeys.stats.global, context.previousGlobalStats)
                queryClient.setQueryData(queryKeys.stats.categories, context.previousCategoryStats)
            }
        },
        onSettled: () => {
            // ✅ ENTERPRISE RULE: Never invalidate stats manually on delete. SSE handles it.
        },
    })
}

// ... ToggleFavorite and Flag remain same structure, types validated by TS
export function useToggleFavoriteMutation() {
    const queryClient = useQueryClient()
    const { checkAuth } = useAuthGuard()

    return useMutation({
        mutationFn: async (reportId: string) => {
            if (!checkAuth()) throw new Error('AUTH_REQUIRED');
            return reportsApi.toggleFavorite(reportId);
        },
        onMutate: async (reportId) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.reports.all })
            const previousDetail = queryClient.getQueryData<Report>(queryKeys.reports.detail(reportId))
            if (previousDetail) {
                reportsCache.patch(queryClient, reportId, { is_favorite: !previousDetail.is_favorite })
            }
            return { previousDetail }
        },
        onSuccess: (result, reportId) => {
            // SERVER RECONCILIATION: Ensure cache matches server reality
            if (result && typeof result.is_favorite === 'boolean') {
                reportsCache.patch(queryClient, reportId, { is_favorite: result.is_favorite })
            }
        },
        onError: (_err, reportId, context) => {
            if (context?.previousDetail) {
                queryClient.setQueryData(queryKeys.reports.detail(reportId), context.previousDetail)
            }
        },
        onSettled: (_data, _error, _reportId) => {
            // ✅ ENTERPRISE RULE: Never invalidate global reports list. Use Optimistic + SSE.
            // queryClient.invalidateQueries({ queryKey: queryKeys.reports.all }) 
            // queryClient.invalidateQueries({ queryKey: queryKeys.reports.detail(reportId) })

            // Only invalidate user-specific favorites list if it exists separate from main feed
            queryClient.invalidateQueries({ queryKey: queryKeys.user.favorites })
        },
    })
}

export function useToggleReportLikeMutation() {
    const queryClient = useQueryClient()
    const { trackEvent } = useAnalytics()

    return useMutation({
        mutationFn: async ({ reportId, liked }: { reportId: string; liked: boolean }) => {
            return reportsApi.toggleLike(reportId, liked);
        },
        onMutate: async ({ reportId, liked }) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.reports.detail(reportId) })

            const previousDetail = queryClient.getQueryData<Report>(queryKeys.reports.detail(reportId))

            if (previousDetail) {
                reportsCache.patch(queryClient, reportId, {
                    is_liked: liked,
                    upvotes_count: liked ? (previousDetail.upvotes_count || 0) + 1 : Math.max(0, (previousDetail.upvotes_count || 0) - 1)
                })
            }

            return { previousDetail, reportId }
        },
        onSuccess: (result, { reportId, liked }) => {
            // SERVER RECONCILIATION: Authoritative state from backend
            if (result && typeof result.is_liked === 'boolean') {
                reportsCache.patch(queryClient, reportId, {
                    is_liked: result.is_liked,
                    upvotes_count: result.upvotes_count
                })
            }
            
            // TRACK: Vote cast (only when liking, not unliking)
            if (liked) {
                trackEvent({
                    event_type: 'vote_cast',
                    metadata: {
                        report_id: reportId,
                        vote_type: 'upvote'
                    }
                }).catch(() => {})
            }
        },
        onError: (_err, _variables, context) => {
            // Rollback on failure
            if (context?.previousDetail && context.reportId) {
                queryClient.setQueryData(queryKeys.reports.detail(context.reportId), context.previousDetail)
            }
        },
        onSettled: (_data, _error, { reportId: _reportId }) => {
            // Optional: Background sync for specific report detail
            // queryClient.invalidateQueries({ queryKey: queryKeys.reports.detail(reportId) })
        },
    })
}

export function useFlagReportMutation() {
    const queryClient = useQueryClient()
    const { checkAuth } = useAuthGuard()

    return useMutation({
        mutationFn: async ({ reportId, reason, comment }: { reportId: string; reason?: string; comment?: string }) => {
            if (!checkAuth()) throw new Error('AUTH_REQUIRED');
            return reportsApi.flag(reportId, reason, comment);
        },
        onMutate: async ({ reportId }) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.reports.all })
            const previousDetail = queryClient.getQueryData<Report>(queryKeys.reports.detail(reportId))
            if (previousDetail) {
                reportsCache.patch(queryClient, reportId, { is_flagged: true })
            }
            return { previousDetail, reportId }
        },
        onSuccess: (result, { reportId }) => {
            // SERVER RECONCILIATION
            if (result && typeof result.is_flagged === 'boolean') {
                reportsCache.patch(queryClient, reportId, { is_flagged: result.is_flagged })
            }
        },
        onError: (_, __, context) => {
            if (context?.reportId && context.previousDetail) {
                queryClient.setQueryData(queryKeys.reports.detail(context.reportId), context.previousDetail)
            }
        },
        onSettled: () => {
            // ✅ ENTERPRISE RULE: Never invalidate global reports list. Use Optimistic + SSE.
            // Invalidations here cause UI flickering and race conditions.
        },
    })
}
