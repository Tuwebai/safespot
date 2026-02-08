import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { telemetry, TelemetrySeverity } from '@/lib/telemetry/TelemetryEngine';
import type { Report, ReportFilters } from '@/lib/api';
import { calculateDistance, isPointInBounds } from '@/lib/map-utils';
import type { Comment } from '@/lib/api';
import type { NormalizedReport } from '@/lib/normalizeReport';
import { normalizeReportForUI } from '@/lib/normalizeReport';

// Tipos para estructuras de caché de comentarios
type CommentList = string[];
type CommentDataStructure = CommentList | { comments: CommentList } | undefined;

/**
 * CACHE HELPERS (SSOT Architecture)
 */

export const reportsCache = {
    /**
     * CACHE HELPER CONTRACT (Enterprise Grade)
     * 
     * Invariants:
     * 1. No Data Invention: This helper NEVER invents or infers missing data.
     * 2. No Semantic Reconciliation: Logic regarding business rules belongs to M4/Backend.
     * 3. Atomic Merge Only: Merges are dumb and destructive. What comes in, rewrites state.
     */
    store: (queryClient: QueryClient, reports: Report[]): string[] => {
        const normalizedReports = reports.map(normalizeReportForUI);
        normalizedReports.forEach(report => {
            queryClient.setQueryData(queryKeys.reports.detail(report.id), report);
        });
        return normalizedReports.map(r => r.id);
    },

    patch: (queryClient: QueryClient, reportId: string, patch: Partial<Report> | ((old: Report) => Partial<Report>)) => {
        queryClient.setQueryData<NormalizedReport>(
            queryKeys.reports.detail(reportId),
            (old) => {
                if (!old) {
                    telemetry.emit({
                        engine: 'Cache',
                        severity: TelemetrySeverity.DEBUG,
                        payload: { action: 'cache_patch_skipped', entity: 'report', entityId: reportId, reason: 'not_in_cache' }
                    });
                    return undefined;
                }

                const updates = typeof patch === 'function' ? patch(old as Report) : patch;

                const updatedByObject = { ...old, ...updates };

                // 🟥 DEBT PURGED: Identity Reconciliation removed. 
                // Authority resides in Backend/M4. No heuristic patching allowed.

                // Normalization Check
                if ('alias' in updates || 'created_at' in updates) {
                    const final = normalizeReportForUI(updatedByObject as Report);
                    telemetry.emit({
                        engine: 'Cache',
                        severity: TelemetrySeverity.DEBUG,
                        payload: { action: 'cache_patch_applied', entity: 'report', entityId: reportId, normalized: true }
                    });
                    return final;
                }

                telemetry.emit({
                    engine: 'Cache',
                    severity: TelemetrySeverity.DEBUG,
                    payload: { action: 'cache_patch_applied', entity: 'report', entityId: reportId, normalized: false }
                });
                return updatedByObject as NormalizedReport;
            }
        );
    },

    remove: (queryClient: QueryClient, reportId: string) => {
        queryClient.removeQueries({ queryKey: queryKeys.reports.detail(reportId) });
        queryClient.setQueriesData<string[]>(
            { queryKey: ['reports', 'list'], exact: false },
            (oldList) => {
                if (!Array.isArray(oldList)) return oldList;
                return oldList.filter(id => id !== reportId);
            }
        );
    },

    applyLikeDelta: (queryClient: QueryClient, reportId: string, delta: number) => {
        queryClient.setQueryData<Report>(
            queryKeys.reports.detail(reportId),
            (old) => {
                if (!old) return undefined;
                return { ...old, upvotes_count: Math.max(0, (old.upvotes_count || 0) + delta) };
            }
        );
    },

    applyCommentDelta: (queryClient: QueryClient, reportId: string, delta: number) => {
        // CONTRACT CMT-ROOT-001: Atomic Counter Reconciliation
        // Delta must only apply to the target reportId to protect SSOT integrity.

        // 1. Update Detail Cache (Source of Truth)
        queryClient.setQueryData<NormalizedReport>(
            queryKeys.reports.detail(reportId),
            (old) => {
                if (!old) return undefined;
                // Safety: Defensive check to ensure we are patching the right object
                if (old.id !== reportId) return old;
                return { ...old, comments_count: Math.max(0, (old.comments_count || 0) + delta) };
            }
        );

        // 2. Trigger List Observers (Reactive hydration)
        queryClient.setQueriesData<string[]>(
            { queryKey: ['reports', 'list'], exact: false },
            (oldList) => {
                if (!Array.isArray(oldList)) return oldList;
                // We only trigger re-render if the list actually contains the report being modified.
                // This prevents unnecessary re-renders in unrelated views.
                if (!oldList.includes(reportId)) return oldList;
                return [...oldList];
            }
        );
    },

    prepend: (queryClient: QueryClient, newReport: Report) => {
        const normalizedReport = normalizeReportForUI(newReport);
        queryClient.setQueryData(queryKeys.reports.detail(normalizedReport.id), normalizedReport);
        const queries = queryClient.getQueriesData<string[]>({ queryKey: ['reports', 'list'], exact: false });

        queries.forEach(([queryKey, oldData]) => {
            if (!Array.isArray(oldData)) return;
            const filters = queryKey[2] as ReportFilters | string | undefined;
            const matches = !filters || reportsCache.matchesFilters(normalizedReport, filters);

            if (!matches) return;

            queryClient.setQueryData<string[]>(queryKey, (old) => {
                const currentOld = old || [];
                const uniqueOld = currentOld.filter(id => id !== normalizedReport.id);
                return [normalizedReport.id, ...uniqueOld];
            });
        });
    },

    matchesFilters: (report: NormalizedReport, filters: ReportFilters | string): boolean => {
        if (typeof filters === 'string') {
            if (filters === 'all') return true;
            const parts = filters.split(',').map(Number);
            if (parts.length === 4 && !parts.some(isNaN)) {
                const [north, south, east, west] = parts;
                return isPointInBounds(Number(report.latitude), Number(report.longitude), { north, south, east, west });
            }
            return true;
        }
        if (filters.category && report.category !== filters.category) return false;
        if (filters.status && report.status !== filters.status) return false;
        if (filters.zone && report.zone !== filters.zone) return false;
        if (filters.lat && filters.lng && filters.radius) {
            const distance = calculateDistance(Number(report.latitude), Number(report.longitude), filters.lat, filters.lng);
            if (distance > filters.radius) return false;
        }
        if (filters.search) {
            const term = filters.search.toLowerCase();
            const matches = report.title.toLowerCase().includes(term) || report.description.toLowerCase().includes(term);
            if (!matches) return false;
        }
        return true;
    },

    swapId: (queryClient: QueryClient, oldId: string, newId: string) => {
        if (oldId === newId) return;
        const oldData = queryClient.getQueryData<NormalizedReport>(queryKeys.reports.detail(oldId));
        if (oldData) {
            const newData = { ...oldData, id: newId };
            queryClient.setQueryData(queryKeys.reports.detail(newId), newData);
            queryClient.removeQueries({ queryKey: queryKeys.reports.detail(oldId) });
        }
        queryClient.setQueriesData<string[]>(
            { queryKey: ['reports', 'list'], exact: false },
            (oldList) => {
                if (!Array.isArray(oldList)) return oldList;
                return oldList.map(id => id === oldId ? newId : id);
            }
        );
    },

    hydrate: (queryClient: QueryClient, ids: string[]): NormalizedReport[] => {
        return ids.map(id => {
            const data = queryClient.getQueryData<NormalizedReport>(queryKeys.reports.detail(id));
            return data!;
        }).filter(Boolean);
    }
};

