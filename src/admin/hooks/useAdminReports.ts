import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { adminApi } from '../services/adminApi'
import type { ReportsResponse } from '../types/reports'

interface ReportsFilters {
    page?: number
    limit?: number
    search?: string
    status?: string
}

export const useAdminReports = (filters: ReportsFilters = {}) => {
    return useQuery<ReportsResponse>({
        queryKey: ['admin', 'reports', filters],
        queryFn: async () => {
            const { data } = await adminApi.get<ReportsResponse>('/reports', {
                params: {
                    page: filters.page || 1,
                    limit: filters.limit || 20,
                    ...(filters.search && { search: filters.search }),
                    ...(filters.status && { status: filters.status })
                }
            })
            return data
        },
        placeholderData: keepPreviousData,
        staleTime: 30000
    })
}
