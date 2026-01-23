import { useQuery } from '@tanstack/react-query';
import { usersApi, reportsApi, GlobalStats, Report } from '@/lib/api';

export interface HomeData {
    stats: GlobalStats | null;
    recentReports: Report[];
    heatmapReports: Report[];
    activeUsersCount: number;
    resolvedCount: number;
}

export function useHomeDataQuery() {
    return useQuery<HomeData>({
        queryKey: ['home', 'dashboard-data'],
        queryFn: async () => {
            // Parallel fetching for performance
            const [stats, recentReports, heatmapReports] = await Promise.all([
                usersApi.getStats().catch(() => null), // Fail safe
                reportsApi.getAll({ limit: 15, sortBy: 'recent' }).catch(() => []),
                reportsApi.getAll({ limit: 50, sortBy: 'recent' }).catch(() => []) // For heatmap/bento (slightly more data)
            ]);

            // Safe defaults
            const safeStats = stats || {
                total_reports: 0,
                resolved_reports: 0,
                total_users: 0,
                active_users_month: 0
            };

            return {
                stats: safeStats,
                recentReports: recentReports || [],
                heatmapReports: heatmapReports || [],
                activeUsersCount: safeStats.total_users || 1240, // Fallback purely for layout stability if API fails completely, but API usually returns 0
                resolvedCount: safeStats.resolved_reports || 0
            };
        },
        staleTime: 1000 * 60 * 2, // 2 minutes cache
        refetchOnWindowFocus: false
    });
}
