/**
 * React Query hooks for User Profile and Favorites
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { usersApi, favoritesApi } from '@/lib/api'
import { useAnonymousId } from '@/hooks/useAnonymousId'

/**
 * Fetch current user's profile
 */
export function useProfileQuery() {
    const anonymousId = useAnonymousId();  // ✅ SSOT

    return useQuery({
        queryKey: queryKeys.user.profile,  // ✅ Use standard key for cache consistency
        queryFn: () => usersApi.getProfile(),
        enabled: !!anonymousId,  // ✅ CRITICAL
        staleTime: 60 * 1000, // 1 minute
        refetchOnWindowFocus: false,
        retry: false,
    })
}

/**
 * Fetch user's favorite reports
 */
export function useFavoritesQuery() {
    const anonymousId = useAnonymousId();  // ✅ SSOT

    return useQuery({
        queryKey: queryKeys.user.favorites,  // ✅ Use standard key from factory
        queryFn: () => favoritesApi.getAll(),
        enabled: !!anonymousId,  // ✅ CRITICAL
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
        retry: false,
    })
}

/**
 * Hook to invalidate profile-related queries
 * Call after user actions that affect stats
 */
export function useInvalidateProfile() {
    const queryClient = useQueryClient()

    return {
        invalidateProfile: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.user.profile })
        },
        invalidateFavorites: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.user.favorites })
        },
        invalidateAll: () => {
            queryClient.invalidateQueries({ queryKey: ['user'] })
        },
    }
}
