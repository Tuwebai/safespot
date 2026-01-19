import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'
import { reportsApi, type ReportFilters, type CreateReportData } from '@/lib/api'
import { type Report } from '@/lib/schemas'
import { triggerBadgeCheck } from '@/hooks/useBadgeNotifications'
import { useAnonymousId } from '@/hooks/useAnonymousId'
import { normalizeReportForUI, type NormalizedReport } from '@/lib/normalizeReport'
// ✅ PHASE 2: Auth Guard for Mutations
import { useAuthGuard } from '@/hooks/useAuthGuard'
// 🔵 ROBUSTNESS FIX: Resolve creator correctly in optimistic updates
import { resolveCreator } from '@/lib/auth/resolveCreator'

// Enterprise Data Freshness SLA:
// - UI may show data up to 1 minute old (staleTime).
// - Consistency > Freshness for UX stability.
// - "Refetch" never degrades the UI (0 items) if valid data exists.
// - Invalid backend responses trigger silent alerts, not UI crashes.

// ============================================
// QUERIES (READ)
// ============================================

import { reportsCache } from '@/lib/cache-helpers'

// ... imports remain the same

// ============================================
// QUERIES (READ)
// ============================================

/**
 * Get a single report by ID from cache (SSOT)
 * ✅ HIGH #13 FIX: Returns NormalizedReport for type safety
 * ✅ CRITICAL FIX: Defines queryFn to prevent "No queryFn" error
 * ✅ CRITICAL #14 FIX: Stores ONLY normalized entities in cache
 */
export function useReport(id: string) {
    const queryClient = useQueryClient()

    return useQuery<NormalizedReport>({
        queryKey: queryKeys.reports.detail(id),

        queryFn: async () => {
            // Fetch from API
            const report = await reportsApi.getById(id)

            if (!report) {
                throw new Error(`Report ${id} not found`)
            }

            // ✅ CRITICAL: Normalize ONCE
            const normalized = normalizeReportForUI(report)

            // ✅ CRITICAL #14: Store ONLY normalized entity in cache
            queryClient.setQueryData(queryKeys.reports.detail(id), normalized)

            // ✅ Return exactly what was stored
            return normalized
        },

        enabled: !!id,
        staleTime: 5 * 60 * 1000, // 5 minutes
    })
}

/**
 * Fetch all reports with optional filters.
 * Returns a list of IDs.
 * Side Effect: Normalizes reports into the detail cache.
 */
export function useReportsQuery(filters?: ReportFilters) {
    const queryClient = useQueryClient()
    const anonymousId = useAnonymousId()  // ✅ SSOT for identity

    return useQuery<Report[], Error, string[]>({
        queryKey: queryKeys.reports.list(filters),  // Standard key for SSOT cache matching
        queryFn: async () => {
            // Enterprise: Fetch raw entities. Do NOT normalize here.
            // Normalization must happen in 'select' to guarantee synchronous availability for rendering.
            return await reportsApi.getAll(filters)
        },
        enabled: !!anonymousId,  // ✅ CRITICAL: Never execute with null ID
        // ENTERPRISE: No initialData from localStorage.
        // We trust React Query cache + Persistence (gcTime) ONLY.
        staleTime: 30 * 1000,
        refetchOnWindowFocus: true, // ✅ Re-check on focus
        refetchOnMount: 'always',   // ✅ CRITICAL: Force check on mount (fixes idle staleness)
        // ✅ PRODUCTION FIX: Use global retry config (retry: 3) for consistency
        // SAFETY: Firewall against cache corruption.
        select: (data) => {
            // CRITICAL FIX: Never return [] for invalid data.
            if (!Array.isArray(data)) {
                const validationError = new Error('SERVER_CONTRACT_VIOLATION: Expected array of reports')
                import('@sentry/react').then(({ captureException }) => {
                    captureException(validationError, {
                        extra: { context: 'useReportsQuery:select', received: typeof data }
                    })
                }).catch(() => console.error(validationError))
                throw validationError
            }

            // SYNCHRONOUS NORMALIZATION (The Fix)
            // By storing here, we guarantee that when 'ids' are returned to the UI,
            // the entities are ALREADY in the 'detail' cache.
            // This prevents the "Ghost List" race condition.
            return reportsCache.store(queryClient, data)
        },
        // 🟡 ROBUSTNESS FIX: Conditional placeholderData
        // Public query but may fail due to filters/auth. Using previousData without
        // fallback to [] allows errors to propagate while maintaining smooth UX.
        // If error occurs, previousData will be undefined and UI can handle it.
        placeholderData: (previousData) => previousData,
    })
}

