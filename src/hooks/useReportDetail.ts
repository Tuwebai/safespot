import { useState, useEffect, useCallback, useRef } from 'react'
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
    isDeleted: boolean
    isFavorite: boolean
    savingFavorite: boolean
    toggleFavorite: () => Promise<void>
    updateReport: (updated: Report) => void
    markAsDeleted: () => void
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
    const [isDeleted, setIsDeleted] = useState(false)

    // Refs for synchronous access in callbacks
    const isDeletedRef = useRef(false)
    const prevReportIdRef = useRef<string | undefined>(undefined)

    // Derived state
    const isFavorite = report?.is_favorite ?? false

    // ============================================
    // DATA LOADING
    // ============================================

    const loadReport = useCallback(async () => {
        // Guard: never fetch a deleted report
        if (!reportId || isDeletedRef.current) {
            return
        }

        try {
            setLoading(true)
            setError(null)
            const data = await reportsApi.getById(reportId)

            // Double-check: don't update state if report was deleted during fetch
            if (isDeletedRef.current) return

            setReport(data)
        } catch (err) {
            // If deleted, silently ignore errors
            if (isDeletedRef.current) return

            const errorInfo = handleError(err, toast.error, 'useReportDetail.loadReport')
            setError(errorInfo.userMessage)
        } finally {
            if (!isDeletedRef.current) {
                setLoading(false)
            }
        }
    }, [reportId, toast])

    // Effect: Reset state ONLY when reportId actually changes
    useEffect(() => {
        if (reportId && reportId !== prevReportIdRef.current) {
            // New report - reset deleted state
            isDeletedRef.current = false
            setIsDeleted(false)
            setReport(null)
            setError(null)
            prevReportIdRef.current = reportId
        }
    }, [reportId])

    // Effect: Load report (respects isDeleted)
    useEffect(() => {
        // Skip if no reportId or if this report was deleted
        if (!reportId || isDeletedRef.current) {
            return
        }

        loadReport()
    }, [reportId, loadReport])

    // ============================================
    // ACTIONS
    // ============================================

    const toggleFavorite = useCallback(async () => {
        if (!reportId || savingFavorite || isDeletedRef.current) return

        try {
            setSavingFavorite(true)
            const result = await reportsApi.toggleFavorite(reportId)

            if (!result || typeof result !== 'object' || typeof result.is_favorite !== 'boolean') {
                throw new Error('Respuesta inválida del servidor: is_favorite debe ser un booleano')
            }

            if (!isDeletedRef.current) {
                setReport(prev => prev ? { ...prev, is_favorite: result.is_favorite } : null)
            }
        } catch (err) {
            handleErrorWithMessage(err, 'Error al guardar en favoritos', toast.error, 'useReportDetail.toggleFavorite')
        } finally {
            setSavingFavorite(false)
        }
    }, [reportId, savingFavorite, toast])

    const updateReport = useCallback((updated: Report) => {
        if (!isDeletedRef.current) {
            setReport(updated)
        }
    }, [])

    const markAsDeleted = useCallback(() => {
        // Mark as deleted immediately - this is synchronous
        isDeletedRef.current = true
        setIsDeleted(true)
        setReport(null)
        setError(null)
        setLoading(false)
    }, [])

    const refetch = useCallback(async () => {
        if (!isDeletedRef.current) {
            await loadReport()
        }
    }, [loadReport])

    return {
        report,
        loading,
        error,
        isDeleted,
        isFavorite,
        savingFavorite,
        toggleFavorite,
        updateReport,
        markAsDeleted,
        refetch,
    }
}
