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
export function useReportDetailQuery(reportId: string | undefined) {
    return useQuery({
        queryKey: queryKeys.reports.detail(reportId ?? ''),
        queryFn: () => reportsApi.getById(reportId!),
        enabled: !!reportId,
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
        onSuccess: () => {
            // Invalidate all report lists to refetch with new report
            queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
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
        onSuccess: (updatedReport, { id }) => {
            // Update the specific report in cache
            queryClient.setQueryData(
                queryKeys.reports.detail(id),
                updatedReport
            )
            // Invalidate lists to refetch
            queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
        },
    })
}

/**
 * Delete a report
 * Removes from cache and invalidates lists
 */
export function useDeleteReportMutation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: string) => reportsApi.delete(id),
        onSuccess: (_, id) => {
            // Remove from detail cache
            queryClient.removeQueries({ queryKey: queryKeys.reports.detail(id) })
            // Invalidate lists
            queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
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
