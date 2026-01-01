import { queryWithRLS } from './rls.js';
import { logError, logSuccess } from './logger.js';
import { calculateLevelFromPoints } from './levelCalculation.js';
import supabase, { supabaseAdmin } from '../config/supabase.js';
import { NotificationService } from './notificationService.js';

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
 * SOURCE OF TRUTH: Synchronize and/or calculate user's gamification state.
 * @param {string} anonymousId 
 * @param {boolean} readOnly - If true, only calculates without database writes
 */
export async function calculateUserGamification(anonymousId, readOnly = false) {
    if (!anonymousId) return null;

    try {
        const clientToUse = supabaseAdmin || supabase;

        // 1. Get all badge rules
        const { data: allBadges } = await clientToUse
            .from('badges')
            .select('*')
            .order('category', { ascending: true })
            .order('level', { ascending: true }); // Ensure hierarchical order

        if (!allBadges) throw new Error('Could not fetch badges catalog');

        // 2. Calculate REAL-TIME metrics from user actions
        const metrics = await calculateUserMetrics(anonymousId);

        // 3. Get currently obtained badges
        const { data: obtainedBadges, error: fetchError } = await clientToUse
            .from('user_badges')
            .select('badge_id, awarded_at')
            .eq('anonymous_id', anonymousId);

        if (fetchError) {
            logError(fetchError, anonymousId);
            throw fetchError;
        }

        const obtainedMap = new Map((obtainedBadges || []).map(ub => [ub.badge_id, ub.awarded_at]));

        // 4. SYNC LOGIC: Award (Write Operation) - SKIPPED IN READ-ONLY
        let newlyAwarded = [];

        if (!readOnly) {
            for (const badge of allBadges) {
                const currentVal = metrics[badge.target_metric] || 0;
                const requiredVal = badge.threshold;
                const meetsThreshold = requiredVal > 0 && currentVal >= requiredVal;

                if (obtainedMap.has(badge.id)) {
                    // Persistent: Already obtained
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
                                points: badge.points,
                                rarity: badge.rarity
                            });

                            // Notify user of achievement
                            // We do this asynchronously to not block the main process
                            NotificationService.notifyBadgeEarned(anonymousId, badge).catch(err => {
                                // Just log error, don't fail the award
                                console.error('Failed to send badge notification:', err);
                            });

                            logSuccess('Badge awarded', { anonymousId, badgeCode: badge.code });
                        } else {
                            logError(insertError, anonymousId);
                        }
                    }
                }
            }
        }

        // 5. SECURE POINTS CALCULATION: Sum of finalized badges only
        const totalPoints = allBadges.reduce((sum, badge) => {
            return obtainedMap.has(badge.id) ? sum + (badge.points || 0) : sum;
        }, 0);

        const newLevel = calculateLevelFromPoints(totalPoints);

        // 6. Persist profile updates - SKIPPED IN READ-ONLY
        if (!readOnly) {
            await queryWithRLS(
                anonymousId,
                `UPDATE anonymous_users SET points = $1, level = $2 WHERE anonymous_id = $3`,
                [totalPoints, newLevel, anonymousId]
            );
        }

        // 7. Format consistent response & Calculate Next Achievement
        let nextAchievement = null;
        let maxPercent = -1;

        const badgesWithStatus = allBadges.map(badge => {
            // Metrics Logic
            const currentMetric = metrics[badge.target_metric] || 0;
            const requiredMetric = badge.threshold;
            const isObtained = obtainedMap.has(badge.id);

            const progress = {
                current: Math.min(requiredMetric, currentMetric),
                required: requiredMetric,
                percent: requiredMetric > 0 ? Math.min(100, Math.floor((currentMetric / requiredMetric) * 100)) : 0
            };

            // Calculate potential candidate for "Next Achievement"
            if (!isObtained) {
                // We prioritize badges that are close to completion
                if (progress.percent > maxPercent) {
                    maxPercent = progress.percent;
                    nextAchievement = {
                        name: badge.name,
                        description: badge.description,
                        icon: badge.icon,
                        rarity: badge.rarity,
                        points: badge.points,
                        metric_label: badge.category_label,
                        missing: requiredMetric - currentMetric,
                        progress
                    };
                }
            }

            return {
                id: badge.id,
                code: badge.code,
                name: badge.name,
                description: badge.description,
                icon: badge.icon,
                category: badge.category,
                category_label: badge.category_label,
                level: badge.level,
                rarity: badge.rarity,
                points: badge.points,
                obtained: isObtained,
                awarded_at: obtainedMap.get(badge.id) || null,
                progress
            };
        });

        // 8. Sort badges: Obtained first, then by Category/Level
        // But the frontend might handle grouping. Let's keep catalog order but maybe Obtained=true is useful.
        // The array is already sorted by category, level from SQL.

        return {
            success: true,
            profile: {
                points: totalPoints,
                level: newLevel,
                newlyAwarded // Empty if readOnly
            },
            badges: badgesWithStatus,
            metrics,
            nextAchievement // New field for frontend UX
        };

    } catch (error) {
        logError(error, anonymousId);
        throw error;
    }
}

/**
 * READ-ONLY: Get profile without side effects
 */
export async function getGamificationProfile(anonymousId) {
    return calculateUserGamification(anonymousId, true);
}

// Alias for backwards compatibility (Write mode by default)
export const syncGamification = calculateUserGamification;
