import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import type { Report } from './schemas';
import type { Comment } from './api';
import { normalizeReportForUI } from './normalizeReport';

/**
 * CACHE HELPERS (SSOT Architecture)
 * 
 * These helpers perform the "Heavy Lifting" of normalization.
 * They ensure that:
 * 1. Data lives in exactly one place: ['reports', 'detail', id]
 * 2. Lists only contain IDs
 * 3. Updates are propagated consistently
 * 4. ALL reports are normalized for UI before storage
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
        // ✅ ENTERPRISE: Normalize ALL reports for UI before storing
        const normalizedReports = reports.map(normalizeReportForUI);

        normalizedReports.forEach(report => {
            queryClient.setQueryData(
                queryKeys.reports.detail(report.id),
                report
            );
        });

        normalizedReports.forEach(report => {
            queryClient.setQueryData(
                queryKeys.reports.detail(report.id),
                report
            );
        });

        // SIDE EFFECT: Persist default view
        try {
            localStorage.setItem('safespot_reports_all_v2', JSON.stringify(normalizedReports))
        } catch (e) { }

        return normalizedReports.map(r => r.id);
    },

    /**
     * Update a report EVERYWHERE (Canonical + Derived State)
     */
    patch: (queryClient: QueryClient, reportId: string, patch: Partial<Report> | ((old: Report) => Partial<Report>)) => {
        queryClient.setQueryData<Report>(
            queryKeys.reports.detail(reportId),
            (old) => {
                if (!old) return undefined;
                const updates = typeof patch === 'function' ? patch(old) : (patch as any);

                // ATOMIC DELTA LOGIC
                // If the patch contains delta fields, apply them instead of overwriting
                if (updates.comments_count_delta !== undefined) {
                    const delta = updates.comments_count_delta;
                    const { comments_count_delta, ...rest } = updates;
                    return {
                        ...old,
                        ...rest,
                        comments_count: Math.max(0, (old.comments_count || 0) + delta)
                    };
                }

                return { ...old, ...updates };
            }
        );
    },

    /**
     * Remove a report from EVERYWHERE
     */
    remove: (queryClient: QueryClient, reportId: string) => {
        queryClient.removeQueries({ queryKey: queryKeys.reports.detail(reportId) });
        queryClient.setQueriesData<string[]>(
            { queryKey: ['reports', 'list'] },
            (oldIds) => oldIds ? oldIds.filter(id => id !== reportId) : []
        );
    },

    /**
     * Increment/Decrement likes for a report (Atomic Delta)
     */
    applyLikeDelta: (queryClient: QueryClient, reportId: string, delta: number) => {
        queryClient.setQueryData<Report>(
            queryKeys.reports.detail(reportId),
            (old) => {
                if (!old) return undefined;
                return {
                    ...old,
                    upvotes_count: Math.max(0, (old.upvotes_count || 0) + delta)
                };
            }
        );
    },

    /**
     * Increment/Decrement comment count for a report (Atomic Delta)
     */
    applyCommentDelta: (queryClient: QueryClient, reportId: string, delta: number) => {
        queryClient.setQueryData<Report>(
            queryKeys.reports.detail(reportId),
            (old) => {
                if (!old) return undefined;
                return {
                    ...old,
                    comments_count: Math.max(0, (old.comments_count || 0) + delta)
                };
            }
        );
    },

    /**
     * Add a report ID to the TOP of the lists (New Report)
     */
    prepend: (queryClient: QueryClient, newReport: Report) => {
        // ✅ ENTERPRISE: Normalize for UI before storing
        const normalizedReport = normalizeReportForUI(newReport);

        // 1. Store Canonical
        queryClient.setQueryData(queryKeys.reports.detail(normalizedReport.id), normalizedReport);

        // 2. Update ALL matching lists (Default, Explorar, categories, etc.)
        // Using setQueriesData with the base key will catch everything.
        // It's idempotent, so it handles the default list even if already initialized.
        queryClient.setQueriesData<string[]>(
            { queryKey: ['reports', 'list'] },
            (old) => {
                if (!old) return old;
                const sanitizedOld = Array.isArray(old) ? old.filter(item => typeof item === 'string') : [];
                return [normalizedReport.id, ...sanitizedOld.filter(id => id !== normalizedReport.id)];
            }
        );

        // 3. Explicitly initialize default list if it doesn't exist (to ensure it appears on first load)
        const defaultKey = queryKeys.reports.list();
        const existingDefault = queryClient.getQueryData(defaultKey);
        if (!existingDefault) {
            queryClient.setQueryData(defaultKey, [normalizedReport.id]);
        }
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

    /**
     * Increment/Decrement likes for a comment (Atomic Delta)
     */
    applyLikeDelta: (queryClient: QueryClient, commentId: string, delta: number) => {
        queryClient.setQueryData<Comment>(
            queryKeys.comments.detail(commentId),
            (old) => {
                if (!old) return undefined;
                return {
                    ...old,
                    upvotes_count: Math.max(0, (old.upvotes_count || 0) + delta)
                };
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

                const removeAction = (list: any) => {
                    const sanitizedList = Array.isArray(list) ? list.filter(id => typeof id === 'string') : [];
                    const exists = sanitizedList.includes(commentId);
                    if (!exists) return sanitizedList;

                    // SIDE EFFECT: Decrement report counter ONLY if it existed
                    reportsCache.applyCommentDelta(queryClient, reportId, -1);
                    return sanitizedList.filter(id => id !== commentId);
                }

                if (Array.isArray(old)) return removeAction(old)
                if (old.comments) return { ...old, comments: removeAction(old.comments) }
                return old
            }
        );
    },

    append: (queryClient: QueryClient, newComment: Comment) => {
        // Store canonical
        queryClient.setQueryData(queryKeys.comments.detail(newComment.id), newComment);

        // Append to list
        queryClient.setQueriesData<any>(
            { queryKey: queryKeys.comments.byReport(newComment.report_id) },
            (old: any) => {
                if (!old) {
                    // Initialize list and increment counter
                    reportsCache.applyCommentDelta(queryClient, newComment.report_id, 1);
                    return [newComment.id];
                }

                const appendAction = (list: any) => {
                    const sanitizedList = Array.isArray(list) ? list.filter(id => typeof id === 'string') : [];
                    const exists = sanitizedList.includes(newComment.id);
                    if (exists) return sanitizedList; // Already counted, skip

                    // SIDE EFFECT: Increment report counter ONLY for truly new comments
                    reportsCache.applyCommentDelta(queryClient, newComment.report_id, 1);
                    return [...sanitizedList, newComment.id];
                }

                if (Array.isArray(old)) return appendAction(old)
                if (old.comments) return { ...old, comments: appendAction(old.comments) }
                return old
            }
        );
    },

    prepend: (queryClient: QueryClient, newComment: Comment) => {
        // Store canonical
        queryClient.setQueryData(queryKeys.comments.detail(newComment.id), newComment);

        // Prepend to list
        queryClient.setQueriesData<any>(
            { queryKey: queryKeys.comments.byReport(newComment.report_id) },
            (old: any) => {
                if (!old) {
                    // Initialize list and increment counter
                    reportsCache.applyCommentDelta(queryClient, newComment.report_id, 1);
                    return [newComment.id];
                }

                const prependAction = (list: any) => {
                    const sanitizedList = Array.isArray(list) ? list.filter(id => typeof id === 'string') : [];
                    const exists = sanitizedList.includes(newComment.id);
                    if (exists) return sanitizedList; // Already counted, skip

                    // SIDE EFFECT: Increment report counter (Enterprise Idempotency)
                    reportsCache.applyCommentDelta(queryClient, newComment.report_id, 1);
                    return [newComment.id, ...sanitizedList];
                }

                if (Array.isArray(old)) return prependAction(old)
                if (old.comments) return { ...old, comments: prependAction(old.comments) }
                return old
            }
        );
    }
};

