import { useState, useEffect, useCallback } from 'react'
import { reportsApi } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { handleError, handleErrorWithMessage } from '@/lib/errorHandler'
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
    isFavorite: boolean
    savingFavorite: boolean
    toggleFavorite: () => Promise<void>
    updateReport: (updated: Report) => void
    refetch: () => Promise<void>
}

// ============================================
// HOOK
// ============================================

export function useReportDetail({ reportId }: UseReportDetailProps): UseReportDetailReturn {
    const toast = useToast()

    const [report, setReport] = useState<Report | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [savingFavorite, setSavingFavorite] = useState(false)

    // Derived state
    const isFavorite = report?.is_favorite ?? false

    // ============================================
    // DATA LOADING
    // ============================================

    const loadReport = useCallback(async () => {
        if (!reportId) return

        try {
            setLoading(true)
            setError(null)
            const data = await reportsApi.getById(reportId)
            setReport(data)
        } catch (err) {
            const errorInfo = handleError(err, toast.error, 'useReportDetail.loadReport')
            setError(errorInfo.userMessage)
        } finally {
            setLoading(false)
        }
    }, [reportId, toast])

    // Load on mount and when reportId changes
    useEffect(() => {
        if (reportId) {
            loadReport()
        }
    }, [reportId, loadReport])

    // ============================================
    // ACTIONS
    // ============================================

    const toggleFavorite = useCallback(async () => {
        if (!reportId || savingFavorite) return

        try {
            setSavingFavorite(true)
            const result = await reportsApi.toggleFavorite(reportId)

            // Validate result structure
            if (!result || typeof result !== 'object' || typeof result.is_favorite !== 'boolean') {
                throw new Error('Respuesta inválida del servidor: is_favorite debe ser un booleano')
            }

            // Update report state
            setReport(prev => prev ? { ...prev, is_favorite: result.is_favorite } : null)
        } catch (err) {
            handleErrorWithMessage(err, 'Error al guardar en favoritos', toast.error, 'useReportDetail.toggleFavorite')
        } finally {
            setSavingFavorite(false)
        }
    }, [reportId, savingFavorite, toast])

    const updateReport = useCallback((updated: Report) => {
        setReport(updated)
    }, [])

    const refetch = useCallback(async () => {
        await loadReport()
    }, [loadReport])

    return {
        report,
        loading,
        error,
        isFavorite,
        savingFavorite,
        toggleFavorite,
        updateReport,
        refetch,
    }
}
