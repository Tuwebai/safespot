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

// ============================================
// QUERIES (READ)
// ============================================

/**
 * Fetch all reports with optional filters
 * Cached for 30 seconds by default, refetches on window focus
 */
export function useReportsQuery(filters?: ReportFilters) {
    return useQuery({
        queryKey: queryKeys.reports.list(filters),
        queryFn: () => reportsApi.getAll(filters),
        staleTime: 30 * 1000, // 30 seconds
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
        enabled: !!reportId, // Only fetch if we have an ID
        staleTime: 60 * 1000, // 1 minute for details
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
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: queryKeys.reports.detail(reportId) })

            // Snapshot previous value
            const previousReport = queryClient.getQueryData<Report>(
                queryKeys.reports.detail(reportId)
            )

            // Optimistically update
            if (previousReport) {
                queryClient.setQueryData<Report>(
                    queryKeys.reports.detail(reportId),
                    { ...previousReport, is_favorite: !previousReport.is_favorite }
                )
            }

            return { previousReport }
        },
        onError: (_, reportId, context) => {
            // Rollback on error
            if (context?.previousReport) {
                queryClient.setQueryData(
                    queryKeys.reports.detail(reportId),
                    context.previousReport
                )
            }
        },
        onSettled: (_, __, reportId) => {
            // Refetch to ensure consistency
            queryClient.invalidateQueries({ queryKey: queryKeys.reports.detail(reportId) })
            queryClient.invalidateQueries({ queryKey: queryKeys.user.favorites })
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
        onSuccess: (_, { reportId }) => {
            // Update the report in cache
            queryClient.setQueryData<Report>(
                queryKeys.reports.detail(reportId),
                (old) => old ? { ...old, is_flagged: true } : old
            )
            // Invalidate lists
            queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
        },
    })
}
