/**
 * StorageSyncManager - Cross-Tab Syncronization
 * 
 * Synchronizes storage changes across multiple browser tabs using
 * BroadcastChannel API with fallback to storage events.
 * 
 * @author SafeSpot Engineering (Google-Level)
 * @version 2.0.0
 */

import { queryClient } from '../queryClient';

// ===========================================
// STORAGE SYNC MANAGER
// ===========================================

interface StorageChangeMessage {
    type: 'STORAGE_CHANGE';
    key: string;
    operation: 'set' | 'remove';
    timestamp: number;
    tabId: string;
}

export class StorageSyncManager {
    private channel: BroadcastChannel | null = null;
    private tabId: string;
    private isSupported: boolean;

    constructor() {
        this.tabId = this.generateTabId();
        this.isSupported = 'BroadcastChannel' in window;

        if (this.isSupported) {
            this.channel = new BroadcastChannel('safespot-storage-sync');
            this.listenBroadcast();
            console.debug('[StorageSync] ✅ BroadcastChannel initialized (tabId:', this.tabId.substring(0, 8) + ')');
        } else {
            console.warn('[StorageSync] BroadcastChannel not supported, using storage events fallback');
        }

        // Always listen to storage events (works across tabs in most browsers)
        this.listenStorageEvents();
    }

    /**
     * Broadcast storage change to other tabs
     */
    broadcast(key: string, operation: 'set' | 'remove'): void {
        if (this.channel) {
            const message: StorageChangeMessage = {
                type: 'STORAGE_CHANGE',
                key,
                operation,
                timestamp: Date.now(),
                tabId: this.tabId,
            };

            try {
                this.channel.postMessage(message);
            } catch (error) {
                console.error('[StorageSync] Broadcast failed:', error);
            }
        }
    }

    /**
     * Listen for BroadcastChannel messages
     */
    private listenBroadcast(): void {
        if (!this.channel) return;

        this.channel.addEventListener('message', (event: MessageEvent<StorageChangeMessage>) => {
            const { type, key, operation, tabId } = event.data;

            // Ignore own messages
            if (tabId === this.tabId) return;

            if (type === 'STORAGE_CHANGE') {
                console.log(`[StorageSync] Received from tab ${tabId.substring(0, 8)}: ${operation} ${key}`);
                this.handleStorageChange(key, operation);
            }
        });
    }

    /**
     * Listen for native storage events (fallback + cross-browser support)
     */
    private listenStorageEvents(): void {
        window.addEventListener('storage', (event: StorageEvent) => {
            if (!event.key || !event.key.startsWith('safespot_')) return;

            const operation: 'set' | 'remove' = event.newValue === null ? 'remove' : 'set';

            // Filter out internal high-frequency noise
            if (event.key === 'safespot_leader_lease' || event.key.startsWith('safespot_heartbeat_')) {
                // Do not log these, they are too frequent
                this.handleStorageChange(event.key, operation);
                return;
            }

            console.log(`[StorageSync] Native storage event: ${operation} ${event.key}`);
            this.handleStorageChange(event.key, operation);
        });
    }

    /**
     * Handle storage change from other tab
     */
    private handleStorageChange(key: string, operation: 'set' | 'remove'): void {
        if (operation === 'remove') {
            // Storage was cleared → Invalidate relevant queries
            this.invalidateQueryForKey(key);
        } else if (operation === 'set') {
            // Storage was updated → Optionally refetch queries
            this.refetchQueryForKey(key);
        }
    }

    /**
     * Map storage key to query keys and invalidate
     */
    private invalidateQueryForKey(storageKey: string): void {
        const queryKeys = this.mapStorageKeyToQueryKeys(storageKey);

        for (const queryKey of queryKeys) {
            console.log(`[StorageSync] Invalidating query:`, queryKey);
            queryClient.invalidateQueries({ queryKey });
        }
    }

    /**
     * Map storage key to query keys and refetch
     */
    private refetchQueryForKey(storageKey: string): void {
        const queryKeys = this.mapStorageKeyToQueryKeys(storageKey);

        for (const queryKey of queryKeys) {
            console.log(`[StorageSync] Refetching query:`, queryKey);
            queryClient.refetchQueries({ queryKey, type: 'active' });
        }
    }

    /**
     * Map storage keys to React Query keys
     * 
     * This creates the bridge between localStorage and React Query cache
     */
    private mapStorageKeyToQueryKeys(storageKey: string): unknown[][] {
        const queryKeys: unknown[][] = [];

        // Identity changes
        if (storageKey === 'safespot_anonymous_id') {
            queryKeys.push(['user', 'profile']);
            queryKeys.push(['reports']);
            queryKeys.push(['notifications']);
            queryKeys.push(['chats']);
            // Invalidate virtually everything since identity changed
        }

        // Settings changes
        if (storageKey.startsWith('safespot_settings_')) {
            queryKeys.push(['settings']);
        }

        // Theme changes
        if (storageKey === 'safespot_theme' || storageKey === 'safespot_accent') {
            // Just refetch settings, no need to invalidate data
            queryKeys.push(['settings', 'theme']);
        }

        // Auth changes (logout/login)
        if (storageKey === 'auth-storage' || storageKey === 'safespot_auth_logout') {
            // ✅ ENTERPRISE FIX: No más "Nuclear Clear".
            // En su lugar, invalidamos solo lo que depende de la identidad del usuario.
            console.warn('[StorageSync] Auth change detected, invalidating identity-sensitive queries');

            // Invalida perfiles, reportes (que pueden tener 'liked_by_me'), notificaciones, etc.
            queryClient.invalidateQueries({
                predicate: (query) => {
                    const key = JSON.stringify(query.queryKey);
                    return key.includes('user') ||
                        key.includes('profile') ||
                        key.includes('notifications') ||
                        key.includes('reports');
                }
            });
            return [];
        }

        // Internal System Keys - Ignore silently
        if (
            storageKey === 'safespot_leader_lease' ||
            storageKey.startsWith('safespot_heartbeat_') ||
            storageKey.startsWith('safespot_debug_')
        ) {
            return [];
        }

        // If no specific mapping, be conservative and don't invalidate
        // (Better to have stale data than unnecessary refetches)
        if (queryKeys.length === 0) {
            // Only warn for unknown keys that might be important
            console.debug(`[StorageSync] No query mapping for: ${storageKey}`);
        }

        return queryKeys;
    }

    /**
     * Generate unique tab ID
     */
    private generateTabId(): string {
        return `tab-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * Cleanup on unmount
     */
    destroy(): void {
        if (this.channel) {
            this.channel.close();
            console.log('[StorageSync] Disconnected');
        }
    }
}

// ===========================================
// SINGLETON INSTANCE
// ===========================================

export const storageSyncManager = new StorageSyncManager();

/**
 * Helper function to notify other tabs of storage change
 * 
 * Usage:
 * ```typescript
 * localStorage.setItem('safespot_settings_theme', 'dark');
 * notifyStorageChange('safespot_settings_theme', 'set');
 * ```
 */
export function notifyStorageChange(key: string, operation: 'set' | 'remove'): void {
    storageSyncManager.broadcast(key, operation);
}