// ============================================
// STATS HELPER
// ============================================

export const statsCache = {
    /**
     * Generic delta update for global statistics
     */
    applyDelta: (queryClient: QueryClient, field: string, delta: number) => {
        queryClient.setQueryData(queryKeys.stats.global, (old: any) => {
            if (!old) return old;
            return {
                ...old,
                [field]: Math.max(0, (old[field] || 0) + delta)
            };
        });
    },

    /**
     * Increment global report count and specific category count
     */
    applyReportCreate: (queryClient: QueryClient, category: string, status?: string) => {
        // 1. Update Global Counters
        statsCache.applyDelta(queryClient, 'total_reports', 1);

        // If report is created as resolved, increment resolved counter too
        if (status === 'resuelto') {
            statsCache.applyDelta(queryClient, 'resolved_reports', 1);
        }

        // 2. Update Category Breakdown
        queryClient.setQueryData(queryKeys.stats.categories, (old: any) => {
            if (!old) return old;
            return {
                ...old,
                [category]: (old[category] || 0) + 1
            };
        });
    },

    /**
     * Decrement global report count and specific category count
     */
    applyReportDelete: (queryClient: QueryClient, _category: string, status?: string) => {
        // 1. Update Global Counters
        statsCache.applyDelta(queryClient, 'total_reports', -1);

        // If the deleted report was resolved, decrement resolved counter too
        if (status === 'resuelto') {
            statsCache.applyDelta(queryClient, 'resolved_reports', -1);
        }

        // 2. Update Category Breakdown
        // HISTORICAL TOTALS: We do NOT decrement category stats on deletion
        // per user requirement: "conteo total histórico"
        /*
        queryClient.setQueryData(queryKeys.stats.categories, (old: any) => {
            if (!old) return old;
            return {
                ...old,
                [category]: Math.max(0, (old[category] || 0) - 1)
            };
        });
        */
    },

    /**
     * Atomic update for resolved reports counter when a status changes
     */
    applyStatusChange: (queryClient: QueryClient, prevStatus: string, nextStatus: string) => {
        const wasResolved = prevStatus === 'resuelto';
        const isResolved = nextStatus === 'resuelto';

        if (wasResolved === isResolved) return; // No change in resolution status

        const delta = isResolved ? 1 : -1;
        statsCache.applyDelta(queryClient, 'resolved_reports', delta);
    },

    /**
     * Increment total users counter (Global Stats)
     */
    incrementUsers: (queryClient: QueryClient) => {
        statsCache.applyDelta(queryClient, 'total_users', 1);
    }
};
