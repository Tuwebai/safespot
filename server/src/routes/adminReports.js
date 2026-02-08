import express from 'express';
import { supabaseAdmin } from '../utils/db.js';
import { verifyAdminToken } from '../utils/adminMiddleware.js';
import { executeModeration } from '../utils/governance.js';

const router = express.Router();

/**
 * GET /api/admin/reports
 * ... (existing list code)
 */
router.get('/', verifyAdminToken, async (req, res) => {
    // ... (existing list implementation)
    try {
        // Parse and validate query params
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20)); // Max 100
        const search = req.query.search?.trim() || '';
        const status = req.query.status?.trim() || '';

        // Validate status if provided
        const validStatuses = ['abierto', 'en_progreso', 'resuelto', 'verificado', 'rechazado', 'archivado', 'deleted'];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({
                error: 'Invalid status parameter',
                validValues: validStatuses
            });
        }

        // Calculate pagination range
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        // Build main query with explicit SELECT (NO r.*)
        let query = supabaseAdmin
            .from('reports')
            .select(`
                id,
                title,
                description,
                category,
                status,
                created_at,
                deleted_at,
                is_hidden,
                anonymous_id,
                is_hidden,
                flags_count,
                anonymous_users!inner (
                    alias,
                    avatar_url
                )
            `);

        // Apply filters
        if (search) {
            query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
        }

        if (status) {
            if (status === 'deleted') {
                query = query.not('deleted_at', 'is', null);
            } else {
                query = query.eq('status', status);
            }
        }

        query = query.order('created_at', { ascending: false });
        query = query.range(from, to);

        const { data, error } = await query;
        if (error) throw error;

        // Build count query
        let countQuery = supabaseAdmin
            .from('reports')
            .select('*', { count: 'exact', head: true });

        if (search) {
            countQuery = countQuery.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
        }

        if (status) {
            if (status === 'deleted') {
                countQuery = countQuery.not('deleted_at', 'is', null);
            } else {
                countQuery = countQuery.eq('status', status);
            }
        }

        const { count, error: countError } = await countQuery;
        if (countError) throw countError;

        const reports = data.map(report => ({
            id: report.id,
            title: report.title,
            description: report.description,
            category: report.category,
            status: report.status,
            created_at: report.created_at,
            deleted_at: report.deleted_at,
            is_hidden: report.is_hidden,
            anonymous_id: report.anonymous_id,
            flags_count: report.flags_count,
            author: {
                alias: report.anonymous_users?.alias || null,
                avatar_url: report.anonymous_users?.avatar_url || null
            }
        }));

        res.json({
            data: reports,
            meta: {
                page,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit)
            }
        });

    } catch (error) {
        console.error('[Admin Reports] List Error:', error);
        res.status(500).json({ error: 'Failed to fetch reports' });
    }
});

/**
 * GET /api/admin/reports/:id
 * Get detailed report info for moderation
 */
router.get('/:id', verifyAdminToken, async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Fetch report with full fields (location, social, media)
        const { data: report, error: reportError } = await supabaseAdmin
            .from('reports')
            .select(`
                *,
                anonymous_users!inner (alias, avatar_url, anonymous_id)
            `)
            .eq('id', id)
            .single();

        if (reportError || !report) {
            return res.status(404).json({ error: 'Report not found' });
        }

        // 2. Fetch moderation notes
        const { data: notes } = await supabaseAdmin
            .from('moderation_notes')
            .select(`*, admin_users:created_by (alias, email)`)
            .eq('entity_type', 'report')
            .eq('entity_id', id)
            .order('created_at', { ascending: false });

        // 3. Fetch moderation history
        const { data: history } = await supabaseAdmin
            .from('moderation_actions')
            .select(`*, admin_users:actor_id (alias, email)`)
            .eq('target_type', 'report')
            .eq('target_id', id)
            .order('created_at', { ascending: false })
            .limit(10);

        // 4. Fetch active flags
        const { data: flags, count: flagsCount } = await supabaseAdmin
            .from('report_flags')
            .select('id, reason, created_at, anonymous_id', { count: 'exact' })
            .eq('report_id', id)
            .is('resolved_at', null)
            .order('created_at', { ascending: false });

        res.json({
            success: true,
            data: {
                report: {
                    id: report.id,
                    title: report.title,
                    description: report.description,
                    category: report.category,
                    status: report.status,
                    created_at: report.created_at,
                    anonymous_id: report.anonymous_id,
                    is_hidden: report.is_hidden,
                    flags_count: report.flags_count || 0,
                    latitude: report.latitude,
                    longitude: report.longitude,
                    address: report.address,
                    fullAddress: report.fullAddress,
                    zone: report.zone,
                    image_urls: report.image_urls,
                    upvotes_count: report.upvotes_count || 0,
                    comments_count: report.comments_count || 0,
                    deleted_at: report.deleted_at,
                    author: {
                        alias: report.anonymous_users?.alias || null,
                        avatar_url: report.anonymous_users?.avatar_url || null
                    }
                },
                notes: notes || [],
                history: history || [],
                flags: flags || [],
                flagsCount: flagsCount || 0
            }
        });

    } catch (error) {
        console.error('[Admin Reports] Detail Error:', error);
        res.status(500).json({ error: 'Failed to fetch report details' });
    }
});

