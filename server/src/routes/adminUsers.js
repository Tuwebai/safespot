import express from 'express';
import { supabaseAdmin } from '../utils/db.js';
import { verifyAdminToken } from '../utils/adminMiddleware.js';
import { realtimeEvents } from '../utils/eventEmitter.js';

const router = express.Router();

/**
 * GET /api/admin/users
 * List users with pagination and search
 * Query: page, limit, search (alias/id)
 */
router.get('/', verifyAdminToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const search = req.query.search || '';
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        let query = supabaseAdmin
            .from('anonymous_users')
            .select(`
        anonymous_id,
        alias,
        avatar_url,
        created_at,
        last_active_at,
        total_reports,
        total_comments,
        level,
        points,
        anonymous_trust_scores (
            trust_score,
            moderation_status
        )
      `, { count: 'exact' });

        if (search) {
            // Search by alias or anonymous_id
            // Validating if search is UUID to decide strict eq or ilike
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(search);
            if (isUUID) {
                query = query.eq('anonymous_id', search);
            } else {
                query = query.ilike('alias', `%${search}%`);
            }
        }

        // Order by last active by default
        query = query.order('last_active_at', { ascending: false }).range(from, to);

        const { data, error, count } = await query;

        if (error) {
            console.error('Error fetching admin users:', error);
            throw error;
        }

        // Flatten logic for trust score
        const users = data.map(user => {
            const trustData = user.anonymous_trust_scores;
            // Handle array or object response from join (usually array for 1:M, or object/null for 1:1 if configured)
            // With Supabase, 1:1 returns object if 'single' not specified? Actually it usually returns an array.
            // Let's assume array or object.
            const trustRecord = Array.isArray(trustData) ? trustData[0] : trustData;

            return {
                ...user,
                trust_score: trustRecord ? trustRecord.trust_score : 50,
                status: trustRecord ? trustRecord.moderation_status : 'active',
                // remove nested object
                anonymous_trust_scores: undefined
            };
        });

        res.json({
            users,
            meta: {
                page,
                limit,
                total: count,
                totalPages: Math.ceil(count / limit)
            }
        });

    } catch (error) {
        console.error('Admin Users List Error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

/**
 * POST /api/admin/users/:id/ban
 * Ban or Unban a user
 * Body: { ban: boolean, reason: string }
 */
router.post('/:id/ban', verifyAdminToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { ban, reason } = req.body; // ban = true (Ban), false (Unban)

        if (!id) return res.status(400).json({ error: 'Missing user ID' });

        // Upsert into anonymous_trust_scores
        // We need to preserve the trust_score if it exists, or set default.
        // First fetch existing
        const { data: existing, error: fetchError } = await supabaseAdmin
            .from('anonymous_trust_scores')
            .select('trust_score')
            .eq('anonymous_id', id)
            .single();

        // If not found, it might be null, so default to 50
        const currentScore = existing ? existing.trust_score : 50;

        const newStatus = ban ? 'banned' : 'active';
        // If banning, maybe drop score to 0? Or keep it? keeping it allows "soft" bans or history.
        // But implementation plan said: "Toggle is_banned status".
        // Let's just set status.

        const { data: updated, error: upsertError } = await supabaseAdmin
            .from('anonymous_trust_scores')
            .upsert({
                anonymous_id: id,
                trust_score: currentScore, // Preserve score
                moderation_status: newStatus,
                last_updated: new Date().toISOString()
            })
            .select()
            .single();

        if (upsertError) {
            console.error('Error banning user:', upsertError);
            throw upsertError;
        }

        // Emit Real-time Event
        realtimeEvents.emitUserBan(id, {
            status: newStatus,
            reason: reason || (ban ? 'Violación de términos' : 'Apelación aceptada')
        });

        res.json({ success: true, user: updated });

    } catch (error) {
        console.error('Admin Ban Error:', error);
        res.status(500).json({ error: 'Failed to update user status' });
    }
});

export default router;
