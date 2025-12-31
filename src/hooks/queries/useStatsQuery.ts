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
export function useGlobalStatsQuery() {
    return useQuery({
        queryKey: queryKeys.stats.global,
        queryFn: () => usersApi.getStats(),
        staleTime: 5 * 60 * 1000, // 5 minutes (reduce 429s)
        refetchOnWindowFocus: false,
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
        queryFn: () => usersApi.getCategoryStats(),
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
        retry: false,
    })
}
