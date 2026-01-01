import { queryWithRLS } from './rls.js';
import { logError, logSuccess } from './logger.js';
import { calculateLevelFromPoints } from './levelCalculation.js';
import supabase, { supabaseAdmin } from '../config/supabase.js';

/**
 * GAMIFICATION CORE - Single Source of Truth
 */

/**
 * Calculate all metrics for a user in real-time (Strict action-based)
 * Highly optimized for scalability using server-side SQL aggregations.
 * @param {string} anonymousId 
 */
export async function calculateUserMetrics(anonymousId) {
    try {
        // We use a single SQL query with CTEs to calculate everything in one trip
        const result = await queryWithRLS(anonymousId, `
            WITH 
                counts AS (
                    SELECT 
                        (SELECT COUNT(*) FROM reports WHERE anonymous_id = $1) as reports_created,
                        (SELECT COUNT(*) FROM comments WHERE anonymous_id = $1) as comments_created,
                        (SELECT COUNT(*) FROM votes WHERE anonymous_id = $1) as votes_cast,
                        (SELECT COUNT(*) FROM report_flags WHERE anonymous_id = $1 AND resolved_at IS NULL) as r_flags,
                        (SELECT COUNT(*) FROM comment_flags WHERE anonymous_id = $1 AND resolved_at IS NULL) as c_flags
                ),
                likes AS (
                    SELECT 
                        COALESCE((SELECT SUM(upvotes_count) FROM reports WHERE anonymous_id = $1), 0) +
                        COALESCE((SELECT SUM(upvotes_count) FROM comments WHERE anonymous_id = $1), 0) as likes_received
                ),
                activity AS (
                    -- Calculate unique days of contribution (reports or comments)
                    SELECT COUNT(DISTINCT created_at::date) as activity_days
                    FROM (
                        SELECT created_at FROM reports WHERE anonymous_id = $1
                        UNION ALL
                        SELECT created_at FROM comments WHERE anonymous_id = $1
                    ) combined_activity
                ),
                verified AS (
                    -- Check if user has at least one report with significant engagement
                    SELECT EXISTS (
                        SELECT 1 FROM reports 
                        WHERE anonymous_id = $1 
                        AND (upvotes_count + comments_count) >= 5
                    ) as has_verified_report
                )
            SELECT 
                c.*, 
                l.likes_received, 
                a.activity_days, 
                v.has_verified_report
            FROM counts c, likes l, activity a, verified v;
        `, [anonymousId]);

        if (result.rows.length === 0) return null;

        const row = result.rows[0];
        const totalFlags = (parseInt(row.r_flags) || 0) + (parseInt(row.c_flags) || 0);

        return {
            reports_created: parseInt(row.reports_created) || 0,
            comments_created: parseInt(row.comments_created) || 0,
            votes_cast: parseInt(row.votes_cast) || 0,
            likes_received: parseInt(row.likes_received) || 0,
            activity_days: parseInt(row.activity_days) || 0,
            has_verified_report: row.has_verified_report ? 1 : 0,
            is_good_citizen: (totalFlags === 0 && (row.reports_created > 0 || row.comments_created > 0)) ? 1 : 0
        };
    } catch (error) {
        logError(error, { context: 'calculateUserMetrics.sql', anonymousId });
        throw error;
    }
}

/**
 * SOURCE OF TRUTH: Synchronize and calculate user's gamification state.
 * Enforces strict consistency between progress, badges, and points.
 * @param {string} anonymousId 
 */
export async function calculateUserGamification(anonymousId) {
    if (!anonymousId) return null;

    try {
        const clientToUse = supabaseAdmin || supabase;

        // 1. Get all badge rules from database
        const { data: allBadges } = await clientToUse
            .from('badges')
            .select('id, code, points, target_metric, threshold, name, icon, description, category')
            .order('category', { ascending: true });

        if (!allBadges) throw new Error('Could not fetch badges catalog');

        // 2. Calculate REAL-TIME metrics from user actions
        const metrics = await calculateUserMetrics(anonymousId);

        // 3. Get currently stored badges
        const { data: obtainedBadges, error: fetchError } = await clientToUse
            .from('user_badges')
            .select('badge_id, awarded_at')
            .eq('anonymous_id', anonymousId);

        if (fetchError) {
            logError(fetchError, anonymousId);
            throw fetchError;
        }

        const obtainedMap = new Map((obtainedBadges || []).map(ub => [ub.badge_id, ub.awarded_at]));

        // 4. SYNC LOGIC: Award or Revoke based on REAL thresholds
        let newlyAwarded = [];
        for (const badge of allBadges) {
            const currentVal = metrics[badge.target_metric] || 0;
            const requiredVal = badge.threshold;
            const meetsThreshold = requiredVal > 0 && currentVal >= requiredVal;


            if (obtainedMap.has(badge.id)) {
                // RULE: If unlocked but progress falls behind, REVOKE (ensures consistency)
                if (!meetsThreshold) {
                    await clientToUse
                        .from('user_badges')
                        .delete()
                        .eq('anonymous_id', anonymousId)
                        .eq('badge_id', badge.id);

                    obtainedMap.delete(badge.id);
                    logSuccess('Badge revoked (insufficient progress)', { anonymousId, badgeCode: badge.code });
                }
            } else {
                // RULE: If threshold met but not unlocked, AWARD
                if (meetsThreshold) {
                    const now = new Date().toISOString();
                    const { error: insertError } = await clientToUse
                        .from('user_badges')
                        .insert({
                            anonymous_id: anonymousId,
                            badge_id: badge.id,
                            badge_code: badge.code,
                            awarded_at: now
                        });

                    if (!insertError) {
                        obtainedMap.set(badge.id, now);
                        newlyAwarded.push({
                            code: badge.code,
                            name: badge.name,
                            icon: badge.icon,
                            points: badge.points
                        });
                        logSuccess('Badge awarded', { anonymousId, badgeCode: badge.code });
                    } else {
                        logError(insertError, anonymousId);
                    }
                }
            }
        }

        // 5. SECURE POINTS CALCULATION: Sum of finalized badges only
        const totalPoints = allBadges.reduce((sum, badge) => {
            return obtainedMap.has(badge.id) ? sum + (badge.points || 0) : sum;
        }, 0);

        const newLevel = calculateLevelFromPoints(totalPoints);

        // 6. Persist profile updates (Internal DB only)
        await queryWithRLS(
            anonymousId,
            `UPDATE anonymous_users SET points = $1, level = $2 WHERE anonymous_id = $3`,
            [totalPoints, newLevel, anonymousId]
        );

        // 7. Format consistent response
        const badgesWithStatus = allBadges.map(badge => ({
            id: badge.id,
            code: badge.code,
            name: badge.name,
            description: badge.description,
            icon: badge.icon,
            category: badge.category,
            points: badge.points,
            obtained: obtainedMap.has(badge.id),
            awarded_at: obtainedMap.get(badge.id) || null,
            progress: {
                current: Math.min(badge.threshold, metrics[badge.target_metric] || 0),
                required: badge.threshold,
                percent: badge.threshold > 0 ? Math.min(100, Math.floor((metrics[badge.target_metric] || 0) / badge.threshold * 100)) : 0
            }
        }));

        return {
            success: true,
            profile: {
                points: totalPoints,
                level: newLevel,
                newlyAwarded
            },
            badges: badgesWithStatus,
            metrics
        };

    } catch (error) {
        logError(error, anonymousId);
        throw error;
    }
}

// Alias for backwards compatibility
export const syncGamification = calculateUserGamification;
