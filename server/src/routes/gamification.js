import express from 'express';
import { requireAnonymousId } from '../utils/validation.js';
import { logError, logSuccess } from '../utils/logger.js';
import { ensureAnonymousUser } from '../utils/anonymousUser.js';
import { queryWithRLS } from '../utils/rls.js';
import { calculateLevelFromPoints } from '../utils/levelCalculation.js';
import { syncUserPointsIfNeeded } from '../utils/syncUserPoints.js';
import supabase, { supabaseAdmin } from '../config/supabase.js';

const router = express.Router();

/**
 * GET /api/gamification/badges
 * Get all badges with user's progress (obtained + progress towards not obtained)
 * Requires: X-Anonymous-Id header
 * Returns: All badges with obtained status and progress
 */
router.get('/badges', requireAnonymousId, async (req, res) => {
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
        error: 'Failed to ensure anonymous user'
      });
    }

    // Get all badges using admin client (bypass RLS for public catalog)
    const clientToUse = supabaseAdmin || supabase;
    const { data: allBadges, error: badgesError } = await clientToUse
      .from('badges')
      .select('id, code, name, description, icon, category, points')
      .order('category', { ascending: true })
      .order('code', { ascending: true });

    if (badgesError) {
      logError(badgesError, req);
      return res.status(500).json({
        error: 'Failed to fetch badges'
      });
    }

    if (!allBadges || allBadges.length === 0) {
      logError(new Error('No badges found in database'), req);
      return res.json({
        success: true,
        badges: []
      });
    }

    // Get user's obtained badges
    const { data: obtainedBadges, error: obtainedError } = await clientToUse
      .from('user_badges')
      .select('badge_id, obtained_at')
      .eq('anonymous_id', anonymousId);

    if (obtainedError) {
      logError(obtainedError, req);
      return res.status(500).json({
        error: 'Failed to fetch obtained badges'
      });
    }

    const obtainedBadgeIds = new Set((obtainedBadges || []).map(b => b.badge_id));
    const obtainedBadgesMap = new Map((obtainedBadges || []).map(b => [b.badge_id, b.obtained_at]));

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
    const { data: reports } = await clientToUse
      .from('reports')
      .select('id, upvotes_count, comments_count, created_at')
      .eq('anonymous_id', anonymousId);

    const { data: comments } = await clientToUse
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
    const { count: reportFlagsCount } = await clientToUse
      .from('report_flags')
      .select('*', { count: 'exact', head: true })
      .eq('anonymous_id', anonymousId)
      .is('resolved_at', null);

    const { count: commentFlagsCount } = await clientToUse
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

    // CRITICAL: First, evaluate and auto-award any badges that should be obtained
    // This ensures badges are awarded even if the user hasn't triggered the evaluation endpoint
    const { evaluateBadges } = await import('../utils/badgeEvaluation.js');
    const previouslyObtainedBadgeIds = new Set(obtainedBadgeIds); // Store previous state
    let newlyAwardedBadges = [];

    try {
      await evaluateBadges(anonymousId);
      // Re-fetch obtained badges after evaluation
      const adminClient = supabaseAdmin || supabase;
      const { data: updatedObtainedBadges } = await adminClient
        .from('user_badges')
        .select('badge_id, obtained_at')
        .eq('anonymous_id', anonymousId);

      if (updatedObtainedBadges) {
        obtainedBadgeIds.clear();
        obtainedBadgesMap.clear();
        updatedObtainedBadges.forEach(b => {
          obtainedBadgeIds.add(b.badge_id);
          obtainedBadgesMap.set(b.badge_id, b.obtained_at);

          // Detect newly awarded badges (not in previous state)
          if (!previouslyObtainedBadgeIds.has(b.badge_id)) {
            // Find badge info for the newly awarded badge
            const badgeInfo = allBadges.find(badge => badge.id === b.badge_id);
            if (badgeInfo) {
              newlyAwardedBadges.push({
                code: badgeInfo.code,
                name: badgeInfo.name,
                icon: badgeInfo.icon,
                points: badgeInfo.points || 0
              });
            }
          }
        });
      }
    } catch (error) {
      logError(error, req);
      // Continue even if evaluation fails
    }

    // Build badges with progress
    const badgesWithProgress = allBadges.map(badge => {
      const isObtained = obtainedBadgeIds.has(badge.id);
      const rule = badgeRules[badge.code];

      let current = 0;
      let required = 0;

      if (rule) {
        current = stats[rule.target] || 0;
        required = rule.threshold;
      }

      // CRITICAL: If current >= required, badge should be obtained
      // This is a safety check - evaluation above should have already awarded it
      const shouldBeObtained = current >= required && required > 0;

      return {
        id: badge.id,
        code: badge.code,
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        category: badge.category,
        points: badge.points || 0,
        // CRITICAL: Badge is obtained if in DB OR if conditions are met
        obtained: isObtained || shouldBeObtained,
        obtained_at: obtainedBadgesMap.get(badge.id) || (shouldBeObtained && !isObtained ? new Date().toISOString() : null),
        progress: {
          current,
          required
        }
      };
    });

    logSuccess('Gamification badges fetched', {
      anonymousId,
      totalBadges: badgesWithProgress.length,
      obtainedCount: obtainedBadgeIds.size,
      newlyAwarded: newlyAwardedBadges.length
    });

    res.json({
      success: true,
      badges: badgesWithProgress,
      newBadges: newlyAwardedBadges // Only badges newly awarded in this request
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({
      error: 'Failed to fetch gamification badges'
    });
  }
});

