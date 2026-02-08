/**
 * 👑 EventAuthorityLog - Single Source of Truth for Processed Events (Fase D)
 * 
 * Responsibilities:
 * 1. Maintain a fast, synchronous registry of processed event IDs.
 * 2. Prevent multi-tab race conditions via localStorage synchronization.
 * 3. Act as the authoritative gatekeeper for exactly-once processing.
 * 📌 Matiz Fase D: Garantiza formalmente el procesamiento único por eventId.
 */

export interface AuthorityRecord {
    eventId: string;
    type: string;
    domain: 'feed' | 'user' | 'system' | 'social';
    serverTimestamp: number;
    processedAt: number;
    originClientId: string;
}

const STORAGE_KEY = 'safespot_authority_log';
const MAX_LOG_SIZE = 100; // Keep only recent events in localStorage for performance
const MAX_MEMORY_SIZE = 1000; // 🧹 MEMORY FIX: Límite para Set en RAM

class EventAuthorityLog {
    private inMemoryLog: Set<string> = new Set();
    private inMemoryOrder: string[] = []; // 🧹 LRU: Orden de inserción para eviction
    private observers: Set<(eventId: string) => void> = new Set();

    constructor() {
        this.loadFromStorage();
        this.listenForPeerTabs();
    }

    private loadFromStorage() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const logs: AuthorityRecord[] = JSON.parse(stored);
                logs.forEach(l => this.inMemoryLog.add(l.eventId));
            }
        } catch (e) {
            console.warn('[AuthorityLog] Failed to load from storage', e);
        }
    }

    private listenForPeerTabs() {
        window.addEventListener('storage', (event) => {
            if (event.key === STORAGE_KEY && event.newValue) {
                try {
                    const logs: AuthorityRecord[] = JSON.parse(event.newValue);
                    logs.forEach(l => {
                        if (!this.inMemoryLog.has(l.eventId)) {
                            this.inMemoryLog.add(l.eventId);
                            this.observers.forEach(cb => cb(l.eventId));
                        }
                    });
                } catch (e) { }
            }
        });
    }

    /**
     * shouldProcess() - Authoritative check for event ingestion
     */
    shouldProcess(eventId: string, originClientId?: string, myClientId?: string): boolean {
        if (!eventId) return false;

        // 1. Echo Suppression
        if (originClientId && myClientId && originClientId === myClientId) {
            return false;
        }

        // 2. Duplication Check
        return !this.inMemoryLog.has(eventId);
    }

    /**
     * isBadgeProcessed() - Secondary semantic check for achievements (Fase C½)
     */
    isBadgeProcessed(userId: string, badgeId: string): boolean {
        return this.inMemoryLog.has(`badge_${userId}_${badgeId}`);
    }

    /**
     * record() - Registers an event as processed
     */
    record(record: AuthorityRecord, secondaryKey?: string) {
        if (this.inMemoryLog.has(record.eventId)) {
            if (secondaryKey && !this.inMemoryLog.has(secondaryKey)) {
                this.inMemoryLog.add(secondaryKey);
                this.inMemoryOrder.push(secondaryKey);
            }
            return;
        }

        // 🧹 MEMORY FIX: LRU eviction cuando excede límite
        if (this.inMemoryLog.size >= MAX_MEMORY_SIZE) {
            const toRemove = Math.ceil(MAX_MEMORY_SIZE * 0.2); // Eliminar 20% más antiguos
            const victims = this.inMemoryOrder.splice(0, toRemove);
            victims.forEach(id => this.inMemoryLog.delete(id));
            console.debug(`[AuthorityLog] 🧹 LRU eviction: removed ${toRemove} old entries`);
        }

        this.inMemoryLog.add(record.eventId);
        this.inMemoryOrder.push(record.eventId);
        
        if (secondaryKey) {
            this.inMemoryLog.add(secondaryKey);
            this.inMemoryOrder.push(secondaryKey);
        }

        // 3. Update Sync Storage (Non-blocking)
        this.schedulePersistence(record);
    }

    private schedulePersistence(record: AuthorityRecord) {
        // M1 Optimización: Defer writes to avoid UI jank
        const task = () => {
            try {
                const stored = localStorage.getItem(STORAGE_KEY);
                let logs: AuthorityRecord[] = stored ? JSON.parse(stored) : [];

                // Keep it lean: Add new, remove old
                logs.unshift(record);
                if (logs.length > MAX_LOG_SIZE) {
                    logs = logs.slice(0, MAX_LOG_SIZE);
                }

                localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
            } catch (e) {
                console.warn('[AuthorityLog] Failed to persist record', e);
            }
        };

        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(task, { timeout: 1000 });
        } else {
            setTimeout(task, 0);
        }
    }

    onPeerProcessed(cb: (eventId: string) => void): () => void {
        this.observers.add(cb);
        return () => this.observers.delete(cb);
    }

    /**
     * 🧹 MEMORY FIX: Limpia inMemoryLog y inMemoryOrder
     * Llamar en logout para prevenir memory leaks en sesiones largas
     */
    clear(): void {
        this.inMemoryLog.clear();
        this.inMemoryOrder = [];
        console.debug('[AuthorityLog] 🧹 Cleared in-memory log');
    }
}

export const eventAuthorityLog = new EventAuthorityLog();
