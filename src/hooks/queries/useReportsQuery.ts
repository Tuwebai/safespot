import { useQuery, useMutation, useQueryClient, useQueries, useIsMutating } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'
import { reportsApi, type CreateReportData } from '@/lib/api'
import { type Report, type ReportFilters } from '@/lib/schemas'
import { triggerBadgeCheck } from '@/hooks/useBadgeNotifications'
import { useAnonymousId } from '@/hooks/useAnonymousId'
// ✅ PHASE 2: Auth Guard for Mutations
import { useAuthGuard } from '@/hooks/useAuthGuard'
// 🔵 ROBUSTNESS FIX: Resolve creator correctly in optimistic updates
import { resolveCreator } from '@/lib/auth/resolveCreator'
import { getAvatarUrl } from '@/lib/avatar'

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
// QUERIES (READ)
// ============================================

import { type NormalizedReport, normalizeReportForUI } from '@/lib/normalizeReport'

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

    return useQuery<Report[], Error, NormalizedReport[]>({
        queryKey: queryKeys.reports.list(filters),  // Standard key for SSOT cache matching
        queryFn: async () => {
            // Adapter handles transformation to Strict Report[]
            return await reportsApi.getAll(filters)
        },
        enabled: !!anonymousId,
        staleTime: 30 * 1000, // 30s
        refetchOnWindowFocus: !isCreating, // Block refetch if creating
        refetchOnMount: !isCreating ? 'always' : false, // Block refetch if creating
        select: (data) => {
            if (!Array.isArray(data)) {
                return [] // Fallback
            }

            // Store in SSOT
            reportsCache.store(queryClient, data)

            // ✅ Return Objects for UI (enables initialData injection)
            return data.map(normalizeReportForUI)
        },
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

export function useCreateReportMutation() {
    const queryClient = useQueryClient()
    const { checkAuth } = useAuthGuard()

    return useMutation({
        mutationKey: ['createReport'], // ✅ Key for detection
        mutationFn: async (data: CreateReportData) => {
            if (!checkAuth()) {
                throw new Error('AUTH_REQUIRED');
            }
            return reportsApi.create(data);
        },
        onMutate: async (newReportData) => {
            // 1. Cancel outgoing queries
            await queryClient.cancelQueries({ queryKey: queryKeys.reports.all })
            await queryClient.cancelQueries({ queryKey: queryKeys.stats.global })
            await queryClient.cancelQueries({ queryKey: queryKeys.stats.categories })

            // 2. Snapshot previous state
            const previousReports = queryClient.getQueriesData({ queryKey: ['reports', 'list'] })
            const previousGlobalStats = queryClient.getQueryData(queryKeys.stats.global)
            const previousCategoryStats = queryClient.getQueryData(queryKeys.stats.categories)

            // 3. GENERATE REAL ID (Enterprise Pattern)
            if (!newReportData.id) {
                newReportData.id = crypto.randomUUID()
            }
            const reportId = newReportData.id!

            // 🔵 ROBUSTNESS FIX: Resolve creator correctly using Cache
            const cachedProfile = queryClient.getQueryData(queryKeys.user.profile);
            const creator = resolveCreator(cachedProfile);

            // 4. Create Optimistic Report (Final ID, no Temp)
            // ✅ ENTERPRISE FIX: Complete entity with Strict Author Model
            const optimisticReport: Report = {
                // Required fields
                id: reportId,
                // anonymous_id: creator.creator_id, // DEPRECATED but kept if schema requires strict compliance (though we prefer author.id)
                // We will omit anonymous_id if Type permits, or set it to creator_id if strictly needed by older consumers.
                // Assuming schema defines it but we want to move away. Let's map it for safety but focus on author.

                title: newReportData.title,
                description: newReportData.description,
                category: newReportData.category,
                status: newReportData.status || 'pendiente',
                upvotes_count: 0,
                comments_count: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),

                // ✅ IDENTITY SSOT (Critical Fix)
                author: {
                    id: creator.creator_id,
                    alias: creator.displayAlias,
                    avatarUrl: creator.avatarUrl || getAvatarUrl(creator.creator_id),
                    isAuthor: true // Implicit owner
                },

                // Nullable fields
                zone: newReportData.zone || null,
                address: newReportData.address || null,
                latitude: newReportData.latitude ?? null,
                longitude: newReportData.longitude ?? null,
                last_edited_at: null,
                incident_date: newReportData.incident_date ?? null,
                // Flat fields GONE
                priority_zone: null,
                distance_meters: null,

                // Optional fields
                province: undefined,
                locality: undefined,
                department: undefined,

                // Optional fields
                threads_count: 0,
                image_urls: [],
                is_favorite: false,
                is_flagged: false,
                flags_count: 0,
                _isOptimistic: true // UI helper
            }

            // 5. STORE IMMEDIATELY (0ms UI Update)
            reportsCache.prepend(queryClient, optimisticReport)

            // 6. Update Stats Optimistically (Same as before)
            if (previousGlobalStats) {
                queryClient.setQueryData(
                    queryKeys.stats.global,
                    (old: any) => ({ ...old, total_reports: (old?.total_reports || 0) + 1 })
                )
            }
            if (previousCategoryStats && newReportData.category) {
                queryClient.setQueryData(
                    queryKeys.stats.categories,
                    (old: any) => ({
                        ...old,
                        [newReportData.category]: (old?.[newReportData.category] || 0) + 1
                    })
                )
            }

            return { previousReports, previousGlobalStats, previousCategoryStats, reportId }
        },
        onSuccess: (serverReport, _newReportData, context) => {
            // SERVER RECONCILIATION
            if (context?.reportId && serverReport.id !== context.reportId) {
                reportsCache.swapId(queryClient, context.reportId, serverReport.id)
            }

            // MERGE & PATCH
            reportsCache.patch(queryClient, serverReport.id, {
                ...serverReport,
                _isOptimistic: false
            })
            // Storage sync omitted
        },
        onError: (_err, _newReport, context) => {
            // Rollback
            if (context?.reportId) {
                reportsCache.remove(queryClient, context.reportId)
            }
            if (context?.previousGlobalStats) {
                queryClient.setQueryData(queryKeys.stats.global, context.previousGlobalStats)
            }
            if (context?.previousCategoryStats) {
                queryClient.setQueryData(queryKeys.stats.categories, context.previousCategoryStats)
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.stats.global })
            queryClient.invalidateQueries({ queryKey: queryKeys.stats.categories })
        },
    })
}

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
            // ✅ ENTERPRISE RULE: Never invalidate detail on update. Rely on Optimistic + SSE.
            // queryClient.invalidateQueries({ queryKey: queryKeys.reports.detail(id) })
            queryClient.invalidateQueries({ queryKey: queryKeys.stats.global })
            queryClient.invalidateQueries({ queryKey: queryKeys.stats.categories })
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
            queryClient.invalidateQueries({ queryKey: queryKeys.stats.global })
            queryClient.invalidateQueries({ queryKey: queryKeys.stats.categories })
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
        onError: (_, reportId, context) => {
            if (context?.previousDetail) {
                queryClient.setQueryData(queryKeys.reports.detail(reportId), context.previousDetail)
            }
        },
        onSettled: (_, __, reportId) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.reports.detail(reportId) })
            queryClient.invalidateQueries({ queryKey: queryKeys.user.favorites })
            triggerBadgeCheck()
        },
    })
}

export function useFlagReportMutation() {
    const queryClient = useQueryClient()
    const { checkAuth } = useAuthGuard()

    return useMutation({
        mutationFn: async ({ reportId, reason }: { reportId: string; reason?: string }) => {
            if (!checkAuth()) throw new Error('AUTH_REQUIRED');
            return reportsApi.flag(reportId, reason);
        },
        onMutate: async ({ reportId }) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.reports.all })
            const previousDetail = queryClient.getQueryData<Report>(queryKeys.reports.detail(reportId))
            if (previousDetail) {
                reportsCache.patch(queryClient, reportId, { is_flagged: true })
            }
            return { previousDetail, reportId }
        },
        onError: (_, __, context) => {
            if (context?.reportId && context.previousDetail) {
                queryClient.setQueryData(queryKeys.reports.detail(context.reportId), context.previousDetail)
            }
        },
        onSettled: (_, __, { reportId }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.reports.detail(reportId) })
            queryClient.invalidateQueries({ queryKey: ['reports', 'list'] })
            triggerBadgeCheck()
        },
    })
}
