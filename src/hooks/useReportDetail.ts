import { useState, useEffect, useCallback, useRef } from 'react'
import { reportsApi } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { handleError } from '@/lib/errorHandler'
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
    const toast = useToast()

    const [report, setReport] = useState<Report | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
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
        // Guard: if no reportId, immediately resolve loading with error
        if (!reportId) {
            setLoading(false)
            setError('ID de reporte no válido')
            return
        }
        // Guard: never fetch a deleted report
        if (isDeletedRef.current) {
            setLoading(false)
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
            // CRITICAL: ALWAYS resolve loading state, regardless of deletion
            setLoading(false)
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
        // FAILSAFE: If no reportId or deleted, ensure loading resolves immediately
        if (!reportId || isDeletedRef.current) {
            setLoading(false)
            return
        }

        loadReport()
    }, [reportId, loadReport])

    // ============================================
    // ACTIONS
    // ============================================

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
        updateReport,
        markAsDeleted,
        refetch,
    }
}
