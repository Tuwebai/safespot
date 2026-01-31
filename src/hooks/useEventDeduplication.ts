import { useCallback } from 'react';

/**
 * Event Deduplication Hook - Enterprise Grade
 * 
 * Ensures that specific events are only processed once.
 * Persistent in sessionStorage to handle tab reloads/navigation.
 */

const STORAGE_KEY = 'safespot_event_dedup';
const EVENT_TTL_MS = 60 * 1000; // 60 seconds

// Internal cache to avoid constant parsing
let inMemoryCache: Record<string, number> = {};

// Load initial state from sessionStorage
try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) inMemoryCache = JSON.parse(stored);
} catch (e) {
    console.debug('[Deduplicator] Failed to load from sessionStorage');
}

function saveToStorage() {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(inMemoryCache));
    } catch (e) {
        // Silent fail (incognito or full storage)
    }
}

export function useEventDeduplication() {
    /**
     * Checks if an event has already been processed and marks it as processed.
     * @returns true if the event is NEW, false if it was ALREADY processed.
     */
    const shouldProcess = useCallback((eventId: string | undefined, context = 'Generic'): boolean => {
        if (!eventId) return true;

        const now = Date.now();
        const lastProcessed = inMemoryCache[eventId];

        // 1. Check if already processed within TTL
        if (lastProcessed && (now - lastProcessed < EVENT_TTL_MS)) {
            console.debug(`[Event] 🛡️ SKIPPED_DUPLICATE [${context}] id=${eventId} (${now - lastProcessed}ms ago)`);
            return false;
        }

        // 2. Mark as processed
        inMemoryCache[eventId] = now;
        console.debug(`[Event] ✅ PROCESSED [${context}] id=${eventId}`);

        // 3. Maintenance: Auto-clear expired entries
        let needsSave = true;

        // Periodic cleanup (10% chance)
        if (Math.random() < 0.1) {
            for (const [id, ts] of Object.entries(inMemoryCache)) {
                if (now - ts > EVENT_TTL_MS) {
                    delete inMemoryCache[id];
                }
            }
        }

        // Cap size to prevent storage bloat
        const keys = Object.keys(inMemoryCache);
        if (keys.length > 100) {
            delete inMemoryCache[keys[0]];
        }

        if (needsSave) saveToStorage();

        return true;
    }, []);

    return { shouldProcess };
}
