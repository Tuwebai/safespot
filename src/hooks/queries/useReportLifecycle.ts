import { useMutation, useQueryClient } from '@tanstack/react-query'
import { reportsApi } from '@/lib/api'
import { queryKeys } from '@/lib/queryKeys'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { reportsCache } from '@/lib/cache-helpers'
import { type Report } from '@/lib/schemas'

export function useReportLifecycle() {
    const queryClient = useQueryClient()
    const { checkAuth } = useAuthGuard()

    const invalidateStats = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.stats.global })
        queryClient.invalidateQueries({ queryKey: queryKeys.stats.categories })
    }

    const resolveReport = useMutation({
        mutationFn: async ({ id, reason }: { id: string, reason: string }) => {
            if (!checkAuth()) throw new Error('AUTH_REQUIRED');
            return reportsApi.resolve(id, reason)
        },
        onMutate: async ({ id }) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.reports.detail(id) })
            const previousReport = queryClient.getQueryData<Report>(queryKeys.reports.detail(id))

            if (previousReport) {
                reportsCache.patch(queryClient, id, { status: 'resuelto' })
            }
            return { previousReport }
        },
        onError: (_err, { id: _id }, context) => {
            if (context?.previousReport) {
                reportsCache.store(queryClient, [context.previousReport])
            }
        },
        onSettled: invalidateStats
    })

    const rejectReport = useMutation({
        mutationFn: async ({ id, reason }: { id: string, reason: string }) => {
            if (!checkAuth()) throw new Error('AUTH_REQUIRED');
            return reportsApi.reject(id, reason)
        },
        onMutate: async ({ id }) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.reports.detail(id) })
            const previousReport = queryClient.getQueryData<Report>(queryKeys.reports.detail(id))

            if (previousReport) {
                reportsCache.patch(queryClient, id, { status: 'rechazado' })
            }
            return { previousReport }
        },
        onError: (_err, { id: _id }, context) => {
            if (context?.previousReport) {
                reportsCache.store(queryClient, [context.previousReport])
            }
        },
        onSettled: invalidateStats
    })

    const processReport = useMutation({
        mutationFn: async ({ id }: { id: string }) => {
            if (!checkAuth()) throw new Error('AUTH_REQUIRED');
            return reportsApi.process(id)
        },
        onMutate: async ({ id }) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.reports.detail(id) })
            const previousReport = queryClient.getQueryData<Report>(queryKeys.reports.detail(id))

            if (previousReport) {
                reportsCache.patch(queryClient, id, { status: 'en_proceso' })
            }
            return { previousReport }
        },
        onError: (_err, { id: _id }, context) => {
            if (context?.previousReport) {
                reportsCache.store(queryClient, [context.previousReport])
            }
        },
        onSettled: invalidateStats
    })

    const closeReport = useMutation({
        mutationFn: async ({ id, reason }: { id: string, reason: string }) => {
            if (!checkAuth()) throw new Error('AUTH_REQUIRED');
            return reportsApi.close(id, reason)
        },
        onMutate: async ({ id }) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.reports.detail(id) })
            const previousReport = queryClient.getQueryData<Report>(queryKeys.reports.detail(id))

            if (previousReport) {
                reportsCache.patch(queryClient, id, { status: 'cerrado' })
            }
            return { previousReport }
        },
        onError: (_err, { id: _id }, context) => {
            if (context?.previousReport) {
                reportsCache.store(queryClient, [context.previousReport])
            }
        },
        onSettled: invalidateStats
    })

    return {
        resolveReport,
        rejectReport,
        processReport,
        closeReport
    }
}