export const commentsCache = {
    store: (queryClient: QueryClient, comments: Comment | Comment[]): string[] => {
        const list = Array.isArray(comments) ? comments : [comments];
        list.forEach(comment => {
            queryClient.setQueryData(queryKeys.comments.detail(comment.id), comment);
        });
        return list.map(c => c.id);
    },

    patch: (queryClient: QueryClient, commentId: string, patch: Partial<Comment> | ((old: Comment) => Partial<Comment>)) => {
        queryClient.setQueryData<Comment>(
            queryKeys.comments.detail(commentId),
            (old: Comment | undefined) => {
                if (!old) {
                    telemetry.emit({
                        engine: 'Cache',
                        severity: TelemetrySeverity.DEBUG,
                        payload: { action: 'cache_patch_skipped', entity: 'comment', entityId: commentId, reason: 'not_in_cache' }
                    });
                    return undefined;
                }
                const updates = typeof patch === 'function' ? patch(old) : patch;
                const final = { ...old, ...updates };

                telemetry.emit({
                    engine: 'Cache',
                    severity: TelemetrySeverity.DEBUG,
                    payload: { action: 'cache_patch_applied', entity: 'comment', entityId: commentId }
                });
                return final;
            }
        );
    },

    applyLikeDelta: (queryClient: QueryClient, commentId: string, delta: number) => {
        queryClient.setQueryData<Comment>(
            queryKeys.comments.detail(commentId),
            (old: Comment | undefined) => {
                if (!old) return undefined;
                return { ...old, upvotes_count: Math.max(0, (old.upvotes_count || 0) + delta) };
            }
        );
    },

    remove: (queryClient: QueryClient, commentId: string, reportId: string) => {
        // 🔴 NO USAR removeQueries: Evita el error "Missing queryFn" si la query sigue siendo observada.
        // 🔴 NO USAR invalidateQueries: queryClient tiene guard que bloquea operaciones en comments.
        // ✅ USAR setQueryData(undefined): Marca la query como inexistente sin triggerar refetch.

        queryClient.setQueriesData<CommentDataStructure>(
            { queryKey: queryKeys.comments.byReport(reportId) },
            (old) => {
                if (!old) return old;
                const removeAction = (list: CommentList) => {
                    const sanitizedList = Array.isArray(list) ? list.filter(id => typeof id === 'string') : [];
                    if (!sanitizedList.includes(commentId)) return sanitizedList;

                    // ✅ Sincronización Atómica del Contador
                    reportsCache.applyCommentDelta(queryClient, reportId, -1);
                    return sanitizedList.filter(id => id !== commentId);
                }
                if (Array.isArray(old)) return removeAction(old);
                if (old.comments) return { ...old, comments: removeAction(old.comments) };
                return old;
            }
        );

        // ✅ ENTERPRISE FIX: Setear query detail a undefined
        // Problema: useQueries en useCommentsManager sigue observando el ID hasta el próximo render
        // Si usamos invalidate/remove → React Query intenta refetch → Missing queryFn
        // Solución: Setear a undefined → observer ve "no data" → no intenta refetch
        queryClient.setQueryData(
            queryKeys.comments.detail(commentId),
            undefined
        );
    },

    append: (queryClient: QueryClient, newComment: Comment) => {
        queryClient.setQueryData(queryKeys.comments.detail(newComment.id), newComment);
        queryClient.setQueriesData<CommentDataStructure>(
            { queryKey: queryKeys.comments.byReport(newComment.report_id) },
            (old) => {
                const appendAction = (list: CommentList) => {
                    const sanitizedList = Array.isArray(list) ? list.filter(id => typeof id === 'string') : [];
                    if (sanitizedList.includes(newComment.id)) return sanitizedList;
                    reportsCache.applyCommentDelta(queryClient, newComment.report_id, 1);
                    return [...sanitizedList, newComment.id];
                }
                if (!old) {
                    reportsCache.applyCommentDelta(queryClient, newComment.report_id, 1);
                    return [newComment.id];
                }
                if (Array.isArray(old)) return appendAction(old);
                if (old.comments) return { ...old, comments: appendAction(old.comments) };
                return old;
            }
        );
    },

    prepend: (queryClient: QueryClient, newComment: Comment) => {
        queryClient.setQueryData(queryKeys.comments.detail(newComment.id), newComment);
        queryClient.setQueriesData<CommentDataStructure>(
            { queryKey: queryKeys.comments.byReport(newComment.report_id) },
            (old) => {
                const prependAction = (list: CommentList) => {
                    const sanitizedList = Array.isArray(list) ? list.filter(id => typeof id === 'string') : [];
                    if (sanitizedList.includes(newComment.id)) return sanitizedList;
                    reportsCache.applyCommentDelta(queryClient, newComment.report_id, 1);
                    return [newComment.id, ...sanitizedList];
                }
                if (!old) {
                    reportsCache.applyCommentDelta(queryClient, newComment.report_id, 1);
                    return [newComment.id];
                }
                if (Array.isArray(old)) return prependAction(old);
                if (old.comments) return { ...old, comments: prependAction(old.comments) };
                return old;
            }
        );
    },

    swapId: (queryClient: QueryClient, oldId: string, newId: string, reportId: string) => {
        if (oldId === newId) return;

        // 1. Swap Detail Cache
        const oldData = queryClient.getQueryData<Comment>(queryKeys.comments.detail(oldId));
        if (oldData) {
            queryClient.setQueryData(queryKeys.comments.detail(newId), { ...oldData, id: newId, is_optimistic: false });
            // We DON'T remove oldId yet to keep UI stable if an observer is still looking at it
            // but we ensure it's not the primary one.
        }

        // 2. Swap List Caches
        queryClient.setQueriesData<any>(
            { queryKey: queryKeys.comments.byReport(reportId) },
            (old: any) => {
                const swapAction = (list: any) => {
                    if (!Array.isArray(list)) return list;
                    return list.map(id => id === oldId ? newId : id);
                }
                if (Array.isArray(old)) return swapAction(old);
                if (old.comments) return { ...old, comments: swapAction(old.comments) };
                return old;
            }
        );

        // 3. Deferred Cleanup
        setTimeout(() => {
            queryClient.removeQueries({ queryKey: queryKeys.comments.detail(oldId) });
        }, 1000);
    }
};

