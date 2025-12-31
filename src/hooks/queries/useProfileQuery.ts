/**
 * React Query hooks for User Profile and Favorites
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { usersApi, favoritesApi } from '@/lib/api'

/**
 * Fetch current user's profile
 */
export function useProfileQuery() {
    return useQuery({
        queryKey: queryKeys.user.profile,
        queryFn: () => usersApi.getProfile(),
        staleTime: 60 * 1000, // 1 minute
        refetchOnWindowFocus: false,
        retry: false,
    })
}

/**
 * Fetch user's favorite reports
 */
export function useFavoritesQuery() {
    return useQuery({
        queryKey: queryKeys.user.favorites,
        queryFn: () => favoritesApi.getAll(),
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
