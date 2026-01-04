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
            // Cache successful response
            try {
                localStorage.setItem('safespot_stats_global', JSON.stringify(data))
            } catch (e) {
                // Ignore storage errors
            }
            return data
        },
        initialData: () => {
            // Try to load from local storage for instant render
            try {
                const item = localStorage.getItem('safespot_stats_global')
                if (item) {
                    return JSON.parse(item)
                }
            } catch (e) {
                return undefined
            }
        },
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
        queryFn: async () => {
            const data = await usersApi.getCategoryStats()
            try {
                localStorage.setItem('safespot_stats_categories', JSON.stringify(data))
            } catch (e) { }
            return data
        },
        initialData: () => {
            try {
                const item = localStorage.getItem('safespot_stats_categories')
                if (item) {
                    return JSON.parse(item)
                }
            } catch (e) {
                return undefined
            }
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        refetchOnWindowFocus: false,
        retry: false,
    })
}
