import type { GamificationBadge, GamificationSummary } from '../../schemas';

type ApiRequestFn = <T>(endpoint: string, options?: RequestInit) => Promise<T>;

export function createGamificationApi(apiRequest: ApiRequestFn) {
  return {
    getSummary: async (): Promise<GamificationSummary> => {
      return apiRequest<GamificationSummary>('/gamification/summary');
    },
    getBadges: async (): Promise<GamificationBadge[]> => {
      return apiRequest<GamificationBadge[]>('/gamification/badges');
    },
  };
}
