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

        if (!entry) {
            entry = {
                source: null,
                isOwner: false,
                refCount: 0,
                listeners: new Map(),
                reconnectCallbacks: new Set(),
                lastEventId: null
            };
            this.connections.set(url, entry);
            this.requestConnectionOwnership(url);
        }

        entry.refCount++;

        if (!entry.listeners.has(eventName)) {
            entry.listeners.set(eventName, new Set());
        }
        entry.listeners.get(eventName)!.add(listener);

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

        const source = new EventSource(url);
        entry.source = source;
        entry.isOwner = true;

        source.onmessage = (e) => this.forwardEvent(url, 'message', e);

        // Standard events
        ['new-comment', 'comment-update', 'comment-delete', 'report-update', 'notification', 'presence-update'].forEach(name => {
            source.addEventListener(name, (e) => this.forwardEvent(url, name, e as MessageEvent));
        });

        source.onopen = () => {
            console.log(`[SSEPool] ✅ Connection established (Leader): ${url}`);
            broadcast.postMessage({ type: 'OWNER_ANNOUNCE', url, tabId: TAB_ID });
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
                    const mockEvent = new MessageEvent(eventName, { data, lastEventId });
                    this.dispatchLocally(url, eventName, mockEvent);
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

    // Gap recovery callback kept for API compatibility
    onReconnect(_url: string, _callback: ReconnectCallback): () => void {
        return () => { }; // Simplified for now
    }
}

export const ssePool = new SSEPool();
