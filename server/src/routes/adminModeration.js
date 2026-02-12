import express from 'express';
import { supabaseAdmin } from '../utils/db.js';
import pool from '../config/database.js'; // Added for atomic transactions
import { verifyAdminToken } from '../utils/adminMiddleware.js';
import { logError } from '../utils/logger.js';
import { realtimeEvents } from '../utils/eventEmitter.js';
import { executeModeration } from '../utils/governance.js';
import { auditLog, AuditAction, ActorType } from '../services/auditService.js';

const router = express.Router();

/**
 * GET /api/admin/moderation/pending
 * List content requiring moderation (Hidden/Shadow-banned OR Flagged)
 * Query: type (optional: 'report' | 'comment')
 */
router.get('/pending', verifyAdminToken, async (req, res) => {
    try {
        const { type } = req.query; // 'report', 'comment', or undefined (both)

        const tasks = [];

        // 1. Fetch Reports
        if (!type || type === 'report') {
            const reportsQuery = supabaseAdmin
                .from('reports')
                .select(`
                    id, title, description, category, created_at, flags_count, is_hidden, anonymous_id, image_urls,
                    anonymous_users ( alias, avatar_url, anonymous_id )
                `)
                .or('is_hidden.eq.true,flags_count.gt.0')
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
                .limit(50);

            tasks.push(reportsQuery.then(({ data, error }) => {
                if (error) throw error;
                return data.map(r => ({
                    id: r.id,
                    type: 'report',
                    content: { title: r.title, description: r.description, images: r.image_urls },
                    author: r.anonymous_users,
                    reason: r.is_hidden ? 'Shadow Banned / Auto-Mod' : 'User Flags',
                    flags_count: r.flags_count,
                    created_at: r.created_at,
                    status: r.is_hidden ? 'hidden' : 'active'
                }));
            }));
        }

        // 2. Fetch Comments
        if (!type || type === 'comment') {
            const commentsQuery = supabaseAdmin
                .from('comments')
                .select(`
                    id, content, created_at, flags_count, is_hidden, anonymous_id, report_id,
                    anonymous_users ( alias, avatar_url, anonymous_id ),
                    reports ( title )
                `)
                .or('is_hidden.eq.true,flags_count.gt.0')
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
                .limit(50);

            tasks.push(commentsQuery.then(({ data, error }) => {
                if (error) throw error;
                return data.map(c => ({
                    id: c.id,
                    type: 'comment',
                    content: { text: c.content, reportTitle: c.reports?.title },
                    author: c.anonymous_users,
                    reason: c.is_hidden ? 'Shadow Banned' : 'User Flags',
                    flags_count: c.flags_count,
                    created_at: c.created_at,
                    status: c.is_hidden ? 'hidden' : 'active'
                }));
            }));
        }

        const results = await Promise.all(tasks);
        const data = results.flat().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.json({ success: true, data });

    } catch (error) {
        console.error('Moderation List Error:', error);
        res.status(500).json({ error: 'Failed to fetch moderation queue' });
    }
});

/**
 * POST /api/admin/moderation/:type/:id/resolve
 * Resolve a moderation case
 * Action: 'approve' (restore), 'reject' (delete), 'dismiss_flags' (clear flags)
 */
