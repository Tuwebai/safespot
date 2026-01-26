import redis from '../config/redis.js';

/**
 * DeliveryLedger (Redis-based)
 * 
 * Single Source of Truth for event delivery status.
 * TTL: 1 hour (Events are ephemeral)
 */
class DeliveryLedger {
    constructor() {
        this.TTL = 3600; // 1 hour
        this.PREFIX = 'delivery:event:';
    }

    /**
     * Mark an event as dispatched
     * @param {string} eventId 
     * @param {string} channel 'sse' | 'push'
     */
    async markDispatched(eventId, channel) {
        if (!redis || !eventId) return;
        const key = `${this.PREFIX}${eventId}`;
        try {
            await redis.hset(key, {
                status: 'dispatched',
                channel: channel,
                dispatchedAt: Date.now()
            });
            await redis.expire(key, this.TTL);
        } catch (err) {
            console.error(`[Ledger] Error marking dispatched ${eventId}:`, err);
        }
    }

    /**
     * Mark an event as delivered (ACK)
     * @param {string} eventId 
     */
    async markDelivered(eventId) {
        if (!redis || !eventId) return;
        const key = `${this.PREFIX}${eventId}`;
        try {
            const exists = await redis.exists(key);
            if (!exists) {
                // If it doesn't exist, we still mark it as delivered (maybe SSE arrived before Push was recorded)
                await redis.hset(key, {
                    status: 'delivered',
                    deliveredAt: Date.now()
                });
                await redis.expire(key, this.TTL);
                return;
            }
            await redis.hset(key, 'status', 'delivered');
            await redis.hset(key, 'deliveredAt', Date.now());
        } catch (err) {
            console.error(`[Ledger] Error marking delivered ${eventId}:`, err);
        }
    }

    /**
     * Get delivery status for an event
     * @param {string} eventId 
     * @returns {Promise<object|null>}
     */
    async getStatus(eventId) {
        if (!redis || !eventId) return null;
        const key = `${this.PREFIX}${eventId}`;
        try {
            return await redis.hgetall(key);
        } catch (err) {
            console.error(`[Ledger] Error getting status ${eventId}:`, err);
            return null;
        }
    }

    /**
     * Check if an event is already delivered
     * @param {string} eventId 
     * @returns {Promise<boolean>}
     */
    async isDelivered(eventId) {
        const status = await this.getStatus(eventId);
        return status?.status === 'delivered';
    }
}

export const deliveryLedger = new DeliveryLedger();