/**
 * Batched Selector for Maps/Clustering
 * efficiently resolves a list of IDs to full Report objects from the cache.
 * Reactive: Updates when individual reports change (via SSE/Mutation).
 * SSOT: Reads from the canonical ['reports', 'detail', id] keys.
 * 
 * Performance Note: This creates an observer for each ID.
 * Use valid IDs derived from useReportsQuery to minimize overhead.
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
        }))
    })

    // Map and filter valid reports
    return result.map(q => q.data).filter((r): r is Report => !!r)
}

/**
 * Fetch a single report by ID (Server Fallback)
 * Use this ONLY when you don't have the ID in a list yet (e.g. direct link).
 * Otherwise prefer useReport(id).
 */
export function useReportDetailQuery(reportId: string | undefined, enabled = true) {
    const queryClient = useQueryClient()
    const anonymousId = useAnonymousId()

    return useQuery<NormalizedReport>({
        queryKey: queryKeys.reports.detail(reportId ?? ''), // ✅ Match SSOT Key
        queryFn: async () => {
            if (!reportId) throw new Error("No ID")
            const report = await reportsApi.getById(reportId)
            if (!report) throw new Error("Not found")

            // ✅ CRITICAL: Normalize BEFORE storing
            const normalized = normalizeReportForUI(report)
            reportsCache.store(queryClient, [report])

            // ✅ Return normalized report from cache
            return normalized
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

// ... (previous imports and code)

/**
 * Create a new report
 * Invalidates report list cache on success
 */
export function useCreateReportMutation() {
    const queryClient = useQueryClient()
    const { checkAuth } = useAuthGuard() // ✅ PHASE 2: Auth guard

    return useMutation({
        mutationFn: async (data: CreateReportData) => {
            // ✅ AUTH GUARD: Block anonymous users
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
            // If ID was passed, use it. Otherwise generate one.
            // We mutate the object to ensure mutationFn sends the SAME ID.
            if (!newReportData.id) {
                newReportData.id = crypto.randomUUID()
            }
            const reportId = newReportData.id!

            // 🔵 ROBUSTNESS FIX: Resolve creator correctly
            const creator = resolveCreator();

            // 4. Create Optimistic Report (Final ID, no Temp)
            // ✅ ENTERPRISE FIX: Complete entity with ALL required fields matching schema
            const optimisticReport: Report = {
                // Required fields
                id: reportId,
                anonymous_id: creator.creator_id || '', // 🔵 FIX: Use correct creator
                title: newReportData.title,
                description: newReportData.description,
                category: newReportData.category,
                status: newReportData.status || 'pendiente',
                upvotes_count: 0,
                comments_count: 0,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),

                // Nullable fields (use null, not undefined)
                zone: newReportData.zone || null,
                address: newReportData.address || null,
                latitude: newReportData.latitude ?? null,
                longitude: newReportData.longitude ?? null,
                last_edited_at: null,
                incident_date: newReportData.incident_date ?? null,
                avatar_url: null,
                alias: null,
                priority_zone: null,
                distance_meters: null,

                // Optional fields (schema defines as string | undefined)
                province: undefined,
                locality: undefined,
                department: undefined,

                // Optional fields
                threads_count: 0,
                image_urls: [],
                is_favorite: false,
                is_flagged: false,
                flags_count: 0,
            }

            // 5. STORE IMMEDIATELY (0ms UI Update)
            // ✅ CRITICAL: Normalize BEFORE inserting into cache
            reportsCache.prepend(queryClient, optimisticReport)

            // 6. Update Stats Optimistically
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
        onSuccess: (serverReport) => {
            // SERVER CONFIRMATION
            // The ID is the same. We just merge any server-side fields (like created_at exact time, anonymous_id).
            // We do NOT swap IDs.

            reportsCache.patch(queryClient, serverReport.id, {
                ...serverReport,
                _isOptimistic: false
            })

            // Update localStorage (persistence)
            try {
                const defaultKey = queryKeys.reports.list()
                const defaultIds = queryClient.getQueryData<string[]>(defaultKey)
                if (defaultIds && defaultIds.includes(serverReport.id)) {
                    const allReports = defaultIds
                        .map(id => queryClient.getQueryData<Report>(queryKeys.reports.detail(id)))
                        .filter(Boolean) as Report[]
                    localStorage.setItem('safespot_reports_all_v2', JSON.stringify(allReports))
                }
            } catch (e) { console.error('Storage update failed', e) }
        },
        onError: (_err, _newReport, context) => {
            // Rollback: Remove values
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
            // Final Sync (Stats only, reports are SSOT managed)
            queryClient.invalidateQueries({ queryKey: queryKeys.stats.global })
            queryClient.invalidateQueries({ queryKey: queryKeys.stats.categories })
        },
    })
}

/**
 * Update an existing report
 * Invalidates both the specific report and all lists
 */
export function useUpdateReportMutation() {
    const queryClient = useQueryClient()
    const { checkAuth } = useAuthGuard() // ✅ PHASE 2: Auth guard

    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<CreateReportData> }) => {
            // ✅ AUTH GUARD: Block anonymous users
            if (!checkAuth()) {
                throw new Error('AUTH_REQUIRED');
            }
            return reportsApi.update(id, data);
        },
        onMutate: async ({ id, data }) => {
            // 1. Cancel outgoing queries
            await queryClient.cancelQueries({ queryKey: queryKeys.reports.all })
            await queryClient.cancelQueries({ queryKey: queryKeys.reports.detail(id) })

            // 2. Snapshot previous values
            const previousDetail = queryClient.getQueryData<Report>(queryKeys.reports.detail(id))

            // 3. Optimistic Update: Use SSOT Patch Helper
            reportsCache.patch(queryClient, id, data as unknown as Partial<Report>)

            return { previousDetail }
        },
        onError: (_err, { id }, context) => {
            // Rollback Detail
            if (context?.previousDetail) {
                queryClient.setQueryData(queryKeys.reports.detail(id), context.previousDetail)
            }
        },
        onSettled: (_data, _error, { id }) => {
            // Final Sync
            queryClient.invalidateQueries({ queryKey: queryKeys.reports.detail(id) })
            // queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.stats.global })
            queryClient.invalidateQueries({ queryKey: queryKeys.stats.categories })
        }
    })
}

