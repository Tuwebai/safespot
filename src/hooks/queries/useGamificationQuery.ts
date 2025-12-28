/**
 * React Query hooks for Gamification (profile + badges)
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { gamificationApi } from '@/lib/api'

/**
 * Fetch complete gamification summary (profile + badges)
 * This is the main query for the Gamificacion page
 */
export function useGamificationSummaryQuery() {
    return useQuery({
        queryKey: queryKeys.gamification.summary,
        queryFn: () => gamificationApi.getSummary(),
        staleTime: 30 * 1000, // 30 seconds - matches existing cache TTL
    })
}

/**
 * Fetch badges with progress
 */
export function useGamificationBadgesQuery() {
    return useQuery({
        queryKey: queryKeys.gamification.badges,
        queryFn: () => gamificationApi.getBadges(),
        staleTime: 60 * 1000, // 1 minute
    })
}

/**
 * Hook to invalidate gamification queries
 * Call after user actions that affect stats/badges
 */
export function useInvalidateGamification() {
    const queryClient = useQueryClient()

    return {
        invalidateSummary: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.gamification.summary })
        },
        invalidateBadges: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.gamification.badges })
        },
        invalidateAll: () => {
            queryClient.invalidateQueries({ queryKey: ['gamification'] })
        },
    }
}
