import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import type { Report, Comment } from './api';

/**
 * CACHE HELPERS (SSOT Architecture)
 * 
 * These helpers perform the "Heavy Lifting" of normalization.
 * They ensure that:
 * 1. Data lives in exactly one place: ['reports', 'detail', id]
 * 2. Lists only contain IDs
 * 3. Updates are propagated consistently
 */

// ============================================
// REPORTS HELPER
// ============================================

export const reportsCache = {
    /**
     * Store (Normalize) a list of reports into the canonical cache.
     * @returns Array of IDs to be stored in the list cache.
     */
    store: (queryClient: QueryClient, reports: Report[]): string[] => {
        reports.forEach(report => {
            queryClient.setQueryData(
                queryKeys.reports.detail(report.id),
                report
            );
        });
        return reports.map(r => r.id);
    },

    /**
     * Update a report EVERYWHERE (Canonical + Derived State)
     * This is the "God Method" for patching reports.
     */
    patch: (queryClient: QueryClient, reportId: string, patch: Partial<Report> | ((old: Report) => Partial<Report>)) => {
        // 1. Update Canonical Source (Detail)
        queryClient.setQueryData<Report>(
            queryKeys.reports.detail(reportId),
            (old) => {
                if (!old) return undefined; // Can't patch if we don't have it
                const updates = typeof patch === 'function' ? patch(old) : patch;
                return { ...old, ...updates };
            }
        );

        // 2. We DO NOT update lists because lists only hold IDs.
        // Since IDs don't change, the lists remain valid!
        // The components rendering the list items (ReportCard) subscribed to the Detail ID
        // will automatically re-render with the new data.

        // 3. Stats Invalidation (Optional but recommended for consistency)
        // If status changed, we might want to invalidate stats
        // queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });
    },

    /**
     * Remove a report from EVERYWHERE
     */
    remove: (queryClient: QueryClient, reportId: string) => {
        // 1. Remove Canonical
        queryClient.removeQueries({ queryKey: queryKeys.reports.detail(reportId) });

        // 2. Remove ID from ALL Lists (Filter it out)
        // We scan all queries that look like a report list
        queryClient.setQueriesData<string[]>(
            { queryKey: ['reports', 'list'] },
            (oldIds) => oldIds ? oldIds.filter(id => id !== reportId) : []
        );
    },

    /**
     * Add a report ID to the TOP of the lists (New Report)
     */
    prepend: (queryClient: QueryClient, newReport: Report) => {
        // 1. Store Canonical
        queryClient.setQueryData(queryKeys.reports.detail(newReport.id), newReport);

        // 2. Prepend ID to all lists
        // SAFETY: We explicitly cast `old` to `any[]` to handle potential cache corruption
        // where objects might have been stored instead of strings.
        queryClient.setQueriesData<any[]>(
            { queryKey: ['reports', 'list'] },
            (old) => {
                if (!old) return [newReport.id];

                // Self-healing: Ensure all existing items are strings.
                // If we find an object, it's a corrupted entry -> extract ID.
                const sanitizedOld = Array.isArray(old) ? old.map(item => {
                    if (typeof item === 'object' && item !== null && 'id' in item) {
                        return item.id;
                    }
                    return item;
                }) : [];

                return [newReport.id, ...sanitizedOld];
            }
        );
    }
};

// ============================================
// COMMENTS HELPER
// ============================================

export const commentsCache = {
    /**
     * Store one or multiple comments in the canonical cache.
     * @returns ID string or array of ID strings.
     */
    store: (queryClient: QueryClient, comments: Comment | Comment[]): string[] => {
        const list = Array.isArray(comments) ? comments : [comments];
        list.forEach(comment => {
            queryClient.setQueryData(
                queryKeys.comments.detail(comment.id),
                comment
            );
        });
        return list.map(c => c.id);
    },

    /**
     * Patch a comment in the detail cache.
     * Supports both object patch and functional update.
     */
    patch: (queryClient: QueryClient, commentId: string, patch: Partial<Comment> | ((old: Comment) => Partial<Comment>)) => {
        queryClient.setQueryData<Comment>(
            queryKeys.comments.detail(commentId),
            (old) => {
                if (!old) return undefined;
                const updates = typeof patch === 'function' ? patch(old) : patch;
                return { ...old, ...updates };
            }
        );
    },

    remove: (queryClient: QueryClient, commentId: string, reportId: string) => {
        // Remove Canonical
        queryClient.removeQueries({ queryKey: queryKeys.comments.detail(commentId) });

        // Remove from Report's comment list
        queryClient.setQueriesData<any>(
            { queryKey: queryKeys.comments.byReport(reportId) },
            (old: any) => {
                if (!old) return old
                const remove = (list: string[]) => list.filter(id => id !== commentId)
                if (Array.isArray(old)) return remove(old)
                if (old.comments) return { ...old, comments: remove(old.comments) }
                return old
            }
        );

        // Decrement report counter
        reportsCache.patch(queryClient, reportId, (old) => ({
            comments_count: Math.max(0, (old.comments_count || 0) - 1)
        }));
    },

    append: (queryClient: QueryClient, newComment: Comment) => {
        // Store canonical
        queryClient.setQueryData(queryKeys.comments.detail(newComment.id), newComment);

        // Append to list
        queryClient.setQueriesData<any>(
            { queryKey: queryKeys.comments.byReport(newComment.report_id) },
            (old: any) => {
                if (!old) return [newComment.id]
                const append = (list: string[]) => [...list, newComment.id]
                if (Array.isArray(old)) return append(old)
                if (old.comments) return { ...old, comments: append(old.comments) }
                return old
            }
        );

        // Increment report counter
        reportsCache.patch(queryClient, newComment.report_id, (old) => ({
            comments_count: (old.comments_count || 0) + 1
        }));
    },

    prepend: (queryClient: QueryClient, newComment: Comment) => {
        // Store canonical
        queryClient.setQueryData(queryKeys.comments.detail(newComment.id), newComment);

        // Prepend to list
        queryClient.setQueriesData<any>(
            { queryKey: queryKeys.comments.byReport(newComment.report_id) },
            (old: any) => {
                if (!old) return [newComment.id]
                const prepend = (list: string[]) => [newComment.id, ...list]
                if (Array.isArray(old)) return prepend(old)
                if (old.comments) return { ...old, comments: prepend(old.comments) }
                return old
            }
        );

        // Increment report counter
        reportsCache.patch(queryClient, newComment.report_id, (old) => ({
            comments_count: (old.comments_count || 0) + 1
        }));
    }
};

// ============================================
// STATS HELPER
// ============================================

export const statsCache = {
    incrementGlobal: (queryClient: QueryClient) => {
        queryClient.setQueryData(queryKeys.stats.global, (old: any) => {
            if (!old) return old
            return { ...old, total_reports: (old.total_reports || 0) + 1 }
        })
    },

    decrementGlobal: (queryClient: QueryClient) => {
        queryClient.setQueryData(queryKeys.stats.global, (old: any) => {
            if (!old) return old
            return { ...old, total_reports: Math.max(0, (old.total_reports || 1) - 1) }
        })
    }
};
