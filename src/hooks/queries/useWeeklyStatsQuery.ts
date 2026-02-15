import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';

export interface WeeklyStats {
    totalReceived: number;
    diffPercent: number;
    topCategory: string | null;
    period: string;
    zoneName: string;
}

const fetchWeeklyStats = async (zone: string) => {
    const params = new URLSearchParams();
    params.append('zone', zone);
    const response = await apiRequest<{ success: boolean; data: WeeklyStats }>(`/weekly-stats?${params.toString()}`);
    return response.data;
};

export const WEEKLY_STATS_QUERY_KEY = 'weeklyStats';

export function useWeeklyStatsQuery(zoneName: string | null) {
    return useQuery({
        queryKey: [WEEKLY_STATS_QUERY_KEY, zoneName],
        queryFn: () => fetchWeeklyStats(zoneName!),
        enabled: !!zoneName,
        staleTime: 1000 * 60 * 60, // 1 hour stale time for digest
    });
}
