/**
 * React Query hooks for Global Statistics
 */

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { usersApi } from '@/lib/api'

/**
 * Fetch global platform statistics
 * Used on Home page
 */
/**
 * Fetch global platform statistics
 * Used on Home page
 */
export function useGlobalStatsQuery() {
    return useQuery({
        queryKey: queryKeys.stats.global,
        queryFn: async () => {
            const data = await usersApi.getStats()
            return data
        },
        staleTime: 0, // Instant refresh in background
        refetchOnWindowFocus: false,
        refetchInterval: 30000, // Refresh every 30 seconds
        retry: false,
    })
}

/**
 * Fetch category breakdown statistics
 * Used on Home page
 */
export function useCategoryStatsQuery() {
    return useQuery({
        queryKey: queryKeys.stats.categories,
        queryFn: async () => {
            const data = await usersApi.getCategoryStats()
            return data
        },
        staleTime: 0, // Instant refresh
        refetchOnWindowFocus: false,
        refetchInterval: 30000, // Refresh every 30 seconds
        retry: false,
    })
}
