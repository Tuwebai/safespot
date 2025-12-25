/**
 * Sync User Points Utility
 * 
 * Recalculates user's total points based on their obtained badges
 * This ensures points match badges, especially for users who obtained badges
 * before the points system was implemented
 */

import { logError, logSuccess } from './logger.js';
import { queryWithRLS } from './rls.js';
import { calculateLevelFromPoints } from './levelCalculation.js';
import supabase, { supabaseAdmin } from '../config/supabase.js';

/**
 * Recalculate and sync user points based on obtained badges
 * @param {string} anonymousId - The anonymous user ID
 * @returns {Promise<{points: number, level: number}>} - Updated points and level
 */
export async function syncUserPoints(anonymousId) {
  if (!anonymousId) {
    return null;
  }

  try {
    const clientToUse = supabaseAdmin || supabase;

    // Get all badges obtained by this user
    const { data: userBadges, error: badgesError } = await clientToUse
      .from('user_badges')
      .select('badge_id')
      .eq('anonymous_id', anonymousId);

    if (badgesError) {
      logError(badgesError, null);
      return null;
    }

    if (!userBadges || userBadges.length === 0) {
      // No badges, ensure user has 0 points and level 1
      try {
        await queryWithRLS(
          anonymousId,
          `UPDATE anonymous_users SET points = 0, level = 1 WHERE anonymous_id = $1`,
          [anonymousId]
        );
        return { points: 0, level: 1 };
      } catch (updateError) {
        logError(updateError, null);
        return null;
      }
    }

    // Get points for each badge
    const badgeIds = userBadges.map(ub => ub.badge_id);
    const { data: badges, error: badgeInfoError } = await clientToUse
      .from('badges')
      .select('id, points')
      .in('id', badgeIds);

    if (badgeInfoError) {
      logError(badgeInfoError, null);
      return null;
    }

    // Calculate total points
    const totalPoints = (badges || []).reduce((sum, badge) => {
      return sum + (badge.points || 0);
    }, 0);

    // Calculate level
    const newLevel = calculateLevelFromPoints(totalPoints);

    // Update user's points and level
    try {
      await queryWithRLS(
        anonymousId,
        `UPDATE anonymous_users 
         SET points = $1, level = $2 
         WHERE anonymous_id = $3`,
        [totalPoints, newLevel, anonymousId]
      );

      logSuccess('User points synchronized', {
        anonymousId,
        points: totalPoints,
        level: newLevel,
        badgesCount: userBadges.length
      });

      return { points: totalPoints, level: newLevel };
    } catch (updateError) {
      logError(updateError, null);
      return null;
    }
  } catch (error) {
    logError(error, null);
    return null;
  }
}

/**
 * Sync user points if they don't match obtained badges
 * This is a lightweight check that only syncs if needed
 * @param {string} anonymousId - The anonymous user ID
 * @param {number} currentPoints - Current points value from DB
 * @returns {Promise<{points: number, level: number} | null>} - Updated values if synced, null if no change needed
 */
export async function syncUserPointsIfNeeded(anonymousId, currentPoints) {
  if (!anonymousId) {
    return null;
  }

  try {
    const clientToUse = supabaseAdmin || supabase;

    // Get all badges obtained by this user with their points
    const { data: userBadges, error: badgesError } = await clientToUse
      .from('user_badges')
      .select('badge_id')
      .eq('anonymous_id', anonymousId);

    if (badgesError || !userBadges) {
      return null;
    }

    if (userBadges.length === 0) {
      // No badges, should have 0 points
      if (currentPoints !== 0) {
        return await syncUserPoints(anonymousId);
      }
      return null;
    }

    // Get points for each badge
    const badgeIds = userBadges.map(ub => ub.badge_id);
    const { data: badges, error: badgeInfoError } = await clientToUse
      .from('badges')
      .select('id, points')
      .in('id', badgeIds);

    if (badgeInfoError || !badges) {
      return null;
    }

    // Calculate expected points
    const expectedPoints = badges.reduce((sum, badge) => {
      return sum + (badge.points || 0);
    }, 0);

    // If points don't match, sync them
    if (currentPoints !== expectedPoints) {
      logSuccess('Points mismatch detected, syncing', {
        anonymousId,
        currentPoints,
        expectedPoints,
        badgesCount: userBadges.length
      });
      return await syncUserPoints(anonymousId);
    }

    return null; // No sync needed
  } catch (error) {
    logError(error, null);
    return null;
  }
}

