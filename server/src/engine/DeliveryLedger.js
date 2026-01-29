import redis from '../config/redis.js';

/**
 * 🏛️ EventDeduplicator (Redis-based)
 * 
 * SOLO para deduplicación técnica de eventos (eventId).
 * NO es autoridad de delivered/read - esos estados están en PostgreSQL.
 * 
 * TTL: 5 minutos (eventos son efímeros)
 */
class EventDeduplicator {
    constructor() {
        this.TTL = 300; // 5 minutos (antes era 1 hora, causaba bugs)
        this.PREFIX = 'event:processed:';
    }

    /**
     * Mark an event as dispatched (SSE/Push sent)
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
            console.error(`[Dedup] Error marking dispatched ${eventId}:`, err);
        }
    }

    /**
     * Mark an event as processed (ACK received)
     * ⚠️ This is NOT delivered in domain sense - just technical deduplication
     * @param {string} eventId 
     */
    async markProcessed(eventId) {
        if (!redis || !eventId) return;
        const key = `${this.PREFIX}${eventId}`;
        try {
            await redis.hset(key, {
                status: 'processed',
                processedAt: Date.now()
            });
            await redis.expire(key, this.TTL);
        } catch (err) {
            console.error(`[Dedup] Error marking processed ${eventId}:`, err);
        }
    }

    /**
     * Get processing status for an event
     * @param {string} eventId 
     * @returns {Promise<object|null>}
     */
    async getStatus(eventId) {
        if (!redis || !eventId) return null;
        const key = `${this.PREFIX}${eventId}`;
        try {
            return await redis.hgetall(key);
        } catch (err) {
            console.error(`[Dedup] Error getting status ${eventId}:`, err);
            return null;
        }
    }

    /**
     * Check if an event was already processed
     * ⚠️ This is for DEDUPLICATION only, not delivery confirmation
     * @param {string} eventId 
     * @returns {Promise<boolean>}
     */
    async isProcessed(eventId) {
        const status = await this.getStatus(eventId);
        return status?.status === 'processed';
    }

    // 🏛️ LEGACY ALIASES (para compatibilidad temporal)
    async markDelivered(eventId) {
        return this.markProcessed(eventId);
    }

    async isDelivered(eventId) {
        return this.isProcessed(eventId);
    }
}

// 🏛️ EXPORT: Nombre nuevo + alias legacy
export const eventDeduplicator = new EventDeduplicator();
export const deliveryLedger = eventDeduplicator; // Legacy alias
