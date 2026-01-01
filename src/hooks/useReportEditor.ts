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
    newImages: File[]
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
        newImages: [],
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
            newImages: [],
        })
    }, [report])

    const cancelEditing = useCallback(() => {
        setState(prev => ({
            ...prev,
            isEditing: false,
            title: '',
            description: '',
            status: 'pendiente',
            newImages: [],
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

    const setNewImages = useCallback((files: File[]) => {
        setState(prev => ({ ...prev, newImages: files }))
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
            // 1. Update text fields
            let updatedReport = await reportsApi.update(report.id, {
                title: state.title.trim(),
                description: state.description.trim(),
                status: state.status,
            })

            // 2. Upload images if any
            if (state.newImages.length > 0) {
                try {
                    const uploadRes = await reportsApi.uploadImages(report.id, state.newImages)
                    // The backend now appends, so uploadRes.image_urls will contain ALL images
                    updatedReport = { ...updatedReport, image_urls: uploadRes.image_urls }
                } catch (imgError) {
                    console.error('Error uploading images during edit:', imgError)
                    toast.error('Se guardaron los cambios pero falló la carga de imágenes')
                }
            }

            onReportUpdate(updatedReport)

            setState({
                isEditing: false,
                title: '',
                description: '',
                status: 'pendiente',
                updating: false,
                newImages: [],
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
        newImages: state.newImages,

        // Actions
        startEditing,
        cancelEditing,
        setTitle,
        setDescription,
        setStatus,
        setNewImages,
        saveChanges,
    }
}
