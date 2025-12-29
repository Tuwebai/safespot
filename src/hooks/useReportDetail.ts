import { useCallback } from 'react'
import { useReportDetailQuery } from '@/hooks/queries/useReportsQuery'
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
    // Use React Query for loading and polling (polling enabled in useReportDetailQuery)
    const {
        data: report = null,
        isLoading: loading,
        error: queryError,
        refetch: refetchQuery
    } = useReportDetailQuery(reportId)

    // Derived state
    const isFavorite = report?.is_favorite ?? false
    const error = queryError instanceof Error ? queryError.message : queryError ? String(queryError) : null

    // ============================================
    // ACTIONS (Maintaining legacy interface for DetalleReporte.tsx)
    // ============================================

    const updateReport = useCallback((_updated: Report) => {
        // Compatibility method
    }, [])

    const markAsDeleted = useCallback(() => {
        // Compatibility method
    }, [])

    const refetch = useCallback(async () => {
        await refetchQuery()
    }, [refetchQuery])

    return {
        report,
        loading,
        error,
        isDeleted: false,
        isFavorite,
        updateReport,
        markAsDeleted,
        refetch,
    }
}
