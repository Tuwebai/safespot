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

// ============================================
// QUERIES (READ)
// ============================================

/**
 * Fetch all reports with optional filters
 * Cached for 30 seconds by default
 */
export function useReportsQuery(filters?: ReportFilters) {
    return useQuery({
        queryKey: queryKeys.reports.list(filters),
        queryFn: () => reportsApi.getAll(filters),
        staleTime: 60 * 1000, // 1 minute staling
        refetchOnWindowFocus: false,
        retry: 1, // Minimize retries
    })
}

/**
 * Fetch a single report by ID
 * Used by DetalleReporte page
 */
export function useReportDetailQuery(reportId: string | undefined, enabled = true) {
    return useQuery({
        queryKey: queryKeys.reports.detail(reportId ?? ''),
        queryFn: () => reportsApi.getById(reportId!),
        enabled: !!reportId && enabled,
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
    })
}

// ============================================
// MUTATIONS (WRITE)
// ============================================

/**
 * Create a new report
 * Invalidates report list cache on success
 */
export function useCreateReportMutation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (data: CreateReportData) => reportsApi.create(data),
        onMutate: async (newReportData) => {
            // Standard Optimistic UI for stats
            await queryClient.cancelQueries({ queryKey: queryKeys.stats.global })
            await queryClient.cancelQueries({ queryKey: queryKeys.stats.categories })

            const previousGlobalStats = queryClient.getQueryData(queryKeys.stats.global)
            const previousCategoryStats = queryClient.getQueryData(queryKeys.stats.categories)

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

            return { previousGlobalStats, previousCategoryStats }
        },
        onError: (_err, _newReport, context) => {
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
            const previousLists = queryClient.getQueriesData<Report[]>({ queryKey: ['reports', 'list'] })

            // 3. Optimistic Update: Detail
            if (previousDetail) {
                queryClient.setQueryData<Report>(
                    queryKeys.reports.detail(id),
                    { ...previousDetail, ...data }
                )
            }

            // 4. Optimistic Update: Lists
            queryClient.setQueriesData<Report[]>(
                { queryKey: ['reports', 'list'] },
                (old) => old?.map(r => r.id === id ? { ...r, ...data } : r)
            )

            return { previousDetail, previousLists }
        },
        onError: (_err, { id }, context) => {
            // Rollback Detail
            if (context?.previousDetail) {
                queryClient.setQueryData(queryKeys.reports.detail(id), context.previousDetail)
            }
            // Rollback Lists
            if (context?.previousLists) {
                context.previousLists.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data)
                })
            }
        },
        onSettled: (_data, _error, { id }) => {
            // Final Sync
            queryClient.invalidateQueries({ queryKey: queryKeys.reports.detail(id) })
            queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.stats.global })
            queryClient.invalidateQueries({ queryKey: queryKeys.stats.categories })
        }
    })
}

/**
 * Delete a report
 * Removes from cache and invalidates lists
 */
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
            // Check in detail cache first
            const detailData = queryClient.getQueryData<Report>(queryKeys.reports.detail(id))
            if (detailData) {
                reportCategory = detailData.category
            } else {
                // Look in lists if not in detail
                for (const [_, data] of previousReports) {
                    const found = (data as Report[])?.find(r => r.id === id)
                    if (found) {
                        reportCategory = found.category
                        break
                    }
                }
            }

            // 4. Optimistic Update - Remove from Lists
            queryClient.setQueriesData<Report[]>(
                { queryKey: ['reports', 'list'] },
                (old) => old?.filter(r => r.id !== id)
            )

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

            // Remove detail immediately
            queryClient.removeQueries({ queryKey: queryKeys.reports.detail(id) })

            return { previousReports, previousGlobalStats, previousCategoryStats }
        },
        onError: (_err, _id, context) => {
            // Rollback reports
            if (context?.previousReports) {
                context.previousReports.forEach(([queryKey, data]) => {
                    queryClient.setQueryData(queryKey, data)
                })
            }
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
                queryClient.setQueryData<Report>(
                    queryKeys.reports.detail(reportId),
                    { ...previousDetail, is_favorite: !previousDetail.is_favorite }
                )
            }

            // 4. Optimistically update ALL Report Lists (Explorar, Reportes, etc.)
            // We use setQueriesData to match any list key starting with ['reports', 'list']
            queryClient.setQueriesData<Report[]>(
                { queryKey: ['reports', 'list'] },
                (old) => old?.map(report =>
                    report.id === reportId
                        ? { ...report, is_favorite: !report.is_favorite }
                        : report
                )
            )

            return { previousDetail }
        },
        onError: (_, reportId, context) => {
            // Rollback Detail
            if (context?.previousDetail) {
                queryClient.setQueryData(queryKeys.reports.detail(reportId), context.previousDetail)
            }
            // Rollback Lists (invert the toggle back)
            queryClient.setQueriesData<Report[]>(
                { queryKey: ['reports', 'list'] },
                (old) => old?.map(report =>
                    report.id === reportId
                        ? { ...report, is_favorite: !report.is_favorite }
                        : report
                )
            )
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
                queryClient.setQueryData<Report>(
                    queryKeys.reports.detail(reportId),
                    { ...previousDetail, is_flagged: true }
                )
            }

            // Optimistically update ALL Lists
            queryClient.setQueriesData<Report[]>(
                { queryKey: ['reports', 'list'] },
                (old) => old?.map(report =>
                    report.id === reportId ? { ...report, is_flagged: true } : report
                )
            )

            return { previousDetail, reportId }
        },
        onError: (_, __, context) => {
            if (context?.reportId) {
                // Rollback detail
                if (context.previousDetail) {
                    queryClient.setQueryData(queryKeys.reports.detail(context.reportId), context.previousDetail)
                }
                // Rollback lists
                queryClient.setQueriesData<Report[]>(
                    { queryKey: ['reports', 'list'] },
                    (old) => old?.map(report =>
                        report.id === context.reportId ? { ...report, is_flagged: false } : report
                    )
                )
            }
        },
        onSettled: (_, __, { reportId }) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.reports.detail(reportId) })
            queryClient.invalidateQueries({ queryKey: ['reports', 'list'] })
            triggerBadgeCheck()
        },
    })
}
