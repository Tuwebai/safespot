import express from 'express';
import { supabaseAdmin } from '../utils/db.js';
import { verifyAdminToken } from '../utils/adminMiddleware.js';
import { logError, logSuccess } from '../utils/logger.js';
import { realtimeEvents } from '../utils/eventEmitter.js';

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
        const { action, banUser } = req.body; // action: 'approve' | 'reject' | 'dismiss'

        const table = type === 'reports' || type === 'report' ? 'reports' : 'comments';

        let updateData = {};

        if (action === 'approve') {
            // Unhide and maybe reset flags?
            updateData = { is_hidden: false };
            // Optional: Reset flags count?
            // updateData.flags_count = 0; 
        } else if (action === 'reject') {
            // Soft delete
            updateData = { deleted_at: new Date().toISOString() };
        } else if (action === 'dismiss') {
            // Keep visible but clear flags
            updateData = { flags_count: 0 };
        } else {
            return res.status(400).json({ error: 'Invalid action' });
        }

        const { error } = await supabaseAdmin
            .from(table)
            .update(updateData)
            .eq('id', id);

        if (error) throw error;

        // Optional: Ban User Logic
        if (action === 'reject' && banUser) {
            // Fetch user ID first
            const { data: item } = await supabaseAdmin.from(table).select('anonymous_id').eq('id', id).single();
            if (item && item.anonymous_id) {
                await supabaseAdmin.from('anonymous_trust_scores').upsert({
                    anonymous_id: item.anonymous_id,
                    moderation_status: 'banned',
                    last_updated: new Date().toISOString()
                });

                // Emit ban event
                realtimeEvents.emitUserBan(item.anonymous_id, { status: 'banned', reason: 'Content Rejected in Moderation' });
            }
        }

        // Emit stats update to refresh global counters
        realtimeEvents.emitGlobalUpdate('stats-update', {
            action,
            reportId: id
        });

        res.json({ success: true, message: 'Case resolved' });

    } catch (error) {
        console.error('Moderation Action Error:', error);
        res.status(500).json({ error: 'Failed to resolve moderation case' });
    }
});

export default router;
