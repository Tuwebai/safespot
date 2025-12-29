import express from 'express';
import { requireAnonymousId } from '../utils/validation.js';
import { logError, logSuccess } from '../utils/logger.js';
import { ensureAnonymousUser } from '../utils/anonymousUser.js';
import { queryWithRLS } from '../utils/rls.js';
import supabase, { supabaseAdmin } from '../config/supabase.js';

const router = express.Router();

/**
 * GET /api/badges/all
 * Get all available badges (catalog)
 * No authentication required - public catalog
 */
/**
 * GET /api/badges/all
 * Get all available badges (catalog)
 */
router.get('/all', async (req, res) => {
  console.log('[BADGES] GET /api/badges/all');
  try {
    const clientToUse = supabaseAdmin || supabase;
    const { data: badges, error } = await clientToUse
      .from('badges')
      .select('code, name, description, icon, category, points')
      .order('category', { ascending: true })
      .order('code', { ascending: true });

    if (error) {
      console.error('[BADGES] catalog fetch failed:', error.message);
      return res.json({ success: true, data: [] });
    }

    res.json({
      success: true,
      data: badges || []
    });
  } catch (error) {
    console.error('[BADGES] UNEXPECTED ERROR in /all:', error);
    res.json({ success: true, data: [] });
  }
});

/**
 * GET /api/badges/progress
 * Get user's badge progress
 */
router.get('/progress', requireAnonymousId, async (req, res) => {
  const anonymousId = req.anonymousId;
  console.log(`[BADGES] GET /api/badges/progress - User: ${anonymousId}`);

  try {
    try {
      await ensureAnonymousUser(anonymousId);
    } catch (e) { console.warn('[BADGES] ensureUser failed:', e.message); }

    const clientToUse = supabaseAdmin || supabase;

    // Fetch everything needed in parallel
    const [badgesResult, earnedResult, userResult, reportsResult, commentsResult, reportFlags, commentFlags] = await Promise.all([
      clientToUse.from('badges').select('*').order('category').catch(e => ({ data: [] })),
      supabase.from('user_badges').select('*').eq('anonymous_id', anonymousId).catch(e => ({ data: [] })),
      queryWithRLS(anonymousId, `SELECT * FROM anonymous_users WHERE anonymous_id = $1`, [anonymousId]).catch(e => ({ rows: [] })),
      supabase.from('reports').select('id, upvotes_count, comments_count, created_at').eq('anonymous_id', anonymousId).catch(e => ({ data: [] })),
      supabase.from('comments').select('id, upvotes_count, created_at').eq('anonymous_id', anonymousId).catch(e => ({ data: [] })),
      supabase.from('report_flags').select('id', { count: 'exact', head: true }).eq('anonymous_id', anonymousId).is('resolved_at', null).catch(e => ({ count: 0 })),
      supabase.from('comment_flags').select('id', { count: 'exact', head: true }).eq('anonymous_id', anonymousId).is('resolved_at', null).catch(e => ({ count: 0 }))
    ]);

    const allBadges = badgesResult.data || [];
    const earnedBadges = earnedResult.data || [];
    const userStats = (userResult.rows && userResult.rows.length > 0) ? userResult.rows[0] : { points: 0, level: 1 };
    const reports = reportsResult.data || [];
    const comments = commentsResult.data || [];

    const earnedCodes = new Set(earnedBadges.map(b => b.badge_code));
    const earnedBadgesMap = new Map(earnedBadges.map(b => [b.badge_code, b.awarded_at]));

    const totalLikesReceived = reports.reduce((sum, r) => sum + (r.upvotes_count || 0), 0) +
      comments.reduce((sum, c) => sum + (c.upvotes_count || 0), 0);

    const uniqueDays = new Set();
    [...reports, ...comments].forEach(item => {
      if (item.created_at) uniqueDays.add(new Date(item.created_at).toISOString().split('T')[0]);
    });

    const totalFlags = (reportFlags.count || 0) + (commentFlags.count || 0);
    const hasVerifiedReport = reports.some(r => (r.upvotes_count || 0) + (r.comments_count || 0) >= 5);

    const stats = {
      reports_created: userStats.total_reports || 0,
      comments_created: userStats.total_comments || 0,
      likes_received: totalLikesReceived,
      activity_days: uniqueDays.size,
      has_verified_report: hasVerifiedReport ? 1 : 0,
      is_good_citizen: (totalFlags === 0 && (userStats.total_reports > 0 || userStats.total_comments > 0)) ? 1 : 0
    };

    const badgeRules = {
      FIRST_REPORT: { target: 'reports_created', threshold: 1 },
      ACTIVE_VOICE: { target: 'reports_created', threshold: 5 },
      FIRST_COMMENT: { target: 'comments_created', threshold: 1 },
      PARTICIPATIVE: { target: 'comments_created', threshold: 10 },
      FIRST_LIKE_RECEIVED: { target: 'likes_received', threshold: 1 },
      VALUABLE_CONTRIBUTION: { target: 'likes_received', threshold: 5 },
      RECURRING_USER: { target: 'activity_days', threshold: 7 },
      CONSISTENT_USER: { target: 'activity_days', threshold: 30 },
      VERIFIED_REPORT: { target: 'has_verified_report', threshold: 1 },
      GOOD_CITIZEN: { target: 'is_good_citizen', threshold: 1 }
    };

    const badgesWithProgress = allBadges.map(badge => {
      const isEarned = earnedCodes.has(badge.code);
      const rule = badgeRules[badge.code];
      const current = rule ? (stats[rule.target] || 0) : 0;
      const required = rule ? rule.threshold : 0;
      const progress = required > 0 ? Math.min(1, current / required) : 0;

      return {
        code: badge.code,
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        category: badge.category,
        is_earned: isEarned,
        awarded_at: earnedBadgesMap.get(badge.code) || null,
        progress: { current, required, progress, text: isEarned ? '¡Insignia obtenida!' : 'En progreso' }
      };
    });

    res.json({
      success: true,
      data: {
        badges: badgesWithProgress,
        earned_count: earnedCodes.size,
        total_count: badgesWithProgress.length
      }
    });
  } catch (error) {
    console.error('[BADGES] UNEXPECTED ERROR in /progress:', error);
    res.json({
      success: true,
      data: { badges: [], earned_count: 0, total_count: 0 }
    });
  }
});

export default router;

