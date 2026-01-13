/**
 * SSE Connection Pool Manager (v2 - Enterprise Gap Recovery)
 * 
 * WhatsApp-Grade Features:
 * - Reference counting for connections
 * - Automatic cleanup when last listener unsubscribes
 * - Centralized event dispatching
 * - Last-Event-ID tracking for gap recovery
 * - Auto-reconnection with exponential backoff
 * - Reconnection callbacks for gap recovery triggers
 * 
 * Gap Recovery Flow:
 * 1. Each message event contains `lastEventId` field
 * 2. On disconnect, we store the last received ID
 * 3. On reconnect, we emit 'reconnected' event with lastEventId
 * 4. Consumer (useChatMessages) fetches gaps from backend
 */

type SSEListener = (event: MessageEvent) => void;
type ReconnectCallback = (lastEventId: string | null) => void;

interface SSEEntry {
    source: EventSource;
    refCount: number;
    listeners: Map<string, Set<SSEListener>>;
    reconnectCallbacks: Set<ReconnectCallback>;
    lastEventId: string | null;
    reconnectAttempts: number;
    isReconnecting: boolean;
}

class SSEPool {
    private connections = new Map<string, SSEEntry>();

    // Reconnection config
    private readonly INITIAL_RECONNECT_DELAY = 1000;  // 1s
    private readonly MAX_RECONNECT_DELAY = 30000;     // 30s
    private readonly MAX_RECONNECT_ATTEMPTS = 10;

    /**
     * Subscribe to an EventSource.
     * If the connection doesn't exist, it's created.
     */
    subscribe(url: string, eventName: string, listener: SSEListener) {
        let entry = this.connections.get(url);

        if (!entry) {
            entry = this.createConnection(url);
        }

        entry.refCount++;

        // Ensure the source is listening for this specific event type
        if (!entry.listeners.has(eventName)) {
            entry.listeners.set(eventName, new Set());
            this.attachEventListener(entry, url, eventName);
        }

        entry.listeners.get(eventName)!.add(listener);

        // Return unsubscribe function
        return () => this.unsubscribe(url, eventName, listener);
    }

    /**
     * Register a callback to be called on SSE reconnection.
     * Used by consumers to trigger gap recovery.
     */
    onReconnect(url: string, callback: ReconnectCallback): () => void {
        const entry = this.connections.get(url);
        if (!entry) {
            // If no connection yet, store for when it's created
            console.warn('[SSEPool] onReconnect called before connection exists');
            return () => { };
        }

        entry.reconnectCallbacks.add(callback);

        return () => {
            entry.reconnectCallbacks.delete(callback);
        };
    }

    /**
     * Get the last event ID for a connection (for manual gap recovery)
     */
    getLastEventId(url: string): string | null {
        return this.connections.get(url)?.lastEventId || null;
    }

    private createConnection(url: string): SSEEntry {
        const source = new EventSource(url);

        const entry: SSEEntry = {
            source,
            refCount: 0,
            listeners: new Map(),
            reconnectCallbacks: new Set(),
            lastEventId: null,
            reconnectAttempts: 0,
            isReconnecting: false
        };

        this.connections.set(url, entry);

        // Track Last-Event-ID from all incoming messages
        source.onmessage = (e) => {
            this.updateLastEventId(entry, e);
            this.dispatch(url, 'message', e);
        };

        // Enterprise reconnection handling
        source.onerror = () => {
            if (source.readyState === EventSource.CLOSED) {
                console.warn(`[SSEPool] Connection closed: ${url}`);
                this.handleDisconnect(url, entry);
            } else if (source.readyState === EventSource.CONNECTING) {
                // Browser is auto-reconnecting, we'll get onopen
                console.log(`[SSEPool] Reconnecting: ${url}`);
            }
        };

        source.onopen = () => {
            if (entry.isReconnecting) {
                console.log(`[SSEPool] ✅ Reconnected: ${url} (lastEventId: ${entry.lastEventId})`);
                entry.isReconnecting = false;
                entry.reconnectAttempts = 0;

                // Trigger gap recovery callbacks
                this.triggerReconnectCallbacks(entry);
            }
        };

        return entry;
    }