/**
 * PATCH /api/admin/reports/:id/status
 * Update report status using Governance Engine
 */
router.patch('/:id/status', verifyAdminToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body;

        if (!reason || reason.trim().length < 5) {
            return res.status(400).json({ error: 'Reason is required (min 5 chars) for audit trail' });
        }

        const validStatuses = ['abierto', 'en_progreso', 'resuelto', 'verificado', 'rechazado', 'archivado'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        await executeModeration({
            actorId: req.adminUser.id,
            targetType: 'report',
            targetId: id,
            actionType: 'ADMIN_REPORT_STATUS_CHANGE',
            updateQuery: 'UPDATE reports SET status = $2, updated_at = NOW() WHERE id = $1',
            updateParams: [id, status],
            reason: reason.trim()
        });

        res.json({ success: true, message: 'Status updated with M12 accountability' });
    } catch (error) {
        console.error('[Admin Reports] Status Update Error:', error);
        res.status(500).json({ error: 'Failed to update status via Governance Engine' });
    }
});

/**
 * PATCH /api/admin/reports/:id/visibility
 * Toggle visibility using Governance Engine
 */
router.patch('/:id/visibility', verifyAdminToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { is_hidden, reason } = req.body;

        if (!reason || reason.trim().length < 5) {
            return res.status(400).json({ error: 'Reason is required for visibility changes' });
        }

        const actionType = is_hidden ? 'ADMIN_HIDE' : 'ADMIN_SHOW';

        await executeModeration({
            actorId: req.adminUser.id,
            targetType: 'report',
            targetId: id,
            actionType,
            updateQuery: 'UPDATE reports SET is_hidden = $2, updated_at = NOW() WHERE id = $1',
            updateParams: [id, !!is_hidden],
            reason: reason.trim()
        });

        res.json({ success: true, message: `Report ${is_hidden ? 'hidden' : 'shown'} with audit record` });
    } catch (error) {
        console.error('[Admin Reports] Visibility Error:', error);
        res.status(500).json({ error: 'Failed to update visibility' });
    }
});

/**
 * POST /api/admin/reports/:id/notes
 * Add internal moderation note (Append-only)
 */
router.post('/:id/notes', verifyAdminToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { note } = req.body;

        if (!note || note.trim().length < 3) {
            return res.status(400).json({ error: 'Note is too short (min 3 chars)' });
        }

        const { error } = await supabaseAdmin
            .from('moderation_notes')
            .insert({
                entity_type: 'report',
                entity_id: id,
                note: note.trim(),
                created_by: req.adminUser.id
            });

        if (error) throw error;

        res.json({ success: true, message: 'Note added successfully' });
    } catch (error) {
        console.error('[Admin Reports] Note Error:', error);
        res.status(500).json({ error: 'Failed to add moderation note' });
    }
});

/**
 * DELETE /api/admin/reports/:id
 * Soft delete using Governance Engine
 */
router.delete('/:id', verifyAdminToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason || reason.trim().length < 10) {
            return res.status(400).json({ error: 'Detailed reason is required for deletion (min 10 chars)' });
        }

        // Pre-check if already deleted
        const { data: existing } = await supabaseAdmin
            .from('reports')
            .select('deleted_at')
            .eq('id', id)
            .single();

        if (existing?.deleted_at) {
            return res.status(400).json({ error: 'Report is already deleted' });
        }

        await executeModeration({
            actorId: req.adminUser.id,
            targetType: 'report',
            targetId: id,
            actionType: 'ADMIN_HIDE',
            updateQuery: 'UPDATE reports SET deleted_at = NOW() WHERE id = $1',
            updateParams: [id],
            reason: reason.trim()
        });

        res.json({ success: true, message: 'Report soft-deleted and archived in audit log' });
    } catch (error) {
        console.error('[Admin Reports] Delete Error:', error);
        res.status(500).json({ error: 'Failed to perform secure deletion' });
    }
});

/**
 * PATCH /api/admin/reports/:id/restore
 * Restore a soft-deleted report using Governance Engine
 */
router.patch('/:id/restore', verifyAdminToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason || reason.trim().length < 5) {
            return res.status(400).json({ error: 'Reason is required for restoration' });
        }

        await executeModeration({
            actorId: req.adminUser.id,
            targetType: 'report',
            targetId: id,
            actionType: 'ADMIN_RESTORE',
            updateQuery: 'UPDATE reports SET deleted_at = NULL, updated_at = NOW() WHERE id = $1',
            updateParams: [id],
            reason: reason.trim()
        });

        res.json({ success: true, message: 'Report restored successfully' });
    } catch (error) {
        console.error('[Admin Reports] Restore Error:', error);
        res.status(500).json({ error: 'Failed to restore report' });
    }
});

export default router;