/**
 * Delete a report
 * Removes from cache instantly (Optimistic)
 */
export function useDeleteReportMutation() {
    const queryClient = useQueryClient()
    const { checkAuth } = useAuthGuard() // ✅ PHASE 2: Auth guard

    return useMutation({
        mutationFn: async (id: string) => {
            // ✅ AUTH GUARD: Block anonymous users
            if (!checkAuth()) {
                throw new Error('AUTH_REQUIRED');
            }
            return reportsApi.delete(id);
        },
        onMutate: async (id) => {
            // 1. Cancel outgoing queries for reports and stats
            await queryClient.cancelQueries({ queryKey: queryKeys.reports.all })
            await queryClient.cancelQueries({ queryKey: queryKeys.stats.global })
            await queryClient.cancelQueries({ queryKey: queryKeys.stats.categories })

            // 2. Snapshot previous values
            const previousReports = queryClient.getQueriesData({ queryKey: ['reports', 'list'] })
            const previousGlobalStats = queryClient.getQueryData(queryKeys.stats.global)
            const previousCategoryStats = queryClient.getQueryData(queryKeys.stats.categories)

            // 3. Find report category for category stats update
            let reportCategory: string | null = null
            const detailData = queryClient.getQueryData<Report>(queryKeys.reports.detail(id))
            if (detailData) {
                reportCategory = detailData.category
            }

            // 4. Optimistic Update - Remove FROM SSOT
            reportsCache.remove(queryClient, id)

            // 5. Optimistic Update - Global Stats
            if (previousGlobalStats) {
                queryClient.setQueryData(
                    queryKeys.stats.global,
                    (old: any) => ({
                        ...old,
                        total_reports: Math.max(0, (old?.total_reports || 1) - 1)
                    })
                )
            }

            // 6. Optimistic Update - Category Stats
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
            // Rollback reports
            if (context?.previousReports) {
                context.previousReports.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data)
                })
            }
            // Rollback detail - ideally we would put it back from a snapshot, 
            // but context.previousDetail was not strictly captured above (implied in remove logic potentially needing revert).
            // Simplifying rollback to invalidate for now or basic list restore.
            // Ideally we should have captured the detail to restore it.

            // Rollback global stats
            if (context?.previousGlobalStats) {
                queryClient.setQueryData(queryKeys.stats.global, context.previousGlobalStats)
                queryClient.setQueryData(queryKeys.stats.categories, context.previousCategoryStats)
            }
        },
        onSettled: () => {
            // Final Sync
            // PROTECTED: Do not invalidate reports.all. Trust SSE/Optimistic.
            // queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.stats.global })
            queryClient.invalidateQueries({ queryKey: queryKeys.stats.categories })
        },
    })
}

