/**
 * Query Keys for TanStack Query
 * 
 * Centralized query key factory for consistent cache management.
 * Following TanStack Query best practices:
 * - Keys are arrays for granular invalidation
 * - Factory functions for parameterized queries
 * - Hierarchical structure (entity.action.params)
 */

import type { ReportFilters } from '@/lib/api'

export const queryKeys = {
    // ============================================
    // REPORTS
    // ============================================
    reports: {
        // Base key for all report queries
        all: ['reports'] as const,

        // List with filters
        list: (filters?: ReportFilters) =>
            filters
                ? ['reports', 'list', filters] as const
                : ['reports', 'list'] as const,

        // Single report detail
        detail: (id: string) => ['reports', 'detail', id] as const,
    },

    // ============================================
    // COMMENTS
    // ============================================
    comments: {
        // All comments for a report
        byReport: (reportId: string) => ['comments', reportId] as const,

        // Paginated comments
        byReportPaginated: (reportId: string, cursor?: string) =>
            ['comments', reportId, { cursor }] as const,
    },

    // ============================================
    // USER / PROFILE
    // ============================================
    user: {
        // Current user profile
        profile: ['user', 'profile'] as const,

        // User's favorite reports
        favorites: ['user', 'favorites'] as const,
    },

    // ============================================
    // GAMIFICATION
    // ============================================
    gamification: {
        // Base key for all gamification queries
        all: ['gamification'] as const,

        // Complete gamification summary (profile + badges)
        summary: ['gamification', 'summary'] as const,

        // All badges with progress
        badges: ['gamification', 'badges'] as const,
    },

    // ============================================
    // GLOBAL STATS
    // ============================================
    stats: {
        // Global platform statistics
        global: ['stats', 'global'] as const,

        // Category breakdown statistics
        categories: ['stats', 'categories'] as const,
    },
} as const

// Type helpers for query keys
export type QueryKeys = typeof queryKeys
