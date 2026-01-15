/**
 * SSE Connection Pool Manager (v3 - Multi-Tab Shared Singleton)
 * 
 * Solving ERR_INSUFFICIENT_RESOURCES:
 * - Only 1 real EventSource per URL across ALL browser tabs.
 * - Uses BroadcastChannel to distribute events to other tabs.
 * - Simple Leader Election: First tab to request URL connects, others listen.
 */

const TAB_ID = Math.random().toString(36).substring(2, 11);
const broadcast = new BroadcastChannel('safespot-sse-pool');

type SSEListener = (event: MessageEvent) => void;
type ReconnectCallback = (lastEventId: string | null) => void;

interface SSEEntry {
    source: EventSource | null;
    isOwner: boolean;
    refCount: number;
    listeners: Map<string, Set<SSEListener>>;
    reconnectCallbacks: Set<ReconnectCallback>;
    lastEventId: string | null;
    wasEverConnected: boolean;  // ✅ Track if connection was ever established
}

class SSEPool {
    private connections = new Map<string, SSEEntry>();

    constructor() {
        broadcast.onmessage = (event) => this.handleBroadcast(event);
        // Clean up connections on tab close
        window.addEventListener('beforeunload', () => this.cleanupOnUnload());
    }

    subscribe(url: string, eventName: string, listener: SSEListener) {
        let entry = this.connections.get(url);
        let needsConnection = false;

        if (!entry) {
            entry = {
                source: null,
                isOwner: false,
                refCount: 0,
                listeners: new Map(),
                reconnectCallbacks: new Set(),
                lastEventId: null,
                wasEverConnected: false
            };
            this.connections.set(url, entry);
            needsConnection = true;
        } else if (!entry.source && !entry.isOwner && entry.refCount === 0) {
            // Entry exists (e.g., from onReconnect) but no connection yet
            needsConnection = true;
        }

        entry.refCount++;

        if (!entry.listeners.has(eventName)) {
            entry.listeners.set(eventName, new Set());
        }
        entry.listeners.get(eventName)!.add(listener);

        // Request connection AFTER setting up listener
        if (needsConnection) {
            this.requestConnectionOwnership(url);
        }

        return () => this.unsubscribe(url, eventName, listener);
    }

    private requestConnectionOwnership(url: string) {
        // Broadcast that we want to connect. If no one responds "I am owner", we take it.
        broadcast.postMessage({ type: 'OWNERSHIP_QUERY', url, tabId: TAB_ID });

        // If no one claims ownership in 300ms, we become the owner
        setTimeout(() => {
            const entry = this.connections.get(url);
            if (entry && !entry.isOwner && !entry.source) {
                console.log(`[SSEPool] No owner for ${url}, becoming leader.`);
                this.establishConnection(url, entry);
            }
        }, 300 + Math.random() * 200);
    }

    private establishConnection(url: string, entry: SSEEntry) {
        if (entry.source) entry.source.close();

        // ✅ GAP RECOVERY: Track if this is a reconnection (not first connection)
        const wasConnected = entry.wasEverConnected;

        const source = new EventSource(url);
        entry.source = source;
        entry.isOwner = true;

        source.onmessage = (e) => this.forwardEvent(url, 'message', e);

        // Standard events for comments/reports
        ['new-comment', 'comment-update', 'comment-delete', 'report-update', 'notification', 'presence-update'].forEach(name => {
            source.addEventListener(name, (e) => this.forwardEvent(url, name, e as MessageEvent));
        });

        // ✅ FIX: Chat-specific events (were missing!)
        // Includes: room events + user inbox events (chat-update, chat-rollback)
        ['new-message', 'typing', 'messages-read', 'messages-delivered', 'presence', 'connected', 'inbox-update', 'pin-update', 'chat-update', 'chat-rollback'].forEach(name => {
            source.addEventListener(name, (e) => this.forwardEvent(url, name, e as MessageEvent));
        });

        source.onopen = () => {
            console.log(`[SSEPool] ✅ Connection established (Leader): ${url}`);
            broadcast.postMessage({ type: 'OWNER_ANNOUNCE', url, tabId: TAB_ID });

            // ✅ Mark as connected for future reconnection detection
            entry.wasEverConnected = true;

            // ✅ GAP RECOVERY: If this was a reconnection, trigger callbacks
            if (wasConnected && entry.reconnectCallbacks.size > 0) {
                console.log(`[SSEPool] 🔄 Reconnection detected, triggering ${entry.reconnectCallbacks.size} recovery callback(s)`);
                entry.reconnectCallbacks.forEach(cb => {
                    try {
                        cb(entry.lastEventId);
                    } catch (e) {
                        console.error('[SSEPool] Recovery callback error:', e);
                    }
                });
                // Broadcast to follower tabs so they can also recover
                broadcast.postMessage({
                    type: 'SSE_RECONNECTED',
                    url,
                    lastEventId: entry.lastEventId,
                    tabId: TAB_ID
                });
            }
        };

        source.onerror = () => {
            if (source.readyState === EventSource.CLOSED) {
                entry.isOwner = false;
                entry.source = null;
                setTimeout(() => this.requestConnectionOwnership(url), 2000);
            }
        };
    }