/**
 * Toggle favorite status
 * Optimistically updates the cache
 */
export function useToggleFavoriteMutation() {
    const queryClient = useQueryClient()
    const { checkAuth } = useAuthGuard() // ✅ PHASE 2: Auth guard

    return useMutation({
        mutationFn: async (reportId: string) => {
            // ✅ AUTH GUARD: Block anonymous users
            if (!checkAuth()) {
                throw new Error('AUTH_REQUIRED');
            }
            return reportsApi.toggleFavorite(reportId);
        },
        onMutate: async (reportId) => {
            // 1. Cancel outgoing refetches (so they don't overwrite our optimistic update)
            await queryClient.cancelQueries({ queryKey: queryKeys.reports.all })

            // 2. Snapshot previous values for rollback
            const previousDetail = queryClient.getQueryData<Report>(queryKeys.reports.detail(reportId))

            // 3. Optimistically update Detail Cache
            if (previousDetail) {
                reportsCache.patch(queryClient, reportId, { is_favorite: !previousDetail.is_favorite })
            }

            return { previousDetail }
        },
        onError: (_, reportId, context) => {
            // Rollback Detail
            if (context?.previousDetail) {
                queryClient.setQueryData(queryKeys.reports.detail(reportId), context.previousDetail)
            }
        },
        onSettled: (_, __, reportId) => {
            // Refetch essential data to stay in sync with server
            queryClient.invalidateQueries({ queryKey: queryKeys.reports.detail(reportId) })
            queryClient.invalidateQueries({ queryKey: queryKeys.user.favorites })

            // Check badges
            triggerBadgeCheck()
        },
    })
}

/**
 * Flag a report
 * Updates flagged status in cache
 */
export function useFlagReportMutation() {
    const queryClient = useQueryClient()
    const { checkAuth } = useAuthGuard() // ✅ PHASE 2: Auth guard

    return useMutation({
        mutationFn: async ({ reportId, reason }: { reportId: string; reason?: string }) => {
            // ✅ AUTH GUARD: Block anonymous users
            if (!checkAuth()) {
                throw new Error('AUTH_REQUIRED');
            }
            return reportsApi.flag(reportId, reason);
        },
        onMutate: async ({ reportId }) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: queryKeys.reports.all })

            // Snapshot previous value
            const previousDetail = queryClient.getQueryData<Report>(queryKeys.reports.detail(reportId))

            // Optimistically update Detail
            if (previousDetail) {
                reportsCache.patch(queryClient, reportId, { is_flagged: true })
            }

            return { previousDetail, reportId }
        },
        onError: (_, __, context) => {
            if (context?.reportId) {
                // Rollback detail
                if (context.previousDetail) {
                    queryClient.setQueryData(queryKeys.reports.detail(context.reportId), context.previousDetail)
                }
            }
        },
        onSettled: (_, __, { reportId }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.reports.detail(reportId) })
            queryClient.invalidateQueries({ queryKey: ['reports', 'list'] })
            triggerBadgeCheck()
        },
    })
}
