/**
 * SSE Connection Manager (v4.0 - Simplified Enterprise)
 * 
 * Strategy:
 * - One EventSource per Tab (KISS Principle).
 * - React Query handles invalidation.
 * - Browser handles connection limits (HTTP/2 multiplexing usually solves this).
 * - No complex leader election.
 */

type SSEListener = (event: MessageEvent) => void;
type ReconnectCallback = (lastEventId: string | null) => void;

class Backoff {
    private attempt = 0;
    private maxDelay = 15000;
    private baseDelay = 1000;

    getDelay() {
        const exponential = this.baseDelay * Math.pow(2, this.attempt);
        const cap = Math.min(exponential, this.maxDelay);
        this.attempt++;
        return Math.floor(Math.random() * cap); // Full Jitter
    }

    reset() {
        this.attempt = 0;
    }

    get count() { return this.attempt; }
}

class SSEPool {
    private connections = new Map<string, {
        source: EventSource | null;
        refCount: number;
        listeners: Map<string, Set<SSEListener>>;
        reconnectCallbacks: Set<ReconnectCallback>;
        backoff: Backoff;
    }>();

    subscribe(url: string, eventName: string, listener: SSEListener) {
        let entry = this.connections.get(url);

        if (!entry) {
            entry = {
                source: null,
                refCount: 0,
                listeners: new Map(),
                reconnectCallbacks: new Set(),
                backoff: new Backoff()
            };
            this.connections.set(url, entry);
        }

        entry.refCount++;
        if (!entry.listeners.has(eventName)) {
            entry.listeners.set(eventName, new Set());
        }
        entry.listeners.get(eventName)!.add(listener);

        if (!entry.source) {
            this.connect(url, entry);
        }

        return () => this.unsubscribe(url, eventName, listener);
    }

    private connect(url: string, entry: any) {
        if (!navigator.onLine) {
            console.log(`[SSE] ⏸️ Defaulting to offline mode for ${url}. Waiting for network...`);
            // We don't need to schedule retry here; the window 'online' event handled in App.tsx or useOnlineStatus should trigger a reconnect/refetch.
            // But for safety, we can check back in a bit.
            setTimeout(() => {
                if (entry.refCount > 0 && navigator.onLine) this.connect(url, entry);
            }, 5000);
            return;
        }

        console.log(`[SSE] Connecting to ${url}...`);

        try {
            const source = new EventSource(url);
            entry.source = source;

            source.onopen = () => {
                console.log(`[SSE] Connected to ${url}`);
                entry.backoff.reset();
                // Trigger any reconnect callbacks (Gap Recovery)
                entry.reconnectCallbacks.forEach((cb: any) => cb(null)); // TODO: Trace lastEventId if needed
            };

            source.onerror = () => {
                if (source.readyState === EventSource.CLOSED) {
                    // ENTERPRISE: Fail-Safe Limit
                    // If we fail 5 times (approx 30-60s of trying), we stop to save battery/data.
                    // The user is likely offline or the server is down.
                    const MAX_RETRIES = 5;

                    if (entry.backoff.count >= MAX_RETRIES) {
                        console.error(`[SSE] ❌ Connection failed after ${MAX_RETRIES} attempts. Giving up to save resources.`);
                        entry.source = null;
                        // TODO: Emit global 'connection-degraded' event if needed
                        return;
                    }

                    console.warn(`[SSE] Connection closed for ${url}. Reconnecting (Attempt ${entry.backoff.count + 1}/${MAX_RETRIES})...`);
                    source.close();
                    entry.source = null;

                    const delay = entry.backoff.getDelay();
                    setTimeout(() => {
                        if (entry.refCount > 0) this.connect(url, entry);
                    }, delay);
                }
            };

            // Proxy all events to listeners
            const dispatch = (e: MessageEvent) => {
                const listeners = entry.listeners.get(e.type) || entry.listeners.get('message');
                listeners?.forEach((fn: any) => fn(e));
            };

            // Hook standard events + wildcard
            source.onmessage = dispatch;
            // Add all custom event types we care about
            [
                'new-message', 'typing', 'messages-read', 'messages-delivered',
                'presence', 'connected', 'inbox-update',
                'notification', 'mark-read'
            ].forEach(evt => source.addEventListener(evt, dispatch));

        } catch (err) {
            console.error('[SSE] Fatal connection error', err);
        }
    }

    private unsubscribe(url: string, eventName: string, listener: SSEListener) {
        const entry = this.connections.get(url);
        if (!entry) return;

        entry.refCount--;
        entry.listeners.get(eventName)?.delete(listener);

        if (entry.refCount <= 0) {
            console.log(`[SSE] Closing connection to ${url}`);
            entry.source?.close();
            this.connections.delete(url);
        }
    }

    onReconnect(url: string, callback: ReconnectCallback) {
        let entry = this.connections.get(url);
        if (entry) {
            entry.reconnectCallbacks.add(callback);
        }
        return () => {
            entry?.reconnectCallbacks.delete(callback);
        }
    }
}

export const ssePool = new SSEPool();
