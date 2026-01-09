import { realtimeEvents } from './eventEmitter.js';

/**
 * Presence Tracker (In-Memory)
 * 
 * Tracks online users and manages connection counts for multi-tab support.
 * This is the Single Source of Truth for presence on the server.
 */
class PresenceTracker {
    constructor() {
        // userId -> connectionCount
        this.onlineUsers = new Map();
    }

    /**
     * Mark a user as connected
     * @param {string} userId 
     */
    addConnection(userId) {
        const count = this.onlineUsers.get(userId) || 0;
        this.onlineUsers.set(userId, count + 1);

        if (count === 0) {
            // First tab opened: Notify others
            realtimeEvents.emit('presence-update', {
                userId,
                partial: { status: 'online', last_seen_at: null }
            });
            console.log(`[Presence] User ${userId} is now ONLINE`);
        }
    }

    /**
     * Mark a user as disconnected
     * @param {string} userId 
     * @returns {string|null} The last seen ISO string if the user just went offline
     */
    removeConnection(userId) {
        const count = this.onlineUsers.get(userId) || 0;
        if (count <= 1) {
            this.onlineUsers.delete(userId);
            const lastSeen = new Date().toISOString();

            // Last tab closed: Notify others
            realtimeEvents.emit('presence-update', {
                userId,
                partial: { status: 'offline', last_seen_at: lastSeen }
            });
            console.log(`[Presence] User ${userId} is now OFFLINE`);
            return lastSeen;
        } else {
            this.onlineUsers.set(userId, count - 1);
            return null;
        }
    }

    /**
     * Check if a user is currently online (has at least one connection)
     * @param {string} userId 
     * @returns {boolean}
     */
    isOnline(userId) {
        return this.onlineUsers.has(userId);
    }

    /**
     * Get all currently online user IDs
     * @returns {string[]}
     */
    getOnlineIds() {
        return Array.from(this.onlineUsers.keys());
    }
}

export const presenceTracker = new PresenceTracker();
