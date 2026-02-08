import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '../services/adminApi'

interface StatusMutationParams {
    id?: string
    status: string
    reason: string
}

interface VisibilityMutationParams {
    id?: string
    is_hidden: boolean
    reason: string
}

interface NoteMutationParams {
    id?: string
    note: string
}

interface DeleteMutationParams {
    id?: string
    reason: string
}

interface RestoreMutationParams {
    id?: string
    reason: string
}

export const useReportModerationActions = (defaultReportId?: string) => {
    const queryClient = useQueryClient()

    const invalidateAll = () => {
        queryClient.invalidateQueries({ queryKey: ['admin', 'reports'] })
    }

    const updateStatus = useMutation({
        mutationFn: async ({ id, status, reason }: StatusMutationParams) => {
            const targetId = id || defaultReportId
            if (!targetId) throw new Error('Report ID is required')
            const { data } = await adminApi.patch(`/reports/${targetId}/status`, { status, reason })
            return data
        },
        onSuccess: invalidateAll
    })

    const toggleVisibility = useMutation({
        mutationFn: async ({ id, is_hidden, reason }: VisibilityMutationParams) => {
            const targetId = id || defaultReportId
            if (!targetId) throw new Error('Report ID is required')
            const { data } = await adminApi.patch(`/reports/${targetId}/visibility`, { is_hidden, reason })
            return data
        },
        onSuccess: invalidateAll
    })

    const addNote = useMutation({
        mutationFn: async ({ id, note }: NoteMutationParams) => {
            const targetId = id || defaultReportId
            if (!targetId) throw new Error('Report ID is required')
            const { data } = await adminApi.post(`/reports/${targetId}/notes`, { note })
            return data
        },
        onSuccess: invalidateAll
    })

    const deleteReport = useMutation({
        mutationFn: async ({ id, reason }: DeleteMutationParams) => {
            const targetId = id || defaultReportId
            if (!targetId) throw new Error('Report ID is required')
            // Corregido: adminApi.delete recibe el body directamente
            const { data } = await adminApi.delete(`/reports/${targetId}`, { reason })
            return data
        },
        onSuccess: invalidateAll
    })

    const restoreReport = useMutation({
        mutationFn: async ({ id, reason }: RestoreMutationParams) => {
            const targetId = id || defaultReportId
            if (!targetId) throw new Error('Report ID is required')
            const { data } = await adminApi.patch(`/reports/${targetId}/restore`, { reason })
            return data
        },
        onSuccess: invalidateAll
    })

    return {
        updateStatus,
        toggleVisibility,
        addNote,
        deleteReport,
        restoreReport,
        invalidateAll
    }
}
