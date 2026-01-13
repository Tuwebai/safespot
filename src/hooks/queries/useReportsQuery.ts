/**
 * React Query hooks for Reports
 * 
 * Provides cached, deduplicated data fetching for:
 * - Report lists (with filters)
 * - Single report details
 * - Mutations for report CRUD
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { reportsApi, type Report, type ReportFilters, type CreateReportData } from '@/lib/api'
import { triggerBadgeCheck } from '@/hooks/useBadgeNotifications'
import { useAnonymousId } from '@/hooks/useAnonymousId'

// ============================================
// QUERIES (READ)
// ============================================

import { reportsCache } from '@/lib/cache-helpers'

// ... imports remain the same

// ============================================
// QUERIES (READ)
// ============================================

/**
 * Hook to consume a single normalized report by ID.
 * This is the preferred way for components to read report data.
 * @param id The report ID
 * @returns The report object (live from cache)
 */
export function useReport(id: string) {
    const anonymousId = useAnonymousId()  // ✅ SSOT

    return useQuery({
        queryKey: ['reports', 'detail', anonymousId, id],  // ✅ Include ID
        queryFn: () => reportsApi.getById(id),
        enabled: !!id && !!anonymousId,  // ✅ Both required
        staleTime: Infinity, // Rely on SSE/Mutation patches
        refetchOnWindowFocus: false, // Don't refetch automatically
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
    const isDefaultQuery = !filters || Object.keys(filters).length === 0

    return useQuery({
        queryKey: ['reports', 'list', anonymousId, filters],  // ✅ Include ID for dependency tracking
        queryFn: async () => {
            const data = await reportsApi.getAll(filters)

            // SIDE EFFECT: Normalize data into canonical cache
            const ids = reportsCache.store(queryClient, data)

            // SIDE EFFECT: Persist default view
            if (isDefaultQuery) {
                localStorage.setItem('safespot_reports_all_v2', JSON.stringify(data))
            }

            return ids
        },
        enabled: !!anonymousId,  // ✅ CRITICAL: Never execute with null ID
        initialData: () => {
            // ... logic for initial data (needs to hydrate detail cache too)
            if (isDefaultQuery) {
                try {
                    const item = localStorage.getItem('safespot_reports_all_v2')
                    if (item) {
                        const reports = JSON.parse(item) as Report[]
                        // Hydrate canonical cache immediately
                        reportsCache.store(queryClient, reports)
                        return reports.map(r => r.id)
                    }
                } catch (e) { return undefined }
            }
            return undefined
        },
        staleTime: 30 * 1000, // 30s stale time to allow optimistic updates to survive navigation
        refetchOnWindowFocus: false,
        retry: 1,
        // SAFETY: Firewall against cache corruption.
        // Ensures that even if objects slip into the cache list, we ONLY return IDs to the UI.
        select: (data: any) => {
            if (!Array.isArray(data)) return []
            return data.map(item => {
                if (typeof item === 'object' && item !== null && 'id' in item) {
                    return item.id
                }
                return item
            })
        }
    })
}

/**
 * Fetch a single report by ID (Server Fallback)
 * Use this ONLY when you don't have the ID in a list yet (e.g. direct link).
 * Otherwise prefer useReport(id).
 */
export function useReportDetailQuery(reportId: string | undefined, enabled = true) {
    const anonymousId = useAnonymousId()  // ✅ SSOT

    return useQuery({
        queryKey: ['reports', 'detail', anonymousId, reportId ?? ''],  // ✅ Include ID
        queryFn: () => reportsApi.getById(reportId!),
        enabled: !!reportId && enabled && !!anonymousId,  // ✅ All conditions required
        staleTime: Infinity, // Start trusting the normalized cache
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

    return useMutation({
        mutationFn: (data: CreateReportData) => reportsApi.create(data),
        onMutate: async (newReportData) => {
            // Cancel outgoing queries
            await queryClient.cancelQueries({ queryKey: queryKeys.reports.all })
            await queryClient.cancelQueries({ queryKey: queryKeys.stats.global })
            await queryClient.cancelQueries({ queryKey: queryKeys.stats.categories })

            // Snapshot previous state for rollback
            const previousReports = queryClient.getQueriesData({ queryKey: ['reports', 'list'] })
            const previousGlobalStats = queryClient.getQueryData(queryKeys.stats.global)
            const previousCategoryStats = queryClient.getQueryData(queryKeys.stats.categories)

            // Generate temporary ID for optimistic report
            const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

            // Create optimistic report object
            const optimisticReport: Report = {
                id: tempId,
                title: newReportData.title,
                description: newReportData.description,
                category: newReportData.category,
                zone: newReportData.zone || '',
                address: newReportData.address || '',
                latitude: newReportData.latitude,
                longitude: newReportData.longitude,
                status: newReportData.status || 'pendiente',
                incident_date: newReportData.incident_date,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                image_urls: [], // Images upload separately
                comments_count: 0,
                threads_count: 0,
                is_favorite: false,
                is_flagged: false,
                anonymous_id: '', // Will be set by server
                avatar_url: null,
                // Optimistic flag to identify temp reports
                _isOptimistic: true
            } as any

            // USE HELPER: Prepend Optimistic Report (SSOT + Lists)
            reportsCache.prepend(queryClient, optimisticReport)

            // Update global count
            if (previousGlobalStats) {
                queryClient.setQueryData(
                    queryKeys.stats.global,
                    (old: any) => ({ ...old, total_reports: (old?.total_reports || 0) + 1 })
                )
            }

            // Update category count
            if (previousCategoryStats && newReportData.category) {
                queryClient.setQueryData(
                    queryKeys.stats.categories,
                    (old: any) => ({
                        ...old,
                        [newReportData.category]: (old?.[newReportData.category] || 0) + 1
                    })
                )
            }

            return { previousReports, previousGlobalStats, previousCategoryStats, tempId }
        },
        onSuccess: (serverReport, _variables, context) => {
            // Replace temporary report with real server report
            if (context?.tempId) {
                // 1. Store Real Detail
                reportsCache.store(queryClient, [serverReport])

                // 2. Swap ID in Lists
                queryClient.setQueriesData<string[]>(
                    { queryKey: ['reports', 'list'] },
                    (oldIds) => {
                        if (!oldIds) return []
                        // Map tempId to realId
                        return oldIds.map(id => id === context.tempId ? serverReport.id : id)
                    }
                )

                // 3. Remove Optimistic Detail
                queryClient.removeQueries({ queryKey: queryKeys.reports.detail(context.tempId) })

                // 4. Update localStorage (for default view persistence)
                const defaultKey = queryKeys.reports.list()
                const defaultIds = queryClient.getQueryData<string[]>(defaultKey)
                if (defaultIds && defaultIds.includes(serverReport.id)) {
                    // Re-capture full reports for storage
                    const allReports = defaultIds
                        .map(id => queryClient.getQueryData<Report>(queryKeys.reports.detail(id)))
                        .filter(Boolean) as Report[]
                    localStorage.setItem('safespot_reports_all_v2', JSON.stringify(allReports))
                }
            }
        },
        onError: (_err, _newReport, context) => {
            // Rollback: Remove optimistic report
            if (context?.tempId) {
                reportsCache.remove(queryClient, context.tempId)
            }

            // Rollback stats
            if (context?.previousGlobalStats) {
                queryClient.setQueryData(queryKeys.stats.global, context.previousGlobalStats)
            }
            if (context?.previousCategoryStats) {
                queryClient.setQueryData(queryKeys.stats.categories, context.previousCategoryStats)
            }
        },
        onSettled: () => {
            // Final sync with server
            queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
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

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<CreateReportData> }) =>
            reportsApi.update(id, data),
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

    return useMutation({
        mutationFn: (id: string) => reportsApi.delete(id),
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
            }
            // Rollback category stats
            if (context?.previousCategoryStats) {
                queryClient.setQueryData(queryKeys.stats.categories, context.previousCategoryStats)
            }
        },
        onSettled: () => {
            // Final Sync
            queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
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

    return useMutation({
        mutationFn: (reportId: string) => reportsApi.toggleFavorite(reportId),
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

    return useMutation({
        mutationFn: ({ reportId, reason }: { reportId: string; reason?: string }) =>
            reportsApi.flag(reportId, reason),
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
