/**
 * Helper function to evaluate and award badges
 * Called after user actions (create report, comment, receive like)
 * This is async and non-blocking - errors are logged but don't fail the main request
 */

import { logError, logSuccess } from './logger.js';
import { ensureAnonymousUser } from './anonymousUser.js';
import { queryWithRLS } from './rls.js';
import supabase, { supabaseAdmin } from '../config/supabase.js';

/**
 * Evaluate badges for a user (non-blocking)
 * Extracted from gamification router to be reusable
 * @param {string} anonymousId - The anonymous user ID
 */
export async function evaluateBadges(anonymousId) {
  if (!anonymousId) {
    return;
  }

  try {
    // Ensure user exists
    await ensureAnonymousUser(anonymousId);

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
      return;
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
      .select('id, code');

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

    // Evaluate and award badges
    const newlyAwarded = [];
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
          logSuccess('Badge awarded', { anonymousId, badgeCode: badge.code });
        } else {
          logError(insertError, null);
        }
      }
    }

    if (newlyAwarded.length > 0) {
      logSuccess('Badges evaluated', { anonymousId, newlyAwarded });
    }
  } catch (error) {
    logError(error, null);
    // Don't throw - this is non-blocking
  }
}
