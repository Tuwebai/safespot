/**
 * LocalProcessedLog - Frontend Single Source of Truth for Realtime
 * 
 * Responsibilities:
 * 1. Persist processed event IDs to prevent duplicates.
 * 2. Store authoritative server-side timestamps for gap-less Resync.
 * 3. Authority for "What has been applied to the UI/Cache".
 * 
 * @version 1.0.0 (Authority Focus)
 */

const DB_NAME = 'safespot_realtime_log';
const CURSOR_STORE = 'cursors';
const PROCESSED_EVENTS_STORE = 'processed_events';

export interface StreamCursor {
    key: string; // userId_channel
    lastProcessedAt: number; // authoritative server timestamp
}

class LocalProcessedLog {
    private db: IDBDatabase | null = null;

    private async getDB(): Promise<IDBDatabase> {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);

            request.onupgradeneeded = (event: any) => {
                const db = event.target.result;

                // Cursor Store: key = {userId}_{channel}
                if (!db.objectStoreNames.contains(CURSOR_STORE)) {
                    db.createObjectStore(CURSOR_STORE, { keyPath: 'key' });
                }

                // Processed Events Store: key = {eventId}
                if (!db.objectStoreNames.contains(PROCESSED_EVENTS_STORE)) {
                    const logStore = db.createObjectStore(PROCESSED_EVENTS_STORE, { keyPath: 'eventId' });
                    logStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };

            request.onsuccess = (event: any) => {
                this.db = event.target.result;
                resolve(this.db!);
            };

            request.onerror = (event: any) => reject(event.target.error);
        });
    }

    /**
     * INVARIANTE: Persistir evento antes de cualquier acción posterior.
     */
    async markEventAsProcessed(eventId: string, serverTimestamp: number): Promise<void> {
        if (!eventId) return;
        const db = await this.getDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([PROCESSED_EVENTS_STORE], 'readwrite');
            const store = transaction.objectStore(PROCESSED_EVENTS_STORE);
            const request = store.put({
                eventId,
                timestamp: serverTimestamp,
                localProcessedAt: Date.now()
            });

            request.onsuccess = () => {
                // console.debug(`[LocalProcessedLog] Persisted event: ${eventId}`);
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update the authoritative temporal cursor for a stream
     */
    async updateCursor(userId: string, channel: string, serverTimestamp: number): Promise<void> {
        const db = await this.getDB();
        const key = `${userId}_${channel}`;

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([CURSOR_STORE], 'readwrite');
            const store = transaction.objectStore(CURSOR_STORE);

            // We use max() to guarantee monotonicity
            const getRequest = store.get(key);
            getRequest.onsuccess = () => {
                const current = getRequest.result;
                const newTimestamp = current ? Math.max(current.lastProcessedAt, serverTimestamp) : serverTimestamp;

                store.put({ key, lastProcessedAt: newTimestamp });
                resolve();
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    /**
     * Check if an event was already physically applied
     */
    async isEventProcessed(eventId: string): Promise<boolean> {
        if (!eventId) return false;
        const db = await this.getDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([PROCESSED_EVENTS_STORE], 'readonly');
            const store = transaction.objectStore(PROCESSED_EVENTS_STORE);
            const request = store.get(eventId);

            request.onsuccess = () => resolve(!!request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get the latest known server timestamp for resync catchup
     */
    async getLastProcessedAt(userId: string, channel: string): Promise<number> {
        const db = await this.getDB();
        const key = `${userId}_${channel}`;

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([CURSOR_STORE], 'readonly');
            const store = transaction.objectStore(CURSOR_STORE);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result?.lastProcessedAt || 0);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Cleanup old entries (> 24h)
     */
    async purgeOldEvents(hours = 24): Promise<void> {
        const db = await this.getDB();
        const cutOff = Date.now() - (hours * 60 * 60 * 1000);

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([PROCESSED_EVENTS_STORE], 'readwrite');
            const store = transaction.objectStore(PROCESSED_EVENTS_STORE);
            const index = store.index('timestamp');
            const range = IDBKeyRange.upperBound(cutOff);

            const request = index.openCursor(range);
            request.onsuccess = (event: any) => {
                const cursor = event.target.result;
                if (cursor) {
                    store.delete(cursor.primaryKey);
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            request.onerror = () => reject(request.error);
        });
    }
}

export const localProcessedLog = new LocalProcessedLog();