router.post('/:type/:id/resolve', verifyAdminToken, async (req, res) => {
    try {
        const { type, id } = req.params;
        const { action, banUser, reason, internal_note } = req.body;

        if (!reason && action !== 'dismiss') {
            return res.status(400).json({ error: 'Reason is required for moderation actions' });
        }

        const isReport = type === 'reports' || type === 'report';
        const targetType = isReport ? 'report' : 'comment';
        const table = isReport ? 'reports' : 'comments';
        const flagsTable = isReport ? 'report_flags' : 'comment_flags';
        const foreignKey = isReport ? 'report_id' : 'comment_id';

        // 1. Resolve Action Types
        let auditActionType = '';
        let updateSql = '';
        let updateParams = [id];

        if (action === 'approve') {
            updateSql = `UPDATE ${table} SET is_hidden = false WHERE id = $1`;
            auditActionType = 'ADMIN_RESTORE';
        } else if (action === 'reject') {
            updateSql = `UPDATE ${table} SET deleted_at = NOW() WHERE id = $1`;
            auditActionType = 'ADMIN_HIDE';
        } else if (action === 'dismiss') {
            updateSql = `UPDATE ${table} SET is_hidden = false WHERE id = $1`;
            auditActionType = 'ADMIN_DISMISS_FLAGS';
        } else {
            return res.status(400).json({ error: 'Invalid action' });
        }

        // 2. ATOMIC EXECUTION via M12 Governance Engine
        const result = await executeModeration({
            actorId: req.adminUser.id,
            targetType,
            targetId: id,
            actionType: auditActionType,
            updateQuery: updateSql,
            updateParams,
            reason,
            internalNote: internal_note
        });

        // 3. Post-Transaction Auxiliary Operations (Best Effort / Non-blocking)
        // A. Resolve Flags y actualizar contador
        const flagStatus = (action === 'approve' || action === 'dismiss') ? 'dismissed' : 'resolved';

        // Marcar flags como resueltos
        pool.query(`
            UPDATE ${flagsTable} 
            SET status = $1, resolved_at = NOW(), admin_id = $2 
            WHERE ${foreignKey} = $3
        `, [flagStatus, req.adminUser.id, id]).catch(e => logError(e, { context: 'resolve_flags_error', id }));

        // NUEVO: Resetear flags_count a 0 si se aprueba/descarta
        if (action === 'approve' || action === 'dismiss') {
            pool.query(`
                UPDATE ${table} 
                SET flags_count = 0
                WHERE id = $1
            `, [id]).catch(e => logError(e, { context: 'reset_flags_count_error', id }));
        }

        // B. Realtime Events
        const currentItem = result.snapshot;
        if (isReport) {
            if (action === 'reject') {
                realtimeEvents.emitReportDelete(id, currentItem.category, currentItem.status);
            } else {
                realtimeEvents.broadcast(`report-update:${id}`, { is_hidden: false });
                realtimeEvents.emitGlobalUpdate('report-update', { id, is_hidden: false, type: 'report-update' });
            }
        }

        // C. Optional Chain: Ban User
        if (action === 'reject' && banUser && currentItem.anonymous_id) {
            try {
                await executeModeration({
                    actorId: req.adminUser.id,
                    targetType: 'user',
                    targetId: currentItem.anonymous_id,
                    actionType: 'ADMIN_BAN',
                    updateQuery: `UPDATE anonymous_trust_scores SET moderation_status = 'banned', last_score_update = NOW() WHERE anonymous_id = $1`,
                    updateParams: [currentItem.anonymous_id],
                    reason: reason || 'Content Rejected in Moderation',
                    internalNote: 'Automatic BAN from content rejection'
                });
                realtimeEvents.emitUserBan(currentItem.anonymous_id, { status: 'banned', reason: reason || 'Content Rejected' });
            } catch (banErr) {
                logError(banErr, { context: 'chain_ban_failed', userId: currentItem.anonymous_id });
            }
        }

        // AUDIT LOG
        auditLog({
            action: AuditAction.MODERATION_RESOLVE,
            description: `Moderation: ${action} on ${targetType} ${id}`,
            actorType: ActorType.ADMIN,
            actorId: req.adminUser.id,
            actorRole: req.adminUser.role,
            req,
            targetType,
            targetId: id,
            targetOwnerId: currentItem.anonymous_id,
            oldValues: { isHidden: currentItem.is_hidden, flagsCount: currentItem.flags_count },
            newValues: { action, banUser, flagsDismissed: action === 'approve' || action === 'dismiss' },
            metadata: { reason, internalNote, auditId: result.auditId },
            success: true
        }).catch(() => { });

        res.json({ success: true, message: 'Case resolved with M12 Governance Grade accountability.', auditId: result.auditId });

    } catch (error) {
        console.error('Moderation Action Error:', error);
        res.status(500).json({ error: 'Failed to resolve case. Governance engine rejected mutation.' });
    }
});


/**
 * GET /api/admin/moderation/:type/:id/notes
 * Fetch internal moderation notes
 */
router.get('/:type/:id/notes', verifyAdminToken, async (req, res) => {
    try {
        const { type, id } = req.params;
        const normalizedType = type === 'reports' ? 'report' : type === 'comments' ? 'comment' : type;

        const { data, error } = await supabaseAdmin
            .from('moderation_notes')
            .select(`
                *,
                admin_users:created_by (
                    alias,
                    email
                )
            `)
            .eq('entity_type', normalizedType)
            .eq('entity_id', id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error) {
        console.error('Fetch Notes Error:', error);
        res.status(500).json({ error: 'Failed to fetch notes' });
    }
});

/**
 * POST /api/admin/moderation/:type/:id/notes
 * Add a new internal note (Append Only)
 */
router.post('/:type/:id/notes', verifyAdminToken, async (req, res) => {
    try {
        const { type, id } = req.params;
        const { note } = req.body;
        const normalizedType = type === 'reports' ? 'report' : type === 'comments' ? 'comment' : type;

        if (!note || note.trim().length < 3) {
            return res.status(400).json({ error: 'Note is too short' });
        }

        const { data, error } = await supabaseAdmin
            .from('moderation_notes')
            .insert({
                entity_type: normalizedType,
                entity_id: id,
                note: note.trim(),
                created_by: req.adminUser.id
            })
            .select() // Return the created item
            .single();

        if (error) throw error;

        res.json({ success: true, data });
    } catch (error) {
        console.error('Create Note Error:', error);
        res.status(500).json({ error: 'Failed to create note' });
    }
});

/**
 * GET /api/admin/moderation/history
 * Audit Log Viewer (Immutable)
 * Query: page, limit, type, entityId, actorId
 */
router.get('/history', verifyAdminToken, async (req, res) => {
    try {
        const { page = 1, limit = 50, type, entityId, actorId } = req.query;
        const offset = (page - 1) * limit;

        let query = supabaseAdmin
            .from('moderation_actions')
            .select(`
                *,
                admin_users:actor_id ( email, alias )
            `, { count: 'exact' });

        if (type) query = query.eq('target_type', type);
        if (entityId) query = query.eq('target_id', entityId);
        if (actorId) query = query.eq('actor_id', actorId);

        // Strict Order: Newest First
        query = query.order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        const { data, count, error } = await query;

        if (error) throw error;

        res.json({
            success: true,
            data,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count,
                pages: Math.ceil(count / limit)
            }
        });

    } catch (error) {
        console.error('Audit Log Error:', error);
        res.status(500).json({ error: 'Failed to fetch audit log' });
    }
});

