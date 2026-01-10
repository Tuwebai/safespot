import redis from '../config/redis.js';
import { realtimeEvents } from './eventEmitter.js';

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
     * Mark a user as offline (Explicit Logout)
     * @param {string} userId 
     */
    async markOffline(userId) {
        if (!redis || redis.status !== 'ready') return;

        const key = `${this.PREFIX}${userId}`;
        try {
            await redis.del(key);
            console.log(`[Presence] Marked ${userId} offline`);

            // Notify via Pub/Sub that user went offline explicitly
            realtimeEvents.broadcast('presence-update', {
                userId,
                status: 'offline',
                lastSeen: new Date().toISOString()
            });
        } catch (err) {
            console.error(`[Presence] Failed to mark offline ${userId}:`, err);
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
