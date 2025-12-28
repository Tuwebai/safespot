import { useState, useCallback } from 'react'
import { reportsApi } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { handleErrorWithMessage } from '@/lib/errorHandler'
import type { Report } from '@/lib/api'

// ============================================
// STATE TYPES
// ============================================

interface ReportEditorState {
    isEditing: boolean
    title: string
    description: string
    status: Report['status']
    updating: boolean
}

// ============================================
// HOOK
// ============================================

interface UseReportEditorProps {
    report: Report | null
    onReportUpdate: (updatedReport: Report) => void
}

export function useReportEditor({ report, onReportUpdate }: UseReportEditorProps) {
    const toast = useToast()

    const [state, setState] = useState<ReportEditorState>({
        isEditing: false,
        title: '',
        description: '',
        status: 'pendiente',
        updating: false,
    })

    // ============================================
    // ACTIONS
    // ============================================

    const startEditing = useCallback(() => {
        if (!report) return

        setState({
            isEditing: true,
            title: report.title,
            description: report.description,
            status: report.status,
            updating: false,
        })
    }, [report])

    const cancelEditing = useCallback(() => {
        setState(prev => ({
            ...prev,
            isEditing: false,
            title: '',
            description: '',
            status: 'pendiente',
        }))
    }, [])

    const setTitle = useCallback((title: string) => {
        setState(prev => ({ ...prev, title }))
    }, [])

    const setDescription = useCallback((description: string) => {
        setState(prev => ({ ...prev, description }))
    }, [])

    const setStatus = useCallback((status: Report['status']) => {
        setState(prev => ({ ...prev, status }))
    }, [])

    const saveChanges = useCallback(async () => {
        if (!report || state.updating) return

        // Validate
        if (!state.title.trim()) {
            toast.error('El título no puede estar vacío')
            return
        }
        if (!state.description.trim()) {
            toast.error('La descripción no puede estar vacía')
            return
        }

        setState(prev => ({ ...prev, updating: true }))

        try {
            const updatedReport = await reportsApi.update(report.id, {
                title: state.title.trim(),
                description: state.description.trim(),
                status: state.status,
            })

            onReportUpdate(updatedReport)

            setState({
                isEditing: false,
                title: '',
                description: '',
                status: 'pendiente',
                updating: false,
            })

            toast.success('Reporte actualizado correctamente')
        } catch (error) {
            handleErrorWithMessage(error, 'Error al actualizar el reporte', toast.error, 'useReportEditor.saveChanges')
            setState(prev => ({ ...prev, updating: false }))
        }
    }, [report, state, onReportUpdate, toast])

    return {
        // State
        isEditing: state.isEditing,
        editTitle: state.title,
        editDescription: state.description,
        editStatus: state.status,
        updating: state.updating,

        // Actions
        startEditing,
        cancelEditing,
        setTitle,
        setDescription,
        setStatus,
        saveChanges,
    }
}
