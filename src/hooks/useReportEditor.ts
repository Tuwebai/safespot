import { useState, useCallback } from 'react'
import { reportsApi } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { handleErrorWithMessage } from '@/lib/errorHandler'
import { useUpdateReportMutation } from '@/hooks/queries/useReportsQuery'
import type { Report } from '@/lib/schemas'

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
    imageUploadError: string | null
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
        imageUploadError: null,
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
            imageUploadError: null,
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
            imageUploadError: null,
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

    const updateMutation = useUpdateReportMutation()

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

        // Pattern: Text Updates are OPTIMISTIC (mutate)
        // Image uploads are SEQUENTIAL (await)
        try {
            // 1. Optimistic Text Update
            updateMutation.mutate({
                id: report.id,
                data: {
                    title: state.title.trim(),
                    description: state.description.trim(),
                    status: state.status,
                }
            })

            // 2. Sequential Image Upload (if needed)
            if (state.newImages.length > 0) {
                try {
                    const uploadRes = await reportsApi.uploadImages(report.id, state.newImages)
                    // Update cache again with merged images after successful upload
                    onReportUpdate({ ...report, ...state, image_urls: uploadRes.image_urls } as Report)
                } catch (imgError) {
                    console.error('Error uploading images during edit:', imgError)
                    setState(prev => ({ ...prev, imageUploadError: 'La carga de fotos falló. Reintentá o eliminá las imágenes con problemas.' }))
                    toast.error('Se guardaron los cambios pero falló la carga de imágenes')
                }
            }

            setState({
                isEditing: false,
                title: '',
                description: '',
                status: 'pendiente',
                updating: false,
                newImages: [],
                imageUploadError: null,
            })

            toast.success('Cambios guardados')
        } catch (error) {
            handleErrorWithMessage(error, 'Error al actualizar el reporte', toast.error, 'useReportEditor.saveChanges')
            setState(prev => ({ ...prev, updating: false, imageUploadError: 'No se pudo guardar el reporte. Verificá tu conexión.' }))
        }
    }, [report, state, updateMutation, onReportUpdate, toast])

    return {
        // State
        isEditing: state.isEditing,
        editTitle: state.title,
        editDescription: state.description,
        editStatus: state.status,
        updating: state.updating,
        newImages: state.newImages,
        imageUploadError: state.imageUploadError,
        setImageUploadError: useCallback((error: string | null) => setState(prev => ({ ...prev, imageUploadError: error })), []),

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