/**
 * GET /api/gamification/summary
 * Get complete gamification data in a single request (optimized)
 * Requires: X-Anonymous-Id header
 * Returns: Profile, badges, and progress in one response
 */
router.get('/summary', requireAnonymousId, async (req, res) => {
  const anonymousId = req.anonymousId;
  console.log(`[GAMIFICATION] Request summary for user: ${anonymousId}`);

  try {
    // 1. Ensure user exists (idempotent)
    // We do this first to guarantee there's a record in anonymous_users
    try {
      await ensureAnonymousUser(anonymousId);
    } catch (err) {
      console.error(`[GAMIFICATION] Error ensuring user ${anonymousId}:`, err.message);
      // We continue anyway, parallel queries will handle missing user gracefully
    }

    const clientToUse = supabaseAdmin || supabase;

    // 2. Parallel data fetching with individual error handling
    // We use individual catch for each promise to prevent Promise.all from failing if ONE query fails
    const [
      userResult,
      allBadgesResult,
      obtainedBadgesResult,
      reportsResult,
      commentsResult,
      reportFlagsResult,
      commentFlagsResult
    ] = await Promise.all([
      // User info - Use individual try/catch to return empty if fails
      queryWithRLS(
        anonymousId,
        `SELECT total_reports, total_comments, total_votes, points, level FROM anonymous_users WHERE anonymous_id = $1`,
        [anonymousId]
      ).catch(e => { console.error('[GAMIFICATION] user query failed:', e.message); return { rows: [] }; }),

      // All badges catalog
      clientToUse.from('badges')
        .select('id, code, name, description, icon, category, points')
        .order('category', { ascending: true })
        .order('code', { ascending: true })
        .catch(e => { console.error('[GAMIFICATION] badges catalog failed:', e.message); return { data: [], error: e }; }),

      // Obtained badges
      clientToUse.from('user_badges')
        .select('badge_id, obtained_at')
        .eq('anonymous_id', anonymousId)
        .catch(e => { console.error('[GAMIFICATION] obtained badges failed:', e.message); return { data: [], error: e }; }),

      // User's reports
      clientToUse.from('reports')
        .select('id, upvotes_count, comments_count, created_at')
        .eq('anonymous_id', anonymousId)
        .catch(e => { console.error('[GAMIFICATION] reports query failed:', e.message); return { data: [], error: e }; }),

      // User's comments
      clientToUse.from('comments')
        .select('id, upvotes_count, created_at')
        .eq('anonymous_id', anonymousId)
        .catch(e => { console.error('[GAMIFICATION] comments query failed:', e.message); return { data: [], error: e }; }),

      // Report flags
      clientToUse.from('report_flags')
        .select('*', { count: 'exact', head: true })
        .eq('anonymous_id', anonymousId)
        .is('resolved_at', null)
        .catch(e => { console.error('[GAMIFICATION] report flags failed:', e.message); return { count: 0 }; }),

      // Comment flags
      clientToUse.from('comment_flags')
        .select('*', { count: 'exact', head: true })
        .eq('anonymous_id', anonymousId)
        .is('resolved_at', null)
        .catch(e => { console.error('[GAMIFICATION] comment flags failed:', e.message); return { count: 0 }; })
    ]);

    // 3. Fallback for user row (never return 404/500 if user info is missing)
    const userStatsRow = (userResult && userResult.rows && userResult.rows.length > 0)
      ? userResult.rows[0]
      : { total_reports: 0, total_comments: 0, total_votes: 0, points: 0, level: 1 };

    // 4. Points & Level Sync (Defensive)
    let syncedPoints = userStatsRow.points || 0;
    let syncedLevel = userStatsRow.level || 1;

    try {
      const syncResult = await syncUserPointsIfNeeded(anonymousId, syncedPoints);
      if (syncResult) {
        syncedPoints = syncResult.points;
        syncedLevel = syncResult.level;
      } else {
        syncedLevel = calculateLevelFromPoints(syncedPoints);
      }
    } catch (syncErr) {
      console.warn('[GAMIFICATION] Sync failed, using current values:', syncErr.message);
    }

    // 5. Build stats object from fetched data
    const allBadges = allBadgesResult.data || [];
    const obtainedBadges = obtainedBadgesResult.data || [];
    const reports = reportsResult.data || [];
    const comments = commentsResult.data || [];
    const reportFlagsCount = reportFlagsResult.count || 0;
    const commentFlagsCount = commentFlagsResult.count || 0;

    const obtainedBadgeIds = new Set(obtainedBadges.map(b => b.badge_id));
    const obtainedBadgesMap = new Map(obtainedBadges.map(b => [b.badge_id, b.obtained_at]));

    const totalLikesReceived = reports.reduce((sum, r) => sum + (r.upvotes_count || 0), 0) +
      comments.reduce((sum, c) => sum + (c.upvotes_count || 0), 0);

    const uniqueDays = new Set();
    [...reports, ...comments].forEach(item => {
      if (item.created_at) uniqueDays.add(new Date(item.created_at).toISOString().split('T')[0]);
    });

    const totalFlags = reportFlagsCount + commentFlagsCount;
    const hasVerifiedReport = reports.some(r => (r.upvotes_count || 0) + (r.comments_count || 0) >= 5);

    const stats = {
      reports_created: userStatsRow.total_reports || 0,
      comments_created: userStatsRow.total_comments || 0,
      likes_received: totalLikesReceived,
      activity_days: uniqueDays.size,
      has_verified_report: hasVerifiedReport ? 1 : 0,
      is_good_citizen: (totalFlags === 0 && (userStatsRow.total_reports > 0 || userStatsRow.total_comments > 0)) ? 1 : 0
    };

    // 6. Badge rules mapping
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

    // 7. Auto-evaluate badges (Async/Safe)
    let newlyAwardedBadges = [];
    try {
      const { evaluateBadges } = await import('../utils/badgeEvaluation.js');
      await evaluateBadges(anonymousId);

      // We don't re-fetch here to keep it fast. 
      // User will see changes on next refresh or badgesWithProgress logic will catch them.
    } catch (evalErr) {
      console.warn('[GAMIFICATION] Evaluation error:', evalErr.message);
    }

    // 8. Build final badge list with progress
    const badgesWithProgress = allBadges.map(badge => {
      const isObtained = obtainedBadgeIds.has(badge.id);
      const rule = badgeRules[badge.code];
      const current = rule ? (stats[rule.target] || 0) : 0;
      const required = rule ? rule.threshold : 0;
      const shouldBeObtained = current >= required && required > 0;

      return {
        id: badge.id,
        code: badge.code,
        name: badge.name,
        description: badge.description,
        icon: badge.icon,
        category: badge.category,
        points: badge.points || 0,
        obtained: isObtained || shouldBeObtained,
        obtained_at: obtainedBadgesMap.get(badge.id) || (shouldBeObtained && !isObtained ? new Date().toISOString() : null),
        progress: { current, required }
      };
    });

    // 9. Final response
    console.log(`[GAMIFICATION] Summary success for ${anonymousId}`);
    res.json({
      success: true,
      profile: {
        level: syncedLevel,
        points: syncedPoints,
        total_reports: userStatsRow.total_reports || 0,
        total_comments: userStatsRow.total_comments || 0,
        total_votes: userStatsRow.total_votes || 0
      },
      badges: badgesWithProgress,
      newBadges: [] // Newly awarded detection skipped for performance in summary
    });

  } catch (error) {
    console.error('[GAMIFICATION] CRITICAL ENDPOINT ERROR (Fallback applied):', error);

    // PRODUCTION HARDENING: Never return 500 if we can return a safe default.
    // This prevents the Home page and Gamification page from breaking.
    res.json({
      success: true,
      profile: {
        level: 1,
        points: 0,
        total_reports: 0,
        total_comments: 0,
        total_votes: 0
      },
      badges: [],
      newBadges: [],
      warning: 'No pudimos cargar tus estadísticas reales, mostrando valores por defecto.'
    });
  }
});

/**
 * POST /api/gamification/evaluate
 * Evaluate if user should receive any badges
 */
router.post('/evaluate', requireAnonymousId, async (req, res) => {
  const anonymousId = req.anonymousId;
  console.log(`[GAMIFICATION] POST /api/gamification/evaluate - User: ${anonymousId}`);
  try {
    const { evaluateBadges } = await import('../utils/badgeEvaluation.js');
    const result = await evaluateBadges(anonymousId);

    res.json({
      success: true,
      newly_awarded: result?.newlyAwarded || [],
      count: result?.newlyAwarded?.length || 0,
      points_added: result?.totalPointsAdded || 0
    });
  } catch (error) {
    console.error('[GAMIFICATION] Evaluation failed:', error.message);
    res.json({
      success: true, // Return success true even on fail to not break UI
      newly_awarded: [],
      count: 0,
      points_added: 0
    });
  }
});

export default router;
