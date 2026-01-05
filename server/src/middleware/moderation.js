import { getTrustStatus } from '../utils/trustScore.js';
import { logError } from '../utils/logger.js';

/**
 * Middleware to ensure the user is not banned.
 * Must be placed AFTER requireAnonymousId.
 */
export async function verifyUserStatus(req, res, next) {
    try {
        const anonymousId = req.anonymousId; // Set by requireAnonymousId

        if (!anonymousId) {
            return res.status(401).json({ error: 'Unauthorized: No ID found' });
        }

        const { status } = await getTrustStatus(anonymousId);

        if (status === 'banned') {
            return res.status(403).json({
                error: 'ACCOUNT_BANNED',
                message: 'Tu cuenta ha sido suspendida permanentemente por violar las normas de la comunidad.'
            });
        }

        // Note: 'shadow_banned' users are NOT blocked here. 
        // Their content is accepted but hidden (handled in report/comment logic).

        next();
    } catch (error) {
        logError(error, { context: 'verifyUserStatus', anonymousId: req.anonymousId });
        // Fail open to avoid blocking legitimate users on system error, 
        // unless it's a critical security flaw.
        // For moderation, fail open is usually safer for UX, but fail closed is safer for platform.
        // Given this is a ban check, if DB fails, maybe let them pass? 
        // "Fail open (allow usage) to avoid blocking users during DB glitches" as per trustScore.js
        next();
    }
}
