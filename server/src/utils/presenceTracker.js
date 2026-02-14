import redis from '../config/redis.js';
import { realtimeEvents } from './eventEmitter.js';
import pool from '../config/database.js';
import logger from './logger.js';

/**
 * Presence Tracker (Redis Distributed)
 * 
 * Tracks online users using Redis Keys with TTL (Time-To-Live).
 * SINGLE SOURCE OF TRUTH: Redis `presence:user:{userId}`
 */
class PresenceTracker {
    constructor() {
        this.TTL_SECONDS = 60;
        this.PREFIX = 'presence:user:';
        this.SESSION_PREFIX = 'presence:sessions:';
    }

    /**
     * Mark a user as online (Refresh TTL)
     * @param {string} userId 
     */
    async markOnline(userId) {
        if (!redis || redis.status !== 'ready') {
            return; // Fail-soft
        }

        const key = `${this.PREFIX}${userId}`;
        try {
            // SET key value EX 60
            // We store the timestamp as value, though existence is what matters.
            await redis.set(key, Date.now(), 'EX', this.TTL_SECONDS);

            if (process.env.DEBUG_PRESENCE === 'true') {
                const ttl = await redis.ttl(key);
                logger.debug(`[Presence] Marked ${userId.substring(0,8)}... online (TTL: ${ttl}s)`);
            }
        } catch (err) {
            console.error(`[Presence] Failed to mark online ${userId}:`, err);
        }
    }

    /**
     * Track a new connection for a user
     * @param {string} userId 
     */
    async trackConnect(userId) {
        if (!redis || redis.status !== 'ready') {
            return;
        }
        const sessionKey = `${this.SESSION_PREFIX}${userId}`;
        try {
            // 🔒 ATOMIC: INCR + EXPIRE in single transaction
            // Prevents race condition where process dies between operations
            const results = await redis.multi()
                .incr(sessionKey)
                .expire(sessionKey, this.TTL_SECONDS * 2) // 120s margin
                .exec();
            
            const newSessionCount = results[0][1]; // Get INCR result
            
            // Refresh main presence key too
            await this.markOnline(userId);

            if (process.env.DEBUG_PRESENCE === 'true') {
                logger.debug(`[Presence] Connect: ${userId.substring(0,8)}... (sessions: ${newSessionCount})`);
            }
        } catch (err) {
            console.error('[Presence] Error tracking connect:', err);
        }
    }

    /**
     * Track a disconnection. 
     * If sessions reach 0, broadcast offline.
     * @param {string} userId 
     */
    async trackDisconnect(userId) {
        if (!redis || redis.status !== 'ready') {
            return;
        }
        const sessionKey = `${this.SESSION_PREFIX}${userId}`;
        try {
            const sessions = await redis.decr(sessionKey);

            if (process.env.DEBUG_PRESENCE === 'true') {
                logger.debug(`[Presence] Disconnect: ${userId.substring(0,8)}... (sessions: ${sessions})`);
            }

            if (sessions <= 0) {
                // Ensure it doesn't go below 0
                await redis.del(sessionKey);

                // Last tab closed! Clear presence and notify
                await redis.del(`${this.PREFIX}${userId}`);

                const lastSeen = new Date().toISOString();

                // 🧠 ENTERPRISE PERSISTENCE: Save to DB so initial fetches are accurate
                pool.query(
                    'UPDATE anonymous_users SET last_seen_at = $2 WHERE anonymous_id = $1',
                    [userId, lastSeen]
                ).catch(err => console.error(`[Presence] Failed to persist last_seen_at for ${userId}:`, err));

                realtimeEvents.broadcast('presence-update', {
                    userId,
                    partial: {
                        status: 'offline',
                        last_seen_at: lastSeen
                    }
                });

                logger.info(`[Presence] Last session closed for ${userId.substring(0,8)}.... User is now Offline.`);
            }
        } catch (err) {
            console.error('[Presence] Error decrementing sessions:', err);
        }
    }

    /**
     * Check if a user is currently online
     * @param {string} userId 
     * @returns {Promise<boolean>}
     */
    async isOnline(userId) {
        // 🔧 DEV TESTING: Force offline to test push notifications
        if (process.env.FORCE_OFFLINE_TEST === 'true') {
            logger.debug(`[Presence] DEV: Forcing offline for ${userId.substring(0,8)}...`);
            return false;
        }
        
        if (!redis || redis.status !== 'ready') {
            return false;
        }

        const sessionKey = `${this.SESSION_PREFIX}${userId}`;
        const presenceKey = `${this.PREFIX}${userId}`;
        
        try {
            // 🏛️ ROBUST CHECK: Validate both session count AND TTL
            const [sessionCount, presenceTTL] = await Promise.all([
                redis.get(sessionKey),
                redis.ttl(presenceKey)
            ]);
            
            const sessions = parseInt(sessionCount) || 0;
            const hasValidTTL = presenceTTL > 0;
            
            // 🧹 PASSIVE CLEANUP: If presence expired but session exists, clean up
            if (!hasValidTTL && sessions > 0) {
                await redis.del(sessionKey);
                if (process.env.DEBUG_PRESENCE === 'true') {
                    logger.debug(`[Presence] Passive cleanup: Removed orphaned session for ${userId.substring(0,8)}...`);
                }
                return false;
            }
            
            // User is online only if BOTH conditions are true
            return sessions > 0 && hasValidTTL;
        } catch (err) {
            console.error(`[Presence] Failed to check isOnline ${userId}:`, err);
            return false;
        }
    }

    /**
     * Get count of online users (Approximation)
     * Warning: SCAN is slow on large datasets, use with caution.
     * @returns {Promise<number>}
     */
    async getOnlineCount() {
        if (!redis || redis.status !== 'ready') {
            return 0;
        }

        // This is a naive implementation using KEYS/SCAN. 
        // For high scale, maintain a separate HyperLogLog or Counter.
        // For Phase 3 scope "strictly if necessary", we'll providing a best-effort SCAN.
        let count = 0;
        let cursor = '0';
        const match = `${this.PREFIX}*`;

        try {
            do {
                const [newCursor, keys] = await redis.scan(cursor, 'MATCH', match, 'COUNT', 100);
                cursor = newCursor;
                count += keys.length;
            } while (cursor !== '0');

            return count;
        } catch (err) {
            console.error('[Presence] Failed to count online users:', err);
            return 0;
        }
    }
}

export const presenceTracker = new PresenceTracker();
