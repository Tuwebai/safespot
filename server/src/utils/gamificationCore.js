import { queryWithRLS } from './rls.js';
import { logError, logSuccess } from './logger.js';
import { calculateLevelFromPoints } from './levelCalculation.js';
import supabase, { supabaseAdmin } from '../config/supabase.js';
import { NotificationService } from './notificationService.js';

/**
 * Helper: Smart Metric Selector
 * Handles aliases, category-based fallbacks and cumulative logic.
 */
function getMetricValue(badge, metrics) {
    const metricAliases = {
        'reports_created': metrics.reports_created,
        'reports': metrics.reports_created,
        'count': metrics.reports_created,
        'comments_created': metrics.comments_created,
        'comments': metrics.comments_created,
        'total_comments': metrics.comments_created,
        'likes_received': metrics.likes_received,
        'likes': metrics.likes_received,
        'total_likes': metrics.likes_received,
        'activity_days': metrics.activity_days,
        'days': metrics.activity_days,
        'votes_cast': metrics.votes_cast,
        'votes': metrics.votes_cast,
        'total_votes': metrics.votes_cast
    };

    // 1. Try direct or alias
    let val = metrics[badge.target_metric];
    if (val === undefined) val = metricAliases[badge.target_metric];

    // 2. Category Fallback
    if (val === undefined) {
        const fallbacks = {
            'reports': metrics.reports_created,
            'comments': metrics.comments_created,
            'social': metrics.likes_received,
            'days': metrics.activity_days,
            'votes': metrics.votes_cast
        };
        val = fallbacks[badge.category];
    }

    return val || 0;
}

/**
 * Calculate all metrics for a user in real-time (Strict action-based)
 * Highly optimized for scalability using server-side SQL aggregations.
 * @param {string} anonymousId 
 */
export async function calculateUserMetrics(anonymousId) {
    try {
        // Highly optimized single-pass query to calculate metrics
        const result = await queryWithRLS(anonymousId, `
            SELECT 
                (SELECT COUNT(*) FROM reports WHERE anonymous_id = $1) as reports_created,
                (SELECT COUNT(*) FROM comments WHERE anonymous_id = $1) as comments_created,
                (SELECT COUNT(*) FROM votes WHERE anonymous_id = $1) as votes_cast,
                (SELECT COUNT(*) FROM report_flags WHERE anonymous_id = $1 AND resolved_at IS NULL) as r_flags,
                (SELECT COUNT(*) FROM comment_flags WHERE anonymous_id = $1 AND resolved_at IS NULL) as c_flags,
                COALESCE((SELECT SUM(upvotes_count) FROM reports WHERE anonymous_id = $1), 0) +
                COALESCE((SELECT SUM(upvotes_count) FROM comments WHERE anonymous_id = $1), 0) as likes_received,
                -- P0 FIX: SQL Syntax Error. Sum counts from separate subqueries instead of UNION ALL
                (
                    (SELECT COUNT(*) FROM (SELECT 1 FROM reports WHERE anonymous_id = $1 LIMIT 100) r) +
                    (SELECT COUNT(*) FROM (SELECT 1 FROM comments WHERE anonymous_id = $1 LIMIT 100) c)
                ) as activity_score,
                EXISTS (
                    SELECT 1 FROM reports 
                    WHERE anonymous_id = $1 
                    AND (upvotes_count + comments_count) >= 5
                    LIMIT 1
                ) as has_verified_report
        `, [anonymousId]);

        if (result.rows.length === 0) return null;

        const row = result.rows[0];
        const totalFlags = (parseInt(row.r_flags) || 0) + (parseInt(row.c_flags) || 0);

        const metrics = {
            reports_created: parseInt(row.reports_created) || 0,
            comments_created: parseInt(row.comments_created) || 0,
            votes_cast: parseInt(row.votes_cast) || 0,
            likes_received: parseInt(row.likes_received) || 0,
            activity_days: parseInt(row.activity_score) || 0, // Using activity_score as a proxy for days
            has_verified_report: row.has_verified_report ? 1 : 0,
            is_good_citizen: (totalFlags === 0 && (row.reports_created > 0 || row.comments_created > 0)) ? 1 : 0
        };

        // Add semantic aliases to match potential DB target_metric values
        metrics.total_reports = metrics.reports_created;
        metrics.total_comments = metrics.comments_created;
        metrics.total_votes = metrics.votes_cast;
        metrics.count = metrics.reports_created; // Default fallback for generic 'count'

        return metrics;
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

        // 3.5. HIGH WATER MARK LOGIC (User Feedback Fix)
        // If a user has a badge (e.g. "Debatiente", 15 comments), but deletes their comments (count 0),
        // the progress should NOT define them as 0/40. It should be at least 15/40.
        // We ensure metrics reflect the highest threshold of earned badges.

        const metricFloors = {};

        allBadges.forEach(badge => {
            if (obtainedMap.has(badge.id)) {
                const metricKey = badge.target_metric;
                const threshold = badge.threshold || 0;

                if (metricKey) {
                    metricFloors[metricKey] = Math.max(metricFloors[metricKey] || 0, threshold);
                }
            }
        });

        // Apply floors to metrics
        Object.keys(metricFloors).forEach(key => {
            if (metrics[key] !== undefined) {
                // If raw count (e.g. 0) is less than badge requirement (e.g. 15), use 15.
                metrics[key] = Math.max(metrics[key], metricFloors[key]);
            } else {
                // Case where metric alias handling is needed, but usually metrics has matching keys.
                // We'll rely on getMetricValue doing the lookup, so we should update the base map if possible.
                // But getMetricValue reads from metrics object.
                // Let's try to match aliases if key is missing.
                // Simpler: Just set it if it's missing (though unlikely given calculateUserMetrics structure).
                metrics[key] = metricFloors[key];
            }
        });

        // Re-apply aliases because we just modified the base values
        metrics.total_reports = metrics.reports_created;
        metrics.total_comments = metrics.comments_created;
        metrics.total_votes = metrics.votes_cast;
        metrics.count = metrics.reports_created;

        // 4. SYNC LOGIC: Award (Write Operation) - SKIPPED IN READ-ONLY
        let newlyAwarded = [];

        if (!readOnly) {
            for (const badge of allBadges) {
                const currentVal = getMetricValue(badge, metrics);
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
            const isObtained = obtainedMap.has(badge.id);
            const currentMetric = getMetricValue(badge, metrics);
            const requiredMetric = badge.threshold;

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
                        missing: Math.max(0, requiredMetric - currentMetric),
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