/**
 * GET /api/admin/moderation/actions/:id
 * Detail view for Moderation Audit Panel (Enterprise Grade)
 * Invariants: Read-Only, SSOT, Auditable
 */
router.get('/actions/:id', verifyAdminToken, async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Fetch Immutable Audit Record
        const { data: action, error } = await supabaseAdmin
            .from('moderation_actions')
            .select(`
                *,
                admin_users:actor_id ( id, email, alias, role )
            `)
            .eq('id', id)
            .single();

        if (error || !action) {
            return res.status(404).json({ error: 'Audit record not found' });
        }

        // 2. Resolve Actor Authority (System vs Human)
        // Since we sync Root Admin identity to DB on login, we can trust the JOIN.
        const dbUser = action.admin_users;

        // If DB has the user, trust DB. Otherwise fallback to System.

        const actor = {
            id: action.actor_id,
            type: dbUser ? 'ADMIN' : 'SYSTEM',
            display_name: dbUser ? (dbUser.alias || 'Administrator') : 'SafeSpot Core',
            email: req.adminUser.role === 'admin' ? (dbUser?.email) : undefined,
            role: dbUser ? dbUser.role : 'system'
        };

        // 3. Resolve Severity (Backend Logic - Semánticamente unificado)
        const getSeverity = (type) => {
            switch (type) {
                case 'ADMIN_BAN': return 'CRITICAL';
                case 'SYSTEM_SHADOW_BAN': return 'HIGH';
                case 'ADMIN_HIDE': return 'HIGH';
                case 'AUTO_HIDE_THRESHOLD': return 'MEDIUM';
                case 'ADMIN_RESTORE': return 'INFO';
                case 'ADMIN_DISMISS_FLAGS': return 'INFO';
                default: return 'LOW';
            }
        };

        // 4. Resolve Target Current Status (If exists)
        let currentTarget = null;
        try {
            const table = action.target_type === 'report' ? 'reports'
                : action.target_type === 'comment' ? 'comments'
                    : action.target_type === 'user' ? 'anonymous_users' // or auth.users if accessible
                        : null;

            if (table) {
                const { data: target } = await supabaseAdmin
                    .from(table)
                    .select('*') // Select minimal fields ideally
                    .eq('id', action.target_id)
                    .single();
                currentTarget = target;
            }
        } catch (e) {
            console.warn('Failed to fetch current target status', e);
        }

        // 5. Construct Response (Strict Contract)
        const response = {
            meta: {
                timestamp: new Date().toISOString(),
                request_id: req.headers['x-request-id'] || 'unknown'
            },
            data: {
                id: action.id,
                created_at: action.created_at,
                action: {
                    type: action.action_type,
                    severity: getSeverity(action.action_type),
                    description: `Action ${action.action_type} on ${action.target_type}`
                },
                actor,
                target: {
                    type: action.target_type,
                    id: action.target_id,
                    current_status: currentTarget ? (currentTarget.status || (currentTarget.is_hidden ? 'HIDDEN' : 'ACTIVE')) : 'UNKNOWN/DELETED',
                    snapshot: action.snapshot // Raw snapshot for audit
                },
                justification: {
                    reason_public: action.reason,
                    internal_note: req.adminUser.role === 'admin' || req.adminUser.role === 'staff' ? action.internal_note : undefined
                }
            }
        };

        res.json(response);

    } catch (error) {
        console.error('Audit Detail Error:', error);
        res.status(500).json({ error: 'Failed to fetch audit detail' });
    }
});

export default router;