export const statsCache = {
    applyDelta: (queryClient: QueryClient, field: string, delta: number) => {
        queryClient.setQueryData<Record<string, number>>(queryKeys.stats.global, (old) => {
            if (!old) return old;
            return { ...old, [field]: Math.max(0, (old[field] || 0) + delta) };
        });
    },

    applyReportCreate: (queryClient: QueryClient, category: string, status?: string) => {
        statsCache.applyDelta(queryClient, 'total_reports', 1);
        if (status === 'resuelto') statsCache.applyDelta(queryClient, 'resolved_reports', 1);
        queryClient.setQueryData<Record<string, number>>(queryKeys.stats.categories, (old) => {
            if (!old) return old;
            return { ...old, [category]: (old[category] || 0) + 1 };
        });
    },

    applyReportDelete: (queryClient: QueryClient, _category: string, status?: string) => {
        statsCache.applyDelta(queryClient, 'total_reports', -1);
        if (status === 'resuelto') statsCache.applyDelta(queryClient, 'resolved_reports', -1);
    },

    applyStatusChange: (queryClient: QueryClient, prevStatus: string, nextStatus: string) => {
        const wasResolved = prevStatus === 'resuelto';
        const isResolved = nextStatus === 'resuelto';
        if (wasResolved === isResolved) return;
        const delta = isResolved ? 1 : -1;
        statsCache.applyDelta(queryClient, 'resolved_reports', delta);
    },

    incrementUsers: (queryClient: QueryClient) => {
        statsCache.applyDelta(queryClient, 'total_users', 1);
    }
};
