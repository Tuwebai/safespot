import redis from '../config/redis.js';
import { realtimeEvents } from './eventEmitter.js';
import pool from '../config/database.js';

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
        if (!redis || redis.status !== 'ready') return; // Fail-soft

        const key = `${this.PREFIX}${userId}`;
        try {
            // SET key value EX 60
            // We store the timestamp as value, though existence is what matters.
            await redis.set(key, Date.now(), 'EX', this.TTL_SECONDS);

            // Optional: Publish event if needed (e.g., specific 'user-online' event)
            // But usually we rely on "isOnline" checks or polling for lists.
            // keeping it silent to reduce noise unless strictly required.
            // console.log(`[Presence] Marked ${userId} online`);
        } catch (err) {
            console.error(`[Presence] Failed to mark online ${userId}:`, err);
        }
    }

    /**
     * Track a new connection for a user
     * @param {string} userId 
     */
    async trackConnect(userId) {
        if (!redis) return;
        const sessionKey = `${this.SESSION_PREFIX}${userId}`;
        try {
            await redis.incr(sessionKey);
            // Refresh main presence key too
            await this.markOnline(userId);
        } catch (err) {
            console.error('[Presence] Error incrementing sessions:', err);
        }
    }

    /**
     * Track a disconnection. 
     * If sessions reach 0, broadcast offline.
     * @param {string} userId 
     */
    async trackDisconnect(userId) {
        if (!redis) return;
        const sessionKey = `${this.SESSION_PREFIX}${userId}`;
        try {
            const sessions = await redis.decr(sessionKey);

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

                console.log(`[Presence] Last session closed for ${userId}. User is now Offline.`);
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
        if (!redis || redis.status !== 'ready') return false;

        const key = `${this.PREFIX}${userId}`;
        try {
            const exists = await redis.exists(key);
            return exists === 1;
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
        if (!redis || redis.status !== 'ready') return 0;

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
