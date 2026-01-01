import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useReportDetailQuery } from '@/hooks/queries/useReportsQuery'
import { queryKeys } from '@/lib/queryKeys'
import type { Report } from '@/lib/api'

// ============================================
// TYPES
// ============================================

interface UseReportDetailProps {
    reportId: string | undefined
}

interface UseReportDetailReturn {
    report: Report | null
    loading: boolean
    error: string | null
    isDeleted: boolean
    isFavorite: boolean
    updateReport: (updated: Report) => void
    markAsDeleted: () => void
    refetch: () => Promise<void>
}

// ============================================
// HOOK
// ============================================

export function useReportDetail({ reportId }: UseReportDetailProps): UseReportDetailReturn {
    const queryClient = useQueryClient()
    const [localDeleted, setLocalDeleted] = useState(false)

    // Use React Query for loading and polling (polling enabled in useReportDetailQuery)
    const {
        data: report = null,
        isLoading: loading,
        error: queryError,
        refetch: refetchQuery
    } = useReportDetailQuery(reportId, !localDeleted)

    // Derived state
    const isFavorite = report?.is_favorite ?? false
    const error = queryError instanceof Error ? queryError.message : queryError ? String(queryError) : null

    // ============================================
    // ACTIONS
    // ============================================

    const updateReport = useCallback((updated: Report) => {
        if (!reportId) return

        // Directly update the Detail Cache for "0ms visual lag"
        queryClient.setQueryData(
            queryKeys.reports.detail(reportId),
            updated
        )

        // Also invalidate lists to ensure global consistency
        queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
    }, [reportId, queryClient])

    const markAsDeleted = useCallback(() => {
        if (!reportId) return
        setLocalDeleted(true)

        // Remove from cache immediately
        queryClient.removeQueries({ queryKey: queryKeys.reports.detail(reportId) })
        // Invalidate lists
        queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
    }, [reportId, queryClient])

    const refetch = useCallback(async () => {
        await refetchQuery()
    }, [refetchQuery])

    return {
        report,
        loading,
        error,
        isDeleted: localDeleted,
        isFavorite,
        updateReport,
        markAsDeleted,
        refetch,
    }
}
