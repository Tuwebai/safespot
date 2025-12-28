/**
 * Simple in-memory cache with TTL
 * 
 * Features:
 * - Module-level storage (persists across component renders)
 * - Cleared on page refresh (by design - no stale data)
 * - TTL-based expiration
 * - Prefix-based invalidation for related caches
 * 
 * Usage:
 *   setCache('/gamification/summary', data, 30000);
 *   const cached = getCached<GamificationData>('/gamification/summary');
 *   invalidateCachePrefix('/gamification'); // After user action
 */

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

// Module-level cache storage
const cache = new Map<string, CacheEntry<unknown>>();

/**
 * Get cached data if valid
 * @returns data if cache hit and not expired, null otherwise
 */
export function getCached<T>(key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
        // Expired - delete and return null
        cache.delete(key);
        return null;
    }

    return entry.data as T;
}

/**
 * Set cache entry with TTL
 * @param key - Cache key (usually endpoint path)
 * @param data - Data to cache
 * @param ttlMs - Time to live in milliseconds
 */
export function setCache<T>(key: string, data: T, ttlMs: number): void {
    cache.set(key, {
        data,
        timestamp: Date.now(),
        ttl: ttlMs
    });
}

/**
 * Invalidate specific cache entry
 * Call after user actions that change data
 */
export function invalidateCache(key: string): void {
    cache.delete(key);
}

/**
 * Invalidate all entries matching prefix
 * Example: invalidateCachePrefix('/gamification') clears all gamification caches
 */
export function invalidateCachePrefix(prefix: string): void {
    for (const key of cache.keys()) {
        if (key.startsWith(prefix)) {
            cache.delete(key);
        }
    }
}

/**
 * Clear entire cache
 * Use sparingly - only for logout or major state changes
 */
export function clearCache(): void {
    cache.clear();
}

/**
 * Get cache stats (for debugging)
 */
export function getCacheStats(): { size: number; keys: string[] } {
    return {
        size: cache.size,
        keys: Array.from(cache.keys())
    };
}