    private attachEventListener(entry: SSEEntry, url: string, eventName: string) {
        entry.source.addEventListener(eventName, (e) => {
            const msgEvent = e as MessageEvent;
            this.updateLastEventId(entry, msgEvent);
            this.dispatch(url, eventName, msgEvent);
        });
    }

    private updateLastEventId(entry: SSEEntry, event: MessageEvent) {
        // SSE spec: event.lastEventId contains the id field from server
        if (event.lastEventId) {
            entry.lastEventId = event.lastEventId;
        } else {
            // Fallback: try to extract from message data
            try {
                const data = JSON.parse(event.data);
                if (data.message?.id) {
                    entry.lastEventId = data.message.id;
                } else if (data.id) {
                    entry.lastEventId = data.id;
                }
            } catch {
                // Not JSON, ignore
            }
        }
    }

    private handleDisconnect(url: string, entry: SSEEntry) {
        if (entry.refCount <= 0) {
            // No subscribers, just clean up
            this.connections.delete(url);
            return;
        }

        // Mark as reconnecting and attempt to reconnect
        entry.isReconnecting = true;
        entry.reconnectAttempts++;

        if (entry.reconnectAttempts > this.MAX_RECONNECT_ATTEMPTS) {
            console.error(`[SSEPool] Max reconnect attempts reached for: ${url}`);
            // Notify listeners of permanent failure
            entry.reconnectCallbacks.forEach(cb => cb(null));
            return;
        }

        // Exponential backoff
        const delay = Math.min(
            this.INITIAL_RECONNECT_DELAY * Math.pow(2, entry.reconnectAttempts - 1),
            this.MAX_RECONNECT_DELAY
        );

        console.log(`[SSEPool] Reconnecting in ${delay}ms (attempt ${entry.reconnectAttempts})`);

        setTimeout(() => {
            if (!this.connections.has(url)) return; // Already cleaned up

            // Create new EventSource
            const oldListeners = entry.listeners;
            const newSource = new EventSource(url);
            entry.source = newSource;

            // Re-attach all event handlers
            newSource.onmessage = (e) => {
                this.updateLastEventId(entry, e);
                this.dispatch(url, 'message', e);
            };

            newSource.onerror = () => {
                if (newSource.readyState === EventSource.CLOSED) {
                    this.handleDisconnect(url, entry);
                }
            };

            newSource.onopen = () => {
                console.log(`[SSEPool] ✅ Reconnected: ${url}`);
                entry.isReconnecting = false;
                entry.reconnectAttempts = 0;
                this.triggerReconnectCallbacks(entry);
            };

            // Re-attach event listeners
            oldListeners.forEach((_, eventName) => {
                if (eventName !== 'message') {
                    newSource.addEventListener(eventName, (e) => {
                        const msgEvent = e as MessageEvent;
                        this.updateLastEventId(entry, msgEvent);
                        this.dispatch(url, eventName, msgEvent);
                    });
                }
            });
        }, delay);
    }

    private triggerReconnectCallbacks(entry: SSEEntry) {
        const lastEventId = entry.lastEventId;
        entry.reconnectCallbacks.forEach(cb => {
            try {
                cb(lastEventId);
            } catch (err) {
                console.error('[SSEPool] Error in reconnect callback:', err);
            }
        });
    }

    private unsubscribe(url: string, eventName: string, listener: SSEListener) {
        const entry = this.connections.get(url);
        if (!entry) return;

        const eventListeners = entry.listeners.get(eventName);
        if (eventListeners) {
            eventListeners.delete(listener);
            if (eventListeners.size === 0) {
                entry.listeners.delete(eventName);
            }
        }

        entry.refCount--;

        if (entry.refCount <= 0) {
            entry.source.close();
            this.connections.delete(url);
            console.log(`[SSEPool] Closed connection: ${url}`);
        }
    }

    private dispatch(url: string, eventName: string, event: MessageEvent) {
        const entry = this.connections.get(url);
        if (!entry) return;

        const eventListeners = entry.listeners.get(eventName);
        if (eventListeners) {
            eventListeners.forEach(fn => {
                try {
                    fn(event);
                } catch (err) {
                    console.error(`[SSEPool] Error in listener for ${url}/${eventName}:`, err);
                }
            });
        }
    }
}

export const ssePool = new SSEPool();
