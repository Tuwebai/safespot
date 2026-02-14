/**
 * 🔒 Room Membership Middleware
 * 
 * Enterprise-grade authorization middleware for chat endpoints.
 * Ensures the authenticated user is a member of the room being accessed.
 * 
 * Usage:
 *   router.post('/rooms/:roomId/messages', 
 *     requireAnonymousId,      // 1. Authenticate
 *     requireRoomMembership,   // 2. Authorize (room member)
 *     handler                  // 3. Execute
 *   );
 */

import { queryWithRLS } from '../utils/rls.js';

/**
 * Verifies if a user is member of a conversation
 * @param {string} userId - Anonymous ID of the user
 * @param {string} roomId - Conversation ID
 * @returns {Promise<boolean>}
 */
export async function verifyMembership(userId, roomId) {
    const result = await queryWithRLS(
        userId,
        'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
        [roomId, userId]
    );
    return result.rows.length > 0;
}

/**
 * Express middleware: Requires room membership
 * Must be used AFTER requireAnonymousId (sets req.anonymousId)
 */
export async function requireRoomMembership(req, res, next) {
    const userId = req.anonymousId;
    const { roomId } = req.params;

    if (!userId) {
        return res.status(401).json({
            error: 'Unauthorized',
            code: 'AUTH_REQUIRED',
            message: 'Authentication required'
        });
    }

    if (!roomId) {
        return res.status(400).json({
            error: 'Bad Request',
            code: 'ROOM_ID_REQUIRED',
            message: 'Room ID is required'
        });
    }

    try {
        const isMember = await verifyMembership(userId, roomId);
        
        if (!isMember) {
            // Log potential intrusion attempt
            console.warn(`[Security] Access denied: User ${userId.substring(0, 8)}... attempted to access room ${roomId}`);
            
            return res.status(403).json({
                error: 'Access Denied',
                code: 'NOT_ROOM_MEMBER',
                message: 'You are not a member of this conversation'
            });
        }

        // User is verified member, proceed
        next();
    } catch (err) {
        console.error('[Membership Check Error]', err);
        return res.status(500).json({
            error: 'Internal Server Error',
            code: 'MEMBERSHIP_CHECK_FAILED'
        });
    }
}

/**
 * Factory: Require membership OR specific condition
 * For endpoints where non-members might have access (e.g., public reports)
 * @deprecated Use requireRoomMembership for standard chat endpoints
 */
export function requireMembershipOr(allowFn) {
    return async function(req, res, next) {
        const userId = req.anonymousId;
        const { roomId } = req.params;

        try {
            const isMember = await verifyMembership(userId, roomId);
            
            if (isMember || await allowFn(req)) {
                return next();
            }

            return res.status(403).json({
                error: 'Access Denied',
                code: 'NOT_AUTHORIZED'
            });
        } catch (err) {
            console.error('[Membership Check Error]', err);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    };
}
