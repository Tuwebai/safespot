/**
 * Centralized Query Keys Registry
 * 
 * Using a centralized object avoids typos and ensures cache consistency
 * across the entire application.
 */
export const QUERY_KEYS = {
    reports: {
        all: ['reports'] as const,
        list: (filters: Record<string, unknown>) => ['reports', 'list', filters] as const,
        detail: (id: string) => ['reports', 'detail', id] as const,
        favorites: ['reports', 'favorites'] as const,
    },
    comments: {
        all: ['comments'] as const,
        forReport: (reportId: string) => ['comments', 'list', reportId] as const,
    },
    gamification: {
        summary: ['gamification', 'summary'] as const,
        badges: ['gamification', 'badges'] as const,
        progress: ['gamification', 'progress'] as const,
    },
    user: {
        profile: ['user', 'profile'] as const,
        stats: ['user', 'stats'] as const,
    }
} as const
