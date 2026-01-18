import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useReportDetailQuery } from '@/hooks/queries/useReportsQuery'
import { queryKeys } from '@/lib/queryKeys'
import type { Report } from '@/lib/schemas'

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

    // Use React Query for loading and polling
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

    // Optimized for 0ms lag: Just provides a bridge to the cache if needed
    // though most components should use the mutations directly.
    const updateReport = useCallback((updated: Report) => {
        if (!reportId) return
        queryClient.setQueryData(queryKeys.reports.detail(reportId), updated)
    }, [reportId, queryClient])

    const markAsDeleted = useCallback(() => {
        setLocalDeleted(true)
    }, [])

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
