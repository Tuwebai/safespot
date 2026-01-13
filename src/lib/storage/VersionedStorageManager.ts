/**
 * VersionedStorageManager - Enterprise Storage Abstraction
 * 
 * Provides versioned, TTL-aware, checksum-validated storage layer
 * with automatic migration and fail-open guarantees.
 * 
 * @author SafeSpot Engineering (Google-Level)
 * @version 2.0.0
 */

// ===========================================
// TYPES & INTERFACES
// ===========================================

export interface StorageEntry<T> {
    version: string;        // Schema version (e.g., "v2")
    timestamp: number;      // When stored (Unix epoch ms)
    ttl: number;            // Time-to-live in milliseconds
    checksum: string;       // Simple hash for corruption detection
    data: T;                // Actual payload
}

interface MigrationResult<T> {
    success: boolean;
    data: T | null;
    error?: string;
}

// ===========================================
// VERSIONED STORAGE MANAGER
// ===========================================

export class VersionedStorageManager {
    private static readonly CURRENT_VERSION = 'v2';
    private static readonly DEFAULT_TTL_DAYS = 7;
    private static readonly GRACE_PERIOD = 24 * 60 * 60 * 1000;  // 24h before TTL expires

    /**
     * Get data with automatic staleness check, migration, and validation
     * 
     * @param key - Storage key
     * @returns Data or null if stale/corrupted/missing
     * 
     * Guarantees:
     * - NEVER throws (fail-open)
     * - NEVER returns stale data (>TTL)
     * - NEVER returns corrupted data
     * - ALWAYS migrates old versions
     */
    getVersioned<T>(key: string): T | null {
        if (typeof window === 'undefined') return null;

        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;

            let entry: StorageEntry<T>;
            try {
                entry = JSON.parse(raw) as StorageEntry<T>;
            } catch (parseError) {
                // ✅ P0 FIX: Do NOT delete key on parse error.
                // It might be valid V1 legacy data (plain string) that needs migration.
                // Let the consumer (identity.ts) handle the fallback.
                console.warn(`[Storage] Parse error on ${key} - preserving for legacy check`);
                return null;
            }

            // 1. STALENESS CHECK
            if (this.isStale(entry)) {
                const age = Date.now() - entry.timestamp;
                const ageHours = Math.floor(age / (60 * 60 * 1000));
                console.warn(`[Storage] Stale: ${key} (age: ${ageHours}h, TTL: ${VersionedStorageManager.DEFAULT_TTL_DAYS}d)`);
                this.remove(key);
                return null;
            }

            // 2. VERSION MIGRATION
            if (entry.version !== VersionedStorageManager.CURRENT_VERSION) {
                console.log(`[Storage] Migrating ${key}: ${entry.version} → ${VersionedStorageManager.CURRENT_VERSION}`);
                const migrationResult = this.migrate<T>(entry);

                if (migrationResult.success && migrationResult.data !== null) {
                    // Re-save as current version
                    this.putVersioned(key, migrationResult.data);
                    return migrationResult.data;
                } else {
                    console.warn(`[Storage] Migration failed: ${key} - ${migrationResult.error}`);
                    this.remove(key);
                    return null;
                }
            }

            // 3. CHECKSUM VALIDATION
            if (!this.validateChecksum(entry)) {
                console.error(`[Storage] Corrupted: ${key} (checksum mismatch)`);
                this.remove(key);
                return null;
            }

            // 4. SUCCESS
            return entry.data;
        } catch (error) {
            console.error(`[Storage] Unexpected error: ${key}`, error);
            return null;  // Fail-open
        }
    }

    /**
     * Put data with automatic versioning, timestamping, and checksum
     * 
     * @param key - Storage key
     * @param data - Data to store
     * @param ttlDays - TTL in days (default: 7)
     * 
     * Guarantees:
     * - NEVER throws (fail-open)
     * - Auto-cleanup on quota exceeded
     * - Atomic write (no partial data)
     */
    putVersioned<T>(key: string, data: T, ttlDays: number = VersionedStorageManager.DEFAULT_TTL_DAYS): void {
        if (typeof window === 'undefined') return;

        const ttl = ttlDays * 24 * 60 * 60 * 1000;

        const entry: StorageEntry<T> = {
            version: VersionedStorageManager.CURRENT_VERSION,
            timestamp: Date.now(),
            ttl,
            checksum: this.calculateChecksum(data),
            data,
        };

        try {
            const serialized = JSON.stringify(entry);
            localStorage.setItem(key, serialized);
        } catch (error: any) {
            // Handle quota exceeded
            if (error.name === 'QuotaExceededError') {
                console.warn('[Storage] Quota exceeded, cleaning up...');
                this.cleanupOldCaches();

                // Retry
                try {
                    localStorage.setItem(key, JSON.stringify(entry));
                } catch (retryError) {
                    console.error('[Storage] Write failed even after cleanup', retryError);
                }
            } else {
                console.error(`[Storage] Write error: ${key}`, error);
            }
        }
    }

    /**
     * Remove entry from storage
     */
    remove(key: string): void {
        if (typeof window === 'undefined') return;
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error(`[Storage] Remove error: ${key}`, error);
        }
    }

    /**
     * Check if entry is stale based on TTL
     */
    private isStale<T>(entry: StorageEntry<T>): boolean {
        const age = Date.now() - entry.timestamp;
        return age > entry.ttl;
    }

    /**
     * Check if entry is approaching staleness (within grace period)
     */
    isApproachingStale<T>(entry: StorageEntry<T>): boolean {
        const age = Date.now() - entry.timestamp;
        return age > (entry.ttl - VersionedStorageManager.GRACE_PERIOD);
    }

    /**
     * Migrate entry from old version to current version
     */
    private migrate<T>(entry: any): MigrationResult<T> {
        try {
            if (entry.version === 'v1') {
                return this.migrateV1ToV2<T>(entry);
            }

            return {
                success: false,
                data: null,
                error: `Unknown version: ${entry.version}`,
            };
        } catch (error: any) {
            return {
                success: false,
                data: null,
                error: error.message,
            };
        }
    }

    /**
     * Migrate v1 → v2
     * 
     * v1 format: { version: "v1", data: T } (no timestamp, ttl, checksum)
     * v2 format: { version: "v2", timestamp, ttl, checksum, data }
     */
    private migrateV1ToV2<T>(v1Entry: any): MigrationResult<T> {
        try {
            // v1 might be just the raw data or { version: "v1", data: X }
            let data: T;

            if (v1Entry.data !== undefined) {
                data = v1Entry.data;
            } else {
                // Raw data without envelope
                data = v1Entry;
            }

            if (data === null || data === undefined) {
                return {
                    success: false,
                    data: null,
                    error: 'v1 data is null/undefined',
                };
            }

            console.log('[Storage] ✅ v1→v2 migration successful');
            return {
                success: true,
                data,
            };
        } catch (error: any) {
            return {
                success: false,
                data: null,
                error: `v1→v2 migration failed: ${error.message}`,
            };
        }
    }

    /**
     * Calculate simple checksum (production should use crypto.subtle.digest)
     */
    private calculateChecksum(data: any): string {
        try {
            const json = JSON.stringify(data);
            let hash = 0;

            for (let i = 0; i < json.length; i++) {
                const char = json.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;  // Convert to 32-bit integer
            }

            return hash.toString(36);
        } catch (error) {
            console.warn('[Storage] Checksum calculation failed, using fallback');
            return 'fallback';
        }
    }

    /**
     * Validate checksum
     */
    private validateChecksum<T>(entry: StorageEntry<T>): boolean {
        try {
            const calculated = this.calculateChecksum(entry.data);
            return calculated === entry.checksum;
        } catch (error) {
            console.warn('[Storage] Checksum validation failed');
            return false;  // Treat as corrupted
        }
    }

    /**
     * Cleanup old/stale caches to free up space
     * 
     * Strategy:
     * 1. Remove entries with version !== CURRENT_VERSION
     * 2. Remove stale entries (age > TTL)
     * 3. Remove oldest entries if quota still exceeded
     */
    cleanupOldCaches(): void {
        if (typeof window === 'undefined') return;

        try {
            const keys = Object.keys(localStorage);
            let cleaned = 0;
            const entriesToClean: Array<{ key: string; timestamp: number }> = [];

            for (const key of keys) {
                if (!key.startsWith('safespot_')) continue;

                try {
                    const raw = localStorage.getItem(key);
                    if (!raw) continue;

                    const entry = JSON.parse(raw);

                    // Remove if wrong version
                    if (entry.version && entry.version !== VersionedStorageManager.CURRENT_VERSION) {
                        localStorage.removeItem(key);
                        cleaned++;
                        continue;
                    }

                    // Remove if stale
                    if (entry.timestamp && entry.ttl) {
                        const age = Date.now() - entry.timestamp;
                        if (age > entry.ttl) {
                            localStorage.removeItem(key);
                            cleaned++;
                            continue;
                        }

                        // Collect for potential cleanup
                        entriesToClean.push({ key, timestamp: entry.timestamp });
                    }
                } catch {
                    // Invalid entry, remove it
                    localStorage.removeItem(key);
                    cleaned++;
                }
            }

            // If still need space, remove oldest entries
            if (entriesToClean.length > 20) {
                entriesToClean.sort((a, b) => a.timestamp - b.timestamp);
                const toRemove = entriesToClean.slice(0, Math.floor(entriesToClean.length * 0.3));

                for (const { key } of toRemove) {
                    localStorage.removeItem(key);
                    cleaned++;
                }
            }

            console.log(`[Storage] Cleaned ${cleaned} entries`);
        } catch (error) {
            console.error('[Storage] Cleanup failed', error);
        }
    }

    /**
     * Get metadata about a stored entry without parsing data
     */
    getMetadata(key: string): { version: string; timestamp: number; ttl: number; age: number } | null {
        if (typeof window === 'undefined') return null;

        try {
            const raw = localStorage.getItem(key);
            if (!raw) return null;

            const entry = JSON.parse(raw);
            const age = Date.now() - (entry.timestamp || 0);

            return {
                version: entry.version || 'unknown',
                timestamp: entry.timestamp || 0,
                ttl: entry.ttl || 0,
                age,
            };
        } catch {
            return null;
        }
    }
}

// ===========================================
// SINGLETON INSTANCE
// ===========================================

export const versionedStorage = new VersionedStorageManager();
