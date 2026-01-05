/**
 * React Query hooks for Global Statistics
 */

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { usersApi } from '@/lib/api'

// Helper for safe localStorage access
const getFromCache = <T>(key: string): T | undefined => {
    try {
        const item = localStorage.getItem(key)
        return item ? JSON.parse(item) : undefined
    } catch {
        return undefined
    }
}

const saveToCache = (key: string, data: any) => {
    try {
        localStorage.setItem(key, JSON.stringify(data))
    } catch {
        // Ignore storage errors
    }
}

/**
 * Fetch global platform statistics
 * Used on Home page
 */
export function useGlobalStatsQuery() {
    return useQuery({
        queryKey: queryKeys.stats.global,
        queryFn: async () => {
            const data = await usersApi.getStats()
            saveToCache('cached_global_stats', data)
            return data
        },
        // Instant load from cache if available
        initialData: () => getFromCache<any>('cached_global_stats'),
        staleTime: 1000 * 60, // Consider fresh for 1 minute to avoid flickering
        refetchOnWindowFocus: true,
        refetchInterval: 60000, // Refresh every 1 minute
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
            saveToCache('cached_category_stats', data)
            return data
        },
        initialData: () => getFromCache<any>('cached_category_stats'),
        staleTime: 1000 * 60,
        refetchOnWindowFocus: true,
        refetchInterval: 60000,
        retry: false,
    })
}
