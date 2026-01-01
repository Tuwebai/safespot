import { queryWithRLS } from './rls.js';
import { logError } from './logger.js';

/**
 * Get Trust Score and Status for an anonymous ID
 * Direct DB query to ensure consistency across multiple instances
 * @param {string} anonymousId 
 * @returns {Promise<{score: number, status: string}>}
 */
export async function getTrustStatus(anonymousId) {
    if (!anonymousId) return { score: 50, status: 'active' };

    try {
        // Query DB directly to ensure source-of-truth consistency.
        // Lookups by PRIMARY KEY (anonymous_id) are O(1) in PostgreSQL.
        const result = await queryWithRLS(anonymousId, `
            SELECT trust_score, moderation_status 
            FROM anonymous_trust_scores 
            WHERE anonymous_id = $1
        `, [anonymousId]);

        if (result.rows.length === 0) {
            // No entry yet, assume default
            return { score: 50.0, status: 'active' };
        }

        return {
            score: parseFloat(result.rows[0].trust_score),
            status: result.rows[0].moderation_status
        };

    } catch (error) {
        logError(error, { context: 'getTrustStatus', anonymousId });
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
 * Cache removed for consistency across multi-instance environments.
 * Direct DB access is optimized via primary key indexing.
 */
export function invalidateTrustCache(anonymousId) {
    // No-op: cache removed
}
