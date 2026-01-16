/**
 * SSE Connection Pool Manager (v3.5 - Enterprise Resilience)
 * 
 * Capability:
 * - Single EventSource per URL (Leader Election via BroadcastChannel)
 * - Enterprise Retry Strategy: Exponential Backoff + Jitter
 * - Structured Observability: Standardized logs
 * - Gap Recovery: Watermark tracking
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
    wasEverConnected: boolean;
    backoff: Backoff; // ✅ Resilience: Per-connection backoff state
}

/**
 * Enterprise Backoff Strategy
 * Full Jitter: Sleep = random_between(0, min(cap, base * 2 ** attempt))
 */
class Backoff {
    private attempt = 0;
    private maxDelay = 30000; // Cap at 30s
    private baseDelay = 1000; // Start at 1s

    getDelay() {
        const exponential = this.baseDelay * Math.pow(2, this.attempt);
        const cap = Math.min(exponential, this.maxDelay);
        this.attempt++;
        // Full Jitter
        return Math.floor(Math.random() * cap);
    }

    reset() {
        if (this.attempt > 0) {
            console.log(`[SSE-Backoff] Resetting attempts (was ${this.attempt})`);
        }
        this.attempt = 0;
    }

    get count() { return this.attempt; }
}

class SSEPool {
    private connections = new Map<string, SSEEntry>();

    constructor() {
        broadcast.onmessage = (event) => this.handleBroadcast(event);
        window.addEventListener('beforeunload', () => this.cleanupOnUnload());
    }

    subscribe(url: string, eventName: string, listener: SSEListener) {
        let entry = this.connections.get(url);
        let needsConnection = false;

        if (!entry) {
            // ✅ Monitoring: Check for browser connection limits
            // Browsers (Chrome/Safari) often limit to 6 connections per domain.
            if (this.connections.size >= 4) {
                console.warn(`[SSE-Monitor] ⚠️ High connection count detected (${this.connections.size + 1}). Browser limit is ~6. Potential starvation.`);
            }

            entry = {
                source: null,
                isOwner: false,
                refCount: 0,
                listeners: new Map(),
                reconnectCallbacks: new Set(),
                lastEventId: null,
                wasEverConnected: false,
                backoff: new Backoff() // ✅ Init Backoff
            };
            this.connections.set(url, entry);
            needsConnection = true;
        } else if (!entry.source && !entry.isOwner && entry.refCount === 0) {
            needsConnection = true;
        }

        entry.refCount++;

        if (!entry.listeners.has(eventName)) {
            entry.listeners.set(eventName, new Set());
        }
        entry.listeners.get(eventName)!.add(listener);

        if (needsConnection) {
            this.requestConnectionOwnership(url);
        }

        return () => this.unsubscribe(url, eventName, listener);
    }

    private requestConnectionOwnership(url: string) {
        const entry = this.connections.get(url);
        // Don't request if we already have a source or are waiting for one
        // Simpler check prevents spamming ownership queries

        broadcast.postMessage({ type: 'OWNERSHIP_QUERY', url, tabId: TAB_ID });

        // Wait random time before assuming leadership to allow ACK
        setTimeout(() => {
            const currentEntry = this.connections.get(url);
            if (currentEntry && !currentEntry.isOwner && !currentEntry.source) {
                console.log(`[SSE-Pool] 👑 Becoming Leader for ${url}`);
                this.establishConnection(url, currentEntry);
            }
        }, 300 + Math.random() * 200);
    }

