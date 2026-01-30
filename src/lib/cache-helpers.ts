import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import type { Report, ReportFilters } from '@/lib/api';
import type { Comment } from '@/lib/api';
import type { NormalizedReport } from '@/lib/normalizeReport';
import { normalizeReportForUI } from '@/lib/normalizeReport';

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

        // ✅ Store in canonical cache (single iteration)
        normalizedReports.forEach(report => {
            queryClient.setQueryData(
                queryKeys.reports.detail(report.id),
                report
            );
        });

        return normalizedReports.map(r => r.id);
    },

    /**
     * Update a report EVERYWHERE (Canonical + Derived State)
     * ✅ RULE #14 FIX: Re-normalizes when patch affects derived fields
     */
    patch: (queryClient: QueryClient, reportId: string, patch: Partial<Report> | ((old: Report) => Partial<Report>)) => {
        queryClient.setQueryData<NormalizedReport>(
            queryKeys.reports.detail(reportId),
            (old) => {
                if (!old) return undefined;
                const updates = typeof patch === 'function' ? patch(old as Report) : patch;

                // ATOMIC DELTA LOGIC
                if ('comments_count_delta' in updates && updates.comments_count_delta !== undefined) {
                    const delta = updates.comments_count_delta as number;
                    const { comments_count_delta, ...rest } = updates;
                    const updated = {
                        ...old,
                        ...rest,
                        comments_count: Math.max(0, (old.comments_count || 0) + delta)
                    };

                    if ('alias' in rest || 'anonymous_id' in rest || 'created_at' in rest) {
                        return normalizeReportForUI(updated as Report);
                    }
                    return updated as NormalizedReport;
                }

                const updated = { ...old, ...updates };

                // ✅ IDENTITY RECONCILIATION (Strict SSOT):
                // If the patch comes from a Raw Source (SSE) containing flat fields,
                // we must manually update the nested 'author' object to maintain SSOT.
                if ('alias' in updates || 'avatar_url' in updates) {
                    const rawUpdates = updates as any;

                    // 🔒 GUARD: Never allow null/undefined to overwrite existing valid data
                    // If backend sends null, fallback to 'Anónimo' immediately if no previous value existed.
                    // If previous value existed, keep it unless new value is non-null.

                    const oldAuthor = old.author;
                    const newAliasRaw = rawUpdates.alias;
                    const newAvatarRaw = rawUpdates.avatar_url;

                    // Logic: 
                    // 1. If new value is provided (string), use it.
                    // 2. If new value is null/undefined, keep old.
                    // 3. If old is also missing, fallback to default.

                    const resolvedAlias = (newAliasRaw !== undefined && newAliasRaw !== null)
                        ? newAliasRaw
                        : (oldAuthor?.alias || 'Anónimo');

                    const resolvedAvatar = (newAvatarRaw !== undefined && newAvatarRaw !== null)
                        ? newAvatarRaw
                        : (oldAuthor?.avatarUrl || null); // Avatar can be null/undefined, alias cannot

                    updated.author = {
                        ...oldAuthor,
                        alias: resolvedAlias,
                        avatarUrl: resolvedAvatar,
                        // Maintain ID and other invariant props
                        id: oldAuthor?.id || 'unknown',
                        isAuthor: oldAuthor?.isAuthor ?? false
                    };
                }

                if ('alias' in updates || 'created_at' in updates) {
                    return normalizeReportForUI(updated as Report);
                }

                return updated as NormalizedReport;
            }
        );
    },

    /**
     * Remove a report from EVERYWHERE
     * ✅ ENTERPRISE FIX: Uses prefix match to remove from ALL list queries
     */
    remove: (queryClient: QueryClient, reportId: string) => {
        // 1. Remove detail cache
        queryClient.removeQueries({ queryKey: queryKeys.reports.detail(reportId) });

        // 2. Remove from ALL list queries (with or without filters)
        queryClient.setQueriesData<Report[]>(
            { queryKey: ['reports', 'list'], exact: false },
            (oldList) => {
                // ✅ ENTERPRISE FIX: Preserve undefined/loading state. NUNCA retornar [] si no hay lista.
                if (!Array.isArray(oldList)) return oldList;
                // Filter objects by ID
                return oldList.filter(report => report.id !== reportId);
            }
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

    prepend: (queryClient: QueryClient, newReport: Report) => {
        // ✅ ENTERPRISE: Normalize for UI before storing
        const normalizedReport = normalizeReportForUI(newReport);

        // 1. Store Canonical (Essential for detail view)
        queryClient.setQueryData(queryKeys.reports.detail(normalizedReport.id), normalizedReport);

        // 2. Update matching lists surgically
        // Use getQueriesData to identify existing lists in cache
        const queries = queryClient.getQueriesData<Report[]>({ queryKey: ['reports', 'list'], exact: false });

        queries.forEach(([queryKey, oldData]) => {
            // ✅ ENTERPRISE FIX: Skip lists that are not yet hydrated or are loading
            if (!Array.isArray(oldData)) return;

            const filters = queryKey[2] as ReportFilters | undefined;

            // Verify if the report matches the specific query filters
            const matches = !filters || reportsCache.matchesFilters(normalizedReport, filters);
            if (!matches) return;

            // Apply update ONLY to that specific query, preserving rest of state
            queryClient.setQueryData<Report[]>(queryKey, (old) => {
                if (!Array.isArray(old)) return old; // redundant but safe
                const uniqueOld = old.filter(r => r.id !== normalizedReport.id);
                return [normalizedReport, ...uniqueOld];
            });
        });

        // ✅ REDESIGN: Step 3 Fallback REMOVED. 
        // We never seed a list with incomplete data. If it doesn't exist, the UI will fetch it.
    },

    /**
     * Internal filter matcher for surgical cache updates
     */
    matchesFilters: (report: NormalizedReport, filters: ReportFilters): boolean => {
        // Filter by category
        if (filters.category && report.category !== filters.category) return false;

        // Filter by status
        if (filters.status && report.status !== filters.status) return false;

        // Filter by zone
        if (filters.zone && report.zone !== filters.zone) return false;

        // Search filters and location-radius filters are harder to match client-side 
        // without heavy logic, so we remain conservative to avoid false positives.
        if (filters.search || filters.radius) return false;

        return true;
    },

    /**
     * Swap a temporary ID with a real Server ID (Reconciliation)
     * Critical for preventing "Ghost Items" and unique key warnings when Server ignores Client ID.
     */
    swapId: (queryClient: QueryClient, oldId: string, newId: string) => {
        if (oldId === newId) return; // No op

        // 1. Move Detail Data (Preserve optimistic state but update ID)
        const oldData = queryClient.getQueryData<NormalizedReport>(queryKeys.reports.detail(oldId));
        if (oldData) {
            const newData = { ...oldData, id: newId };
            queryClient.setQueryData(queryKeys.reports.detail(newId), newData);
            queryClient.removeQueries({ queryKey: queryKeys.reports.detail(oldId) });
        }

        // 2. Swap ID in ALL lists (Objects)
        queryClient.setQueriesData<Report[]>(
            { queryKey: ['reports', 'list'], exact: false },
            (oldList) => {
                if (!Array.isArray(oldList)) return oldList;

                // Map old -> new (Object update)
                return oldList.map(report => {
                    if (report.id === oldId) {
                        return { ...report, id: newId };
                    }
                    return report;
                });
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
     */
    patch: (queryClient: QueryClient, commentId: string, patch: Partial<Comment> | ((old: Comment) => Partial<Comment>)) => {
        queryClient.setQueryData<Comment>(
            queryKeys.comments.detail(commentId),
            (old: Comment | undefined) => {
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
            (old: Comment | undefined) => {
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

                    // SIDE EFFECT: Increment report counter
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
