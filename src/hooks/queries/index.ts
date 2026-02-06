/**
 * Query hooks barrel export
 * 
 * All React Query hooks are exported from here for convenient imports:
 * import { useReportsQuery, useProfileQuery } from '@/hooks/queries'
 */

// Reports
export {
    useReportsQuery,
    useReportDetailQuery,
    useUpdateReportMutation,
    useDeleteReportMutation,
    useToggleFavoriteMutation,
    useFlagReportMutation,
} from './useReportsQuery'

export { useCreateReportMutation } from '../mutations/useCreateReportMutation'

// Profile & Favorites
export {
    useProfileQuery,
    useFavoritesQuery,
    useInvalidateProfile,
} from './useProfileQuery'

// Gamification
export {
    useGamificationSummaryQuery,
    useGamificationBadgesQuery,
    useInvalidateGamification,
} from './useGamificationQuery'

// Stats
export {
    useGlobalStatsQuery,
    useCategoryStatsQuery,
} from './useStatsQuery'
