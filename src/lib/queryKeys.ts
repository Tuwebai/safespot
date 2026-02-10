/**
 * Query Keys for TanStack Query
 * 
 * Centralized query key factory for consistent cache management.
 * Following TanStack Query best practices:
 * - Keys are arrays for granular invalidation
 * - Factory functions for parameterized queries
 * - Hierarchical structure (entity.action.params)
 * 
 * ============================================
 * CRITICAL INVARIANT - REPORTS QUERIES
 * ============================================
 * 
 * Reports queries are PROTECTED and MUST NOT be invalidated manually.
 * 
 * Updates are handled EXCLUSIVELY via:
 * 1. Optimistic Updates (same client, immediate feedback)
 * 2. SSE Events (cross-client propagation)
 * 
 * DO NOT:
 * - queryClient.invalidateQueries({ queryKey: ['reports'] })
 * - queryClient.refetchQueries({ queryKey: ['reports'] })
 * - refetchInterval on reports queries
 * - refetchOnWindowFocus: true on reports queries
 * 
 * Violating this will cause race conditions on mobile browsers
 * where refetch overwrites optimistic updates before backend commit.
 * 
 * See: reports_sources_final_audit.md for full analysis
 */

import type { ReportFilters } from '@/lib/api'

export const queryKeys = {
    // ============================================
    // REPORTS (SSE-MANAGED, DO NOT INVALIDATE)
    // ============================================
    reports: {
        // Base key for all report queries
        all: ['reports'] as const,

        // List with filters & identity context
        list: (filters?: ReportFilters, identity?: string) =>
            // ✅ ENTERPRISE 11: Identity-scoped caching
            // Adding identity prevents cache leakage between sessions
            // and forces fresh fetch on login/logout
            [
                'reports',
                'list',
                filters || 'all',
                identity || 'anon'
            ] as const,

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

        // Single comment detail (SSOT)
        detail: (commentId: string) => ['comments', 'detail', commentId] as const,
    },

    // ============================================
    // USER / PROFILE
    // ============================================
    user: {
        // Current user profile
        profile: ['user', 'profile'] as const,

        // User's favorite reports
        favorites: ['user', 'favorites'] as const,

        // Transparency log for moderation actions
        transparencyLog: ['user', 'transparency-log'] as const,

        // Public profile by alias
        publicProfile: (alias: string) => ['user', 'public-profile', alias] as const,

        // Followers list
        followers: (alias: string) => ['user', 'followers', alias] as const,

        // Following list
        following: (alias: string) => ['user', 'following', alias] as const,

        // Suggestions for current user
        suggestions: ['user', 'suggestions'] as const,
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

    // ============================================
    // NOTIFICATIONS
    // ============================================
    notifications: {
        // User notification settings
        settings: ['notifications', 'settings'] as const,
    },

    // ============================================
    // ZONES (SEO)
    // ============================================
    zones: {
        // All zones list
        all: ['zones'] as const,
    },
} as const

// Type helpers for query keys
export type QueryKeys = typeof queryKeys
