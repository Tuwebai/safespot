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
  console.log(`[BACKEND] GET /api/gamification/summary - ${req.anonymousId}`);
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

    const clientToUse = supabaseAdmin || supabase;

    // CRITICAL: Execute all queries in parallel for maximum performance
    const [
      userResult,
      allBadgesResult,
      obtainedBadgesResult,
      reportsResult,
      commentsResult,
      reportFlagsResult,
      commentFlagsResult
    ] = await Promise.all([
      // Get user stats
      queryWithRLS(
        anonymousId,
        `SELECT 
          total_reports,
          total_comments,
          total_votes,
          points,
          level
        FROM anonymous_users
        WHERE anonymous_id = $1`,
        [anonymousId]
      ),
      // Get all badges (public catalog)
      clientToUse
        .from('badges')
        .select('id, code, name, description, icon, category, points')
        .order('category', { ascending: true })
        .order('code', { ascending: true }),
      // Get user's obtained badges
      clientToUse
        .from('user_badges')
        .select('badge_id, obtained_at')
        .eq('anonymous_id', anonymousId),
      // Get user's reports
      clientToUse
        .from('reports')
        .select('id, upvotes_count, comments_count, created_at')
        .eq('anonymous_id', anonymousId),
      // Get user's comments
      clientToUse
        .from('comments')
        .select('id, upvotes_count, created_at')
        .eq('anonymous_id', anonymousId),
      // Get report flags count
      clientToUse
        .from('report_flags')
        .select('*', { count: 'exact', head: true })
        .eq('anonymous_id', anonymousId)
        .is('resolved_at', null),
      // Get comment flags count
      clientToUse
        .from('comment_flags')
        .select('*', { count: 'exact', head: true })
        .eq('anonymous_id', anonymousId)
        .is('resolved_at', null)
    ]);

    // Handle errors
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    if (allBadgesResult.error) {
      logError(allBadgesResult.error, req);
      return res.status(500).json({
        error: 'Failed to fetch badges'
      });
    }

    const userStatsRow = userResult.rows[0];

    // CRITICAL: Sync user points if they don't match obtained badges
    // This ensures points are correct, especially for users who obtained badges
    // before the points system was implemented
    const currentPoints = userStatsRow.points || 0;
    let syncedPoints = currentPoints;
    let syncedLevel = userStatsRow.level || 1;

    try {
      const syncResult = await syncUserPointsIfNeeded(anonymousId, currentPoints);
      if (syncResult) {
        syncedPoints = syncResult.points;
        syncedLevel = syncResult.level;
        logSuccess('Points synced in summary endpoint', { anonymousId, points: syncedPoints, level: syncedLevel });
      } else {
        // Points are correct, but ensure level is correct
        syncedLevel = calculateLevelFromPoints(syncedPoints);
        const currentLevel = userStatsRow.level || 1;
        if (currentLevel !== syncedLevel) {
          try {
            await queryWithRLS(
              anonymousId,
              `UPDATE anonymous_users SET level = $1 WHERE anonymous_id = $2`,
              [syncedLevel, anonymousId]
            );
            logSuccess('Level corrected', { anonymousId, oldLevel: currentLevel, newLevel: syncedLevel });
          } catch (error) {
            logError(error, req);
          }
        }
      }
    } catch (error) {
      logError(error, req);
      // Continue with current values if sync fails
    }

    const userStats = {
      ...userStatsRow,
      level: syncedLevel,
      points: syncedPoints
    };
    const allBadges = allBadgesResult.data || [];
    const obtainedBadges = obtainedBadgesResult.data || [];
    const reports = reportsResult.data || [];
    const comments = commentsResult.data || [];
    const reportFlagsCount = reportFlagsResult.count || 0;
    const commentFlagsCount = commentFlagsResult.count || 0;

    // Calculate stats
    const obtainedBadgeIds = new Set(obtainedBadges.map(b => b.badge_id));
    const obtainedBadgesMap = new Map(obtainedBadges.map(b => [b.badge_id, b.obtained_at]));

    const totalLikesReceived = reports.reduce((sum, r) => sum + (r.upvotes_count || 0), 0) +
      comments.reduce((sum, c) => sum + (c.upvotes_count || 0), 0);

    const uniqueDays = new Set();
    [...reports, ...comments].forEach(item => {
      if (item.created_at) uniqueDays.add(new Date(item.created_at).toISOString().split('T')[0]);
    });

    const totalFlags = reportFlagsCount + commentFlagsCount;
    const hasVerifiedReport = reports.some(r =>
      (r.upvotes_count || 0) + (r.comments_count || 0) >= 5
    );

    const stats = {
      reports_created: userStats.total_reports || 0,
      comments_created: userStats.total_comments || 0,
      likes_received: totalLikesReceived,
      activity_days: uniqueDays.size,
      has_verified_report: hasVerifiedReport ? 1 : 0,
      is_good_citizen: (totalFlags === 0 && (userStats.total_reports > 0 || userStats.total_comments > 0)) ? 1 : 0
    };

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

    // CRITICAL: Evaluate badges only if needed (lightweight check)
    const previouslyObtainedBadgeIds = new Set(obtainedBadgeIds);
    let newlyAwardedBadges = [];

    try {
      const { evaluateBadges } = await import('../utils/badgeEvaluation.js');
      await evaluateBadges(anonymousId);

      // Re-fetch obtained badges and user stats after evaluation
      const [updatedBadgesResult, updatedUserResult] = await Promise.all([
        clientToUse
          .from('user_badges')
          .select('badge_id, obtained_at')
          .eq('anonymous_id', anonymousId),
        queryWithRLS(
          anonymousId,
          `SELECT points, level FROM anonymous_users WHERE anonymous_id = $1`,
          [anonymousId]
        )
      ]);

      const updatedObtainedBadges = updatedBadgesResult.data;
      if (updatedObtainedBadges) {
        obtainedBadgeIds.clear();
        obtainedBadgesMap.clear();
        updatedObtainedBadges.forEach(b => {
          obtainedBadgeIds.add(b.badge_id);
          obtainedBadgesMap.set(b.badge_id, b.obtained_at);

          if (!previouslyObtainedBadgeIds.has(b.badge_id)) {
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

      // Update user stats if points/level changed
      if (updatedUserResult.rows.length > 0) {
        const updatedPoints = updatedUserResult.rows[0].points || 0;
        const updatedLevel = calculateLevelFromPoints(updatedPoints);
        userStats.points = updatedPoints;
        userStats.level = updatedLevel;
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
        progress: {
          current,
          required
        }
      };
    });

    // Build profile data - use corrected level and points
    const finalPoints = userStats.points || 0;
    const finalLevel = calculateLevelFromPoints(finalPoints);
    const profile = {
      level: finalLevel,
      points: finalPoints,
      total_reports: userStats.total_reports || 0,
      total_comments: userStats.total_comments || 0,
      total_votes: userStats.total_votes || 0
    };

    logSuccess('Gamification summary fetched', {
      anonymousId,
      totalBadges: badgesWithProgress.length,
      obtainedCount: obtainedBadgeIds.size,
      newlyAwarded: newlyAwardedBadges.length
    });

    res.json({
      success: true,
      profile,
      badges: badgesWithProgress,
      newBadges: newlyAwardedBadges
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({
      error: 'Failed to fetch gamification summary'
    });
  }
});

/**
 * POST /api/gamification/evaluate
 * Evaluate if user should receive any badges based on current stats
 * Requires: X-Anonymous-Id header
 * Called automatically when user creates report, comment, or receives like
 */
router.post('/evaluate', requireAnonymousId, async (req, res) => {
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

    // Get user stats
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

    // Get user's reports and comments
    const clientToUse = supabaseAdmin || supabase;
    const { data: reports } = await clientToUse
      .from('reports')
      .select('id, upvotes_count, comments_count, created_at')
      .eq('anonymous_id', anonymousId);

    const { data: comments } = await clientToUse
      .from('comments')
      .select('id, upvotes_count, created_at')
      .eq('anonymous_id', anonymousId);

    // Calculate stats
    const totalLikesReceived = (reports || []).reduce((sum, r) => sum + (r.upvotes_count || 0), 0) +
      (comments || []).reduce((sum, c) => sum + (c.upvotes_count || 0), 0);

    const uniqueDays = new Set();
    [...(reports || []), ...(comments || [])].forEach(item => {
      if (item.created_at) uniqueDays.add(new Date(item.created_at).toISOString().split('T')[0]);
    });

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

    const stats = {
      reports_created: userStats.total_reports || 0,
      comments_created: userStats.total_comments || 0,
      likes_received: totalLikesReceived,
      activity_days: uniqueDays.size,
      has_verified_report: hasVerifiedReport ? 1 : 0,
      is_good_citizen: (totalFlags === 0 && (userStats.total_reports > 0 || userStats.total_comments > 0)) ? 1 : 0
    };

    // Get all badges and user's obtained badges
    const { data: allBadges } = await clientToUse
      .from('badges')
      .select('id, code, points');

    const { data: obtainedBadges } = await clientToUse
      .from('user_badges')
      .select('badge_id')
      .eq('anonymous_id', anonymousId);

    const obtainedBadgeIds = new Set((obtainedBadges || []).map(b => b.badge_id));

    // Badge rules
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

    // Get current user points
    const userPointsResult = await queryWithRLS(
      anonymousId,
      `SELECT points, level FROM anonymous_users WHERE anonymous_id = $1`,
      [anonymousId]
    );

    let currentPoints = 0;
    if (userPointsResult.rows.length > 0) {
      currentPoints = userPointsResult.rows[0].points || 0;
    }

    // Evaluate and award badges
    const newlyAwarded = [];
    let totalPointsToAdd = 0;

    for (const badge of (allBadges || [])) {
      const rule = badgeRules[badge.code];
      if (!rule) continue;

      const current = stats[rule.target] || 0;
      const required = rule.threshold;

      // Check if badge should be awarded
      if (current >= required && !obtainedBadgeIds.has(badge.id)) {
        // Award badge
        const { error: insertError } = await clientToUse
          .from('user_badges')
          .insert({
            anonymous_id: anonymousId,
            badge_id: badge.id,
            obtained_at: new Date().toISOString()
          });

        if (!insertError) {
          obtainedBadgeIds.add(badge.id);
          newlyAwarded.push(badge.code);

          // Add points from this badge
          const badgePoints = badge.points || 0;
          totalPointsToAdd += badgePoints;

          logSuccess('Badge awarded', {
            anonymousId,
            badgeCode: badge.code,
            points: badgePoints
          });
        } else {
          logError(insertError, req);
        }
      }
    }

    // If any badges were awarded, update user's points and level
    if (totalPointsToAdd > 0) {
      const newPoints = currentPoints + totalPointsToAdd;
      const newLevel = calculateLevelFromPoints(newPoints);

      try {
        await queryWithRLS(
          anonymousId,
          `UPDATE anonymous_users 
           SET points = $1, level = $2 
           WHERE anonymous_id = $3`,
          [newPoints, newLevel, anonymousId]
        );

        logSuccess('User points and level updated', {
          anonymousId,
          pointsAdded: totalPointsToAdd,
          newPoints,
          newLevel
        });
      } catch (updateError) {
        logError(updateError, req);
      }
    }

    res.json({
      success: true,
      newly_awarded: newlyAwarded,
      count: newlyAwarded.length,
      points_added: totalPointsToAdd
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({
      error: 'Failed to evaluate badges'
    });
  }
});

export default router;

