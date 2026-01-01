import { useState, useCallback } from 'react'
import { useToast } from '@/components/ui/toast'
import { handleErrorWithMessage } from '@/lib/errorHandler'
import { useDeleteReportMutation, useFlagReportMutation } from '@/hooks/queries/useReportsQuery'

// ============================================
// STATE TYPES
// ============================================

type DialogType = 'flag' | 'delete' | null

interface FlagManagerState {
    openDialog: DialogType
}

// ============================================
// HOOK
// ============================================

interface UseFlagManagerProps {
    reportId: string | undefined
    onBeforeDelete?: () => void
    onReportFlagged?: () => void
    onReportDeleted?: () => void
}

export function useFlagManager({ reportId, onBeforeDelete, onReportFlagged, onReportDeleted }: UseFlagManagerProps) {
    const toast = useToast()
    const deleteMutation = useDeleteReportMutation()
    const flagMutation = useFlagReportMutation()

    const [state, setState] = useState<FlagManagerState>({
        openDialog: null,
    })

    // ============================================
    // DIALOG ACTIONS
    // ============================================

    const openFlagDialog = useCallback(() => {
        setState({ openDialog: 'flag' })
    }, [])

    const openDeleteDialog = useCallback(() => {
        setState({ openDialog: 'delete' })
    }, [])

    const closeDialog = useCallback(() => {
        setState({ openDialog: null })
    }, [])

    // ============================================
    // FLAG OPERATIONS
    // ============================================

    const flagReport = useCallback(async (reason: string) => {
        if (!reportId) return

        flagMutation.mutate({ reportId, reason }, {
            onSuccess: () => {
                toast.success('Reporte denunciado correctamente. Gracias por ayudar a mantener la comunidad segura.')
                onReportFlagged?.()
                closeDialog()
            },
            onError: (error: any) => {
                const errorMessage = error instanceof Error ? error.message : ''
                if (errorMessage.includes('own report')) {
                    toast.warning('No puedes denunciar tu propio reporte')
                } else if (errorMessage.includes('already flagged')) {
                    toast.warning('Ya has denunciado este reporte anteriormente')
                } else {
                    handleErrorWithMessage(error, 'Error al denunciar el reporte', toast.error, 'useFlagManager.flagReport')
                }
            }
        })
    }, [reportId, flagMutation, onReportFlagged, toast, closeDialog])

    // ============================================
    // DELETE OPERATIONS
    // ============================================

    const deleteReport = useCallback(async () => {
        if (!reportId) return

        // 1. Instant UI Feedback (Navigational/Visual)
        onBeforeDelete?.()
        closeDialog()

        // 2. Optimistic Mutation (Already handles cache updates)
        deleteMutation.mutate(reportId, {
            onSuccess: () => {
                toast.success('Reporte eliminado correctamente')
                onReportDeleted?.()
            },
            onError: (error) => {
                handleErrorWithMessage(error, 'Error al eliminar el reporte', toast.error, 'useFlagManager.deleteReport')
            }
        })
    }, [reportId, deleteMutation, onBeforeDelete, onReportDeleted, toast, closeDialog])

    return {
        // State
        openDialog: state.openDialog,
        flaggingReport: flagMutation.isPending,
        deletingReport: deleteMutation.isPending,
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
