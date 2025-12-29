import { queryWithRLS } from './rls.js';
import { logError, logSuccess } from './logger.js';
import { calculateLevelFromPoints } from './levelCalculation.js';
import supabase, { supabaseAdmin } from '../config/supabase.js';

/**
 * GAMIFICATION CORE - Single Source of Truth
 */

/**
 * Calculate all metrics for a user in real-time (Strict action-based)
 * @param {string} anonymousId 
 */
export async function calculateUserMetrics(anonymousId) {
    const clientToUse = supabaseAdmin || supabase;

    // Fetch real-time action data in parallel
    const [
        reportsRes,
        commentsRes,
        votesRes,
        reportsDataRes,
        commentsDataRes,
        rFlagsRes,
        cFlagsRes
    ] = await Promise.all([
        clientToUse.from('reports').select('*', { count: 'exact', head: true }).eq('anonymous_id', anonymousId),
        clientToUse.from('comments').select('*', { count: 'exact', head: true }).eq('anonymous_id', anonymousId),
        clientToUse.from('votes').select('*', { count: 'exact', head: true }).eq('anonymous_id', anonymousId),
        clientToUse.from('reports').select('upvotes_count, comments_count, created_at').eq('anonymous_id', anonymousId),
        clientToUse.from('comments').select('upvotes_count, created_at').eq('anonymous_id', anonymousId),
        clientToUse.from('report_flags').select('id', { count: 'exact', head: true }).eq('anonymous_id', anonymousId).is('resolved_at', null),
        clientToUse.from('comment_flags').select('id', { count: 'exact', head: true }).eq('anonymous_id', anonymousId).is('resolved_at', null)
    ]);

    // Calculate metrics derived from real data
    const reportsData = reportsDataRes.data || [];
    const commentsData = commentsDataRes.data || [];

    const totalLikesReceived = reportsData.reduce((sum, r) => sum + (r.upvotes_count || 0), 0) +
        commentsData.reduce((sum, c) => sum + (c.upvotes_count || 0), 0);

    const uniqueDays = new Set();
    [...reportsData, ...commentsData].forEach(item => {
        if (item.created_at) uniqueDays.add(new Date(item.created_at).toISOString().split('T')[0]);
    });

    const totalFlags = (rFlagsRes.count || 0) + (cFlagsRes.count || 0);
    const hasVerifiedReport = reportsData.some(r => (r.upvotes_count || 0) + (r.comments_count || 0) >= 5);

    return {
        reports_created: reportsRes.count || 0,
        comments_created: commentsRes.count || 0,
        votes_cast: votesRes.count || 0,
        likes_received: totalLikesReceived,
        activity_days: uniqueDays.size,
        has_verified_report: hasVerifiedReport ? 1 : 0,
        is_good_citizen: (totalFlags === 0 && ((reportsRes.count || 0) > 0 || (commentsRes.count || 0) > 0)) ? 1 : 0
    };
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
