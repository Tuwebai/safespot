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
router.get('/all', async (req, res) => {
  try {
    // Use admin client to bypass RLS (badges are public catalog)
    const clientToUse = supabaseAdmin || supabase;
    const { data: badges, error } = await clientToUse
      .from('badges')
      .select('code, name, description, icon, category')
      .order('category', { ascending: true })
      .order('code', { ascending: true });

    if (error) {
      logError(error, req);
      return res.status(500).json({
        error: 'Failed to fetch badges',
        message: error.message
      });
    }

    logSuccess('Badges catalog fetched', { count: badges?.length || 0 });

    res.json({
      success: true,
      data: badges || []
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({
      error: 'Failed to fetch badges'
    });
  }
});

/**
 * GET /api/badges/progress
 * Get user's badge progress (earned badges + progress towards next badges)
 * Requires: X-Anonymous-Id header
 */
router.get('/progress', requireAnonymousId, async (req, res) => {
  try {
    const anonymousId = req.anonymousId;

    // Validate anonymousId
    if (!anonymousId || typeof anonymousId !== 'string' || anonymousId.trim() === '') {
      return res.status(400).json({
        error: 'Invalid anonymous ID',
        message: 'Anonymous ID is required and must be a valid string'
      });
    }

    // Ensure user exists
    try {
      await ensureAnonymousUser(anonymousId);
    } catch (error) {
      logError(error, req);
      return res.status(500).json({
        error: 'Failed to ensure anonymous user',
        message: error.message
      });
    }

    // Get all badges - Use admin client to bypass RLS (badges are public catalog)
    const clientToUse = supabaseAdmin || supabase;
    const { data: allBadges, error: badgesError } = await clientToUse
      .from('badges')
      .select('code, name, description, icon, category')
      .order('category', { ascending: true })
      .order('code', { ascending: true });

    if (badgesError) {
      logError(badgesError, req);
      return res.status(500).json({
        error: 'Failed to fetch badges',
        message: badgesError.message
      });
    }

    // CRITICAL: If no badges exist, this indicates migration not run
    // Still return empty array so frontend can show appropriate message
    if (!allBadges || allBadges.length === 0) {
      logError(new Error('No badges found in database - migration_add_gamification_badges.sql may not have run'), req);
      return res.json({
        success: true,
        data: {
          badges: [],
          earned_count: 0,
          total_count: 0
        }
      });
    }

    // Get user's earned badges
    const { data: earnedBadges, error: earnedError } = await supabase
      .from('user_badges')
      .select('badge_code, awarded_at')
      .eq('anonymous_id', anonymousId);

    if (earnedError) {
      logError(earnedError, req);
      return res.status(500).json({
        error: 'Failed to fetch earned badges',
        message: earnedError.message
      });
    }

    const earnedCodes = new Set((earnedBadges || []).map(b => b.badge_code));
    const earnedBadgesMap = new Map((earnedBadges || []).map(b => [b.badge_code, b.awarded_at]));

    // Get user stats for progress calculation
    const userResult = await queryWithRLS(
      anonymousId,
      `SELECT 
        total_reports,
        total_comments,
        total_votes
      FROM anonymous_users
      WHERE anonymous_id = $1`,
      [anonymousId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const userStats = userResult.rows[0];

    // Get user's reports and comments for additional stats
    const { data: reports } = await supabase
      .from('reports')
      .select('id, upvotes_count, comments_count, created_at')
      .eq('anonymous_id', anonymousId);

    const { data: comments } = await supabase
      .from('comments')
      .select('id, upvotes_count, created_at')
      .eq('anonymous_id', anonymousId);

    // Calculate additional stats
    const totalLikesReceived = (reports || []).reduce((sum, r) => sum + (r.upvotes_count || 0), 0) +
      (comments || []).reduce((sum, c) => sum + (c.upvotes_count || 0), 0);

    // Activity days
    const uniqueDays = new Set();
    [...(reports || []), ...(comments || [])].forEach(item => {
      if (item.created_at) uniqueDays.add(new Date(item.created_at).toISOString().split('T')[0]);
    });

    // Flags check
    const { count: reportFlagsCount } = await supabase
      .from('report_flags')
      .select('*', { count: 'exact', head: true })
      .eq('anonymous_id', anonymousId)
      .is('resolved_at', null);

    const { count: commentFlagsCount } = await supabase
      .from('comment_flags')
      .select('*', { count: 'exact', head: true })
      .eq('anonymous_id', anonymousId)
      .is('resolved_at', null);

    const totalFlags = (reportFlagsCount || 0) + (commentFlagsCount || 0);
    const hasVerifiedReport = (reports || []).some(r =>
      (r.upvotes_count || 0) + (r.comments_count || 0) >= 5
    );

    // Badge rules mapping
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

    const stats = {
      reports_created: userStats.total_reports || 0,
      comments_created: userStats.total_comments || 0,
      likes_received: totalLikesReceived,
      activity_days: uniqueDays.size,
      has_verified_report: hasVerifiedReport ? 1 : 0,
      is_good_citizen: (totalFlags === 0 && (userStats.total_reports > 0 || userStats.total_comments > 0)) ? 1 : 0
    };

    // Build badges with progress
    // NOTE: allBadges is guaranteed to have items at this point (checked earlier)
    const badgesWithProgress = allBadges.map(badge => {
      const isEarned = earnedCodes.has(badge.code);
      const rule = badgeRules[badge.code];

      let current = 0;
      let required = 0;
      let progress = 0;
      let progressText = '';

      if (rule) {
        current = stats[rule.target] || 0;
        required = rule.threshold;
        progress = Math.min(1, Math.max(0, current / required));

        const remaining = Math.max(0, required - current);

        if (isEarned) {
          progressText = '¡Obtuviste esta insignia!';
        } else if (current >= required) {
          progressText = '¡Listo para desbloquear!';
        } else {
          // Generate motivational text based on badge type
          if (badge.code === 'FIRST_REPORT') {
            progressText = remaining === 1
              ? '¡Crea tu primer reporte para obtener esta insignia!'
              : `Te falta ${remaining} reporte para obtener esta insignia`;
          } else if (badge.code === 'ACTIVE_VOICE') {
            progressText = `Te faltan ${remaining} reportes para obtener esta insignia`;
          } else if (badge.code === 'FIRST_COMMENT') {
            progressText = remaining === 1
              ? '¡Crea tu primer comentario para obtener esta insignia!'
              : `Te falta ${remaining} comentario para obtener esta insignia`;
          } else if (badge.code === 'PARTICIPATIVE') {
            progressText = `Te faltan ${remaining} comentarios para obtener esta insignia`;
          } else if (badge.code === 'FIRST_LIKE_RECEIVED') {
            progressText = '¡Recibe tu primer like para obtener esta insignia!';
          } else if (badge.code === 'VALUABLE_CONTRIBUTION') {
            progressText = `Te faltan ${remaining} likes recibidos para obtener esta insignia`;
          } else if (badge.code === 'RECURRING_USER') {
            progressText = `Te faltan ${remaining} días de actividad para obtener esta insignia`;
          } else if (badge.code === 'CONSISTENT_USER') {
            progressText = `Te faltan ${remaining} días de actividad para obtener esta insignia`;
          } else if (badge.code === 'VERIFIED_REPORT') {
            progressText = 'Crea un reporte con 5+ interacciones para obtener esta insignia';
          } else if (badge.code === 'GOOD_CITIZEN') {
            progressText = 'Mantén tu cuenta sin flags para obtener esta insignia';
          } else {
            progressText = `Progreso: ${current} / ${required}`;
          }
        }
      }

      return {
        code: badge.code,
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        category: badge.category,
        is_earned: isEarned,
        awarded_at: earnedBadgesMap.get(badge.code) || null,
        progress: {
          current,
          required,
          progress,
          text: progressText
        }
      };
    });

    logSuccess('Badge progress fetched', { anonymousId, earnedCount: earnedCodes.size });

    res.json({
      success: true,
      data: {
        badges: badgesWithProgress,
        earned_count: earnedCodes.size,
        total_count: badgesWithProgress.length
      }
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({
      error: 'Failed to fetch badge progress'
    });
  }
});

export default router;