    private establishConnection(url: string, entry: SSEEntry) {
        if (entry.source) entry.source.close();

        const wasConnected = entry.wasEverConnected;

        console.log(`[SSE-Connect] Attempting connection to ${url} (Attempt ${entry.backoff.count + 1})`);

        const source = new EventSource(url);
        entry.source = source;
        entry.isOwner = true;

        source.onmessage = (e) => this.forwardEvent(url, 'message', e);

        // Standard events
        ['new-comment', 'comment-update', 'comment-delete', 'report-update', 'notification', 'presence-update'].forEach(name => {
            source.addEventListener(name, (e) => this.forwardEvent(url, name, e as MessageEvent));
        });

        // Chat & Realtime events
        ['new-message', 'typing', 'messages-read', 'messages-delivered', 'presence', 'connected', 'inbox-update', 'pin-update', 'chat-update', 'chat-rollback'].forEach(name => {
            source.addEventListener(name, (e) => this.forwardEvent(url, name, e as MessageEvent));
        });

        source.onopen = () => {
            console.log(`[SSE-State] ✅ Connected: ${url}`);

            // ✅ Resilience: Reset backoff on successful connection
            entry.backoff.reset();
            entry.wasEverConnected = true;

            broadcast.postMessage({ type: 'OWNER_ANNOUNCE', url, tabId: TAB_ID });

            // ✅ Gap Recovery Trigger
            if (wasConnected && entry.reconnectCallbacks.size > 0) {
                console.log(`[SSE-Recovery] 🔄 Triggering ${entry.reconnectCallbacks.size} callbacks`);
                entry.reconnectCallbacks.forEach(cb => {
                    try { cb(entry.lastEventId); } catch (e) { console.error('[SSE-Error] Recovery callback failed:', e); }
                });

                broadcast.postMessage({
                    type: 'SSE_RECONNECTED',
                    url,
                    lastEventId: entry.lastEventId,
                    tabId: TAB_ID
                });
            }
        };

        source.onerror = () => {
            // EventSource auto-retries by default, but lacks control.
            // We close it to impose our own Backoff strategy.
            if (source.readyState === EventSource.CLOSED || source.readyState === EventSource.CONNECTING) {
                console.warn(`[SSE-State] ⚠️ Connection lost: ${url}`);
                entry.source?.close();
                entry.source = null;
                entry.isOwner = true; // Keep ownership logic during retry

                // ✅ Resilience: Calculate Backoff Delay
                const delay = entry.backoff.getDelay();
                console.log(`[SSE-Retry] ⏳ Waiting ${delay}ms before reconnecting...`);

                setTimeout(() => {
                    // Check if we still need this connection (user might have navigated away)
                    if (this.connections.has(url) && this.connections.get(url)?.refCount! > 0) {
                        this.establishConnection(url, entry);
                    }
                }, delay);
            }
        };
    }


    private forwardEvent(url: string, eventName: string, event: MessageEvent) {
        const entry = this.connections.get(url);
        if (!entry) return;

        if (event.lastEventId) {
            entry.lastEventId = event.lastEventId;
        }

        this.dispatchLocally(url, eventName, event);

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
                        if (tabId < TAB_ID) {
                            console.warn(`[SSE-Pool] 🏳️ Yielding leadership for ${url} to ${tabId}`);
                            entry.isOwner = false;
                            entry.source?.close();
                            entry.source = null;
                            // Reset backoff as we are now follower
                            entry.backoff.reset();
                        }
                    } else {
                        // Found owner, ensure we are clean
                        if (entry.source) entry.source.close();
                        entry.source = null;
                    }
                }
                break;

            case 'SSE_EVENT':
                if (entry && !entry.isOwner) {
                    if (lastEventId) entry.lastEventId = lastEventId;
                    const mockEvent = new MessageEvent(eventName, { data, lastEventId });
                    this.dispatchLocally(url, eventName, mockEvent);
                }
                break;

            case 'SSE_RECONNECTED':
                if (entry && !entry.isOwner && tabId !== TAB_ID && entry.reconnectCallbacks.size > 0) {
                    console.log(`[SSE-Recovery] 🔄 Follower triggering recovery`);
                    entry.reconnectCallbacks.forEach(cb => {
                        try { cb(lastEventId); } catch (e) { console.error('[SSE-Error] Follower recovery failed:', e); }
                    });
                }
                break;

            case 'OWNER_RETIRE':
                // Previous owner died. If we are monitoring this URL, we might need to step up.
                // We rely on random timeout in requestConnectionOwnership usually, but we could trigger election.
                if (entry && !entry.isOwner) {
                    console.log(`[SSE-Pool] Owner retired for ${url}, unexpected vacancy.`);
                    this.requestConnectionOwnership(url);
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
            console.log(`[SSE-Cleanup] Closing idle connection: ${url}`);
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

    onReconnect(url: string, callback: ReconnectCallback): () => void {
        let entry = this.connections.get(url);

        if (!entry) {
            entry = {
                source: null,
                isOwner: false,
                refCount: 0,
                listeners: new Map(),
                reconnectCallbacks: new Set(),
                lastEventId: null,
                wasEverConnected: false,
                backoff: new Backoff()
            };
            this.connections.set(url, entry);
        }

        entry.reconnectCallbacks.add(callback);
        return () => {
            const currentEntry = this.connections.get(url);
            currentEntry?.reconnectCallbacks.delete(callback);
        };
    }
}

export const ssePool = new SSEPool();
