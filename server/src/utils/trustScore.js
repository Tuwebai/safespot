import { queryWithRLS } from './rls.js';
import { logError } from './logger.js';

// Simple in-memory cache for Trust Scores to avoid DB hits on every request
// Map<anonymous_id, { score: number, status: string, timestamp: number }>
const scoreCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Get Trust Score and Status for an anonymous ID
 * Uses cache if available and fresh
 * @param {string} anonymousId 
 * @returns {Promise<{score: number, status: string}>}
 */
export async function getTrustStatus(anonymousId) {
    if (!anonymousId) return { score: 50, status: 'active' };

    // Check cache
    const cached = scoreCache.get(anonymousId);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
        return { score: cached.score, status: cached.status };
    }

    try {
        // Query DB (Using queryWithRLS with system context or just ensuring ID matches)
        // Since this is a system utility, we might want to bypass RLS or use a specific function.
        // However, queryWithRLS sets app.anonymous_id = anonymousId, and our RLS policy allows owners to read their score.
        // Wait, we need to read 'moderation_status' which might be sensitive?
        // The policy 'ats_select_own' allows reading own score.

        // We can also use a direct query if we trust the input.
        // Let's use queryWithRLS to be safe and consistent.

        const result = await queryWithRLS(anonymousId, `
      SELECT trust_score, moderation_status 
      FROM anonymous_trust_scores 
      WHERE anonymous_id = $1
    `, [anonymousId]);

        let data;
        if (result.rows.length === 0) {
            // No entry yet, assume default
            data = { score: 50.0, status: 'active' };
        } else {
            data = {
                score: parseFloat(result.rows[0].trust_score),
                status: result.rows[0].moderation_status
            };
        }

        // Update cache
        scoreCache.set(anonymousId, { ...data, timestamp: Date.now() });

        return data;

    } catch (error) {
        logError(error, { context: 'getTrustStatus', anonymousId });
        // Fail open (assume safe) or fail close?
        // Fail open (allow usage) to avoid blocking users during DB glitches
        return { score: 50, status: 'active' };
    }
}

/**
 * Determine visibility for new content based on Trust Score
 * @param {string} anonymousId 
 * @returns {Promise<{isHidden: boolean, moderationAction: string|null}>}
 */
export async function checkContentVisibility(anonymousId) {
    const { score, status } = await getTrustStatus(anonymousId);

    // LOGIC: Shadow Ban
    // 1. Explicit Shadow Ban Status
    if (status === 'shadow_banned' || status === 'banned') {
        return { isHidden: true, moderationAction: 'shadow_ban_status' };
    }

    // 2. Low Score Threshold (e.g. < 30)
    if (score < 30) {
        return { isHidden: true, moderationAction: 'shadow_ban_low_score' };
    }

    // Active / Verified
    return { isHidden: false, moderationAction: null };
}

/**
 * Clear cache for a specific user (e.g. on manual update)
 */
export function invalidateTrustCache(anonymousId) {
    scoreCache.delete(anonymousId);
}
