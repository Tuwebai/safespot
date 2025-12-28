import { useState, useCallback } from 'react'
import { reportsApi } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { handleErrorWithMessage } from '@/lib/errorHandler'

// ============================================
// STATE TYPES
// ============================================

type DialogType = 'flag' | 'delete' | null

interface FlagManagerState {
    openDialog: DialogType
    flaggingReport: boolean
    deletingReport: boolean
}

// ============================================
// HOOK
// ============================================

interface UseFlagManagerProps {
    reportId: string | undefined
    onReportFlagged?: () => void
    onReportDeleted?: () => void
}

export function useFlagManager({ reportId, onReportFlagged, onReportDeleted }: UseFlagManagerProps) {
    const toast = useToast()

    const [state, setState] = useState<FlagManagerState>({
        openDialog: null,
        flaggingReport: false,
        deletingReport: false,
    })

    // ============================================
    // DIALOG ACTIONS
    // ============================================

    const openFlagDialog = useCallback(() => {
        setState(prev => ({ ...prev, openDialog: 'flag' }))
    }, [])

    const openDeleteDialog = useCallback(() => {
        setState(prev => ({ ...prev, openDialog: 'delete' }))
    }, [])

    const closeDialog = useCallback(() => {
        setState(prev => ({ ...prev, openDialog: null }))
    }, [])

    // ============================================
    // FLAG OPERATIONS
    // ============================================

    const flagReport = useCallback(async (reason: string) => {
        if (!reportId || state.flaggingReport) return

        setState(prev => ({ ...prev, flaggingReport: true }))

        try {
            await reportsApi.flag(reportId, reason)
            toast.success('Reporte denunciado correctamente. Gracias por ayudar a mantener la comunidad segura.')
            onReportFlagged?.()
            setState(prev => ({ ...prev, openDialog: null, flaggingReport: false }))
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : ''

            if (errorMessage.includes('own report')) {
                toast.warning('No puedes denunciar tu propio reporte')
            } else if (errorMessage.includes('already flagged')) {
                toast.warning('Ya has denunciado este reporte anteriormente')
            } else {
                handleErrorWithMessage(error, 'Error al denunciar el reporte', toast.error, 'useFlagManager.flagReport')
            }
            setState(prev => ({ ...prev, flaggingReport: false }))
        }
    }, [reportId, state.flaggingReport, onReportFlagged, toast])

    // ============================================
    // DELETE OPERATIONS
    // ============================================

    const deleteReport = useCallback(async () => {
        if (!reportId || state.deletingReport) return

        setState(prev => ({ ...prev, deletingReport: true }))

        try {
            await reportsApi.delete(reportId)
            toast.success('Reporte eliminado correctamente')
            onReportDeleted?.()
        } catch (error) {
            handleErrorWithMessage(error, 'Error al eliminar el reporte', toast.error, 'useFlagManager.deleteReport')
            setState(prev => ({ ...prev, deletingReport: false }))
        }
    }, [reportId, state.deletingReport, onReportDeleted, toast])

    return {
        // State
        openDialog: state.openDialog,
        flaggingReport: state.flaggingReport,
        deletingReport: state.deletingReport,
        isFlagDialogOpen: state.openDialog === 'flag',
        isDeleteDialogOpen: state.openDialog === 'delete',

        // Actions
        openFlagDialog,
        openDeleteDialog,
        closeDialog,
        flagReport,
        deleteReport,
    }
}
