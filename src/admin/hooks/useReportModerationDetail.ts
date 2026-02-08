import { useQuery } from '@tanstack/react-query'
import { adminApi } from '../services/adminApi'
import type { ReportModerationDetail } from '../types/reports'

export const useReportModerationDetail = (reportId?: string) => {
    return useQuery<ReportModerationDetail>({
        queryKey: ['admin', 'reports', 'detail', reportId],
        queryFn: async () => {
            if (!reportId) throw new Error('Report ID is required')
            const { data } = await adminApi.get<{ success: boolean, data: ReportModerationDetail }>(`/reports/${reportId}`)
            return data.data
        },
        enabled: !!reportId,
        staleTime: 60000 // 1 minute
    })
}