    private forwardEvent(url: string, eventName: string, event: MessageEvent) {
        const entry = this.connections.get(url);
        if (!entry) return;

        // ✅ GAP RECOVERY: Track lastEventId for watermark
        if (event.lastEventId) {
            entry.lastEventId = event.lastEventId;
        }

        // 1. Dispatch locally
        this.dispatchLocally(url, eventName, event);

        // 2. Broadcast to other tabs
        broadcast.postMessage({
            type: 'SSE_EVENT',
            url,
            eventName,
            data: event.data,
            lastEventId: event.lastEventId
        });
    }

    private handleBroadcast(event: MessageEvent) {
        const { type, url, eventName, data, lastEventId, tabId } = event.data;

        const entry = this.connections.get(url);

        switch (type) {
            case 'OWNERSHIP_QUERY':
                if (entry?.isOwner && entry.source?.readyState === EventSource.OPEN) {
                    broadcast.postMessage({ type: 'OWNER_ANNOUNCE', url, tabId: TAB_ID });
                }
                break;

            case 'OWNER_ANNOUNCE':
                if (entry && tabId !== TAB_ID) {
                    if (entry.isOwner) {
                        // Conflict resolution: lower tabId wins
                        if (tabId < TAB_ID) {
                            console.warn(`[SSEPool] Relinquishing ownership of ${url} to ${tabId}`);
                            entry.isOwner = false;
                            entry.source?.close();
                            entry.source = null;
                        }
                    } else {
                        // We found an owner
                        if (entry.source) entry.source.close();
                        entry.source = null;
                    }
                }
                break;

            case 'SSE_EVENT':
                if (entry && !entry.isOwner) {
                    // ✅ GAP RECOVERY: Track lastEventId for follower tabs too
                    if (lastEventId) {
                        entry.lastEventId = lastEventId;
                    }
                    const mockEvent = new MessageEvent(eventName, { data, lastEventId });
                    this.dispatchLocally(url, eventName, mockEvent);
                }
                break;

            case 'SSE_RECONNECTED':
                // ✅ GAP RECOVERY: Follower tabs should also trigger their recovery callbacks
                if (entry && !entry.isOwner && tabId !== TAB_ID && entry.reconnectCallbacks.size > 0) {
                    console.log(`[SSEPool] 🔄 Follower tab received reconnect signal for ${url}`);
                    entry.reconnectCallbacks.forEach(cb => {
                        try {
                            cb(lastEventId);
                        } catch (e) {
                            console.error('[SSEPool] Follower recovery callback error:', e);
                        }
                    });
                }
                break;
        }
    }

    private dispatchLocally(url: string, eventName: string, event: MessageEvent) {
        const entry = this.connections.get(url);
        if (!entry) return;

        const listeners = entry.listeners.get(eventName);
        if (listeners) {
            listeners.forEach(fn => fn(event));
        }
    }

    private unsubscribe(url: string, eventName: string, listener: SSEListener) {
        const entry = this.connections.get(url);
        if (!entry) return;

        entry.refCount--;
        entry.listeners.get(eventName)?.delete(listener);

        if (entry.refCount <= 0) {
            if (entry.isOwner && entry.source) {
                entry.source.close();
            }
            this.connections.delete(url);
        }
    }

    private cleanupOnUnload() {
        this.connections.forEach((entry, url) => {
            if (entry.isOwner && entry.source) {
                entry.source.close();
                broadcast.postMessage({ type: 'OWNER_RETIRE', url, tabId: TAB_ID });
            }
        });
    }

    /**
     * Register a callback to be called when SSE reconnects after a disconnection.
     * Used for gap recovery (fetching missed messages).
     * 
     * @param url - SSE endpoint URL
     * @param callback - Function called with lastEventId on reconnection
     * @returns Unsubscribe function
     */
    onReconnect(url: string, callback: ReconnectCallback): () => void {
        let entry = this.connections.get(url);

        if (!entry) {
            // Create entry if not exists (listener might register before subscribe)
            entry = {
                source: null,
                isOwner: false,
                refCount: 0,
                listeners: new Map(),
                reconnectCallbacks: new Set(),
                lastEventId: null,
                wasEverConnected: false
            };
            this.connections.set(url, entry);
        }

        entry.reconnectCallbacks.add(callback);
        console.log(`[SSEPool] Registered reconnect callback for ${url} (total: ${entry.reconnectCallbacks.size})`);

        return () => {
            const currentEntry = this.connections.get(url);
            currentEntry?.reconnectCallbacks.delete(callback);
        };
    }
}

export const ssePool = new SSEPool();
