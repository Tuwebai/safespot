/**
 * SSE Connection Manager (v5.0 - Enterprise Resilient)
 * 
 * Capabilities:
 * - Sleep/Wake support for background tabs.
 * - Infinite Backoff (capped) for persistent network issues.
 * - Visibility awareness.
 */

type SSEListener = (event: MessageEvent) => void;
type ReconnectCallback = (lastEventId: string | null) => void;

class Backoff {
    private attempt = 0;
    private maxDelay = 60000; // Cap at 60s
    private baseDelay = 1000;

    getDelay() {
        const exponential = this.baseDelay * Math.pow(2, this.attempt);
        const cap = Math.min(exponential, this.maxDelay);
        this.attempt++;
        return Math.floor(Math.random() * cap * 0.5 + cap * 0.5); // Jitter
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
        isSleeping: boolean;
        url: string; // Store URL for reconnection
    }>();

    private isGlobalSleep = false;

    subscribe(url: string, eventName: string, listener: SSEListener) {
        let entry = this.connections.get(url);

        if (!entry) {
            entry = {
                source: null,
                refCount: 0,
                listeners: new Map(),
                reconnectCallbacks: new Set(),
                backoff: new Backoff(),
                isSleeping: false,
                url: url
            };
            this.connections.set(url, entry);
        }

        entry.refCount++;
        if (!entry.listeners.has(eventName)) {
            entry.listeners.set(eventName, new Set());
        }
        entry.listeners.get(eventName)!.add(listener);

        if (!entry.source && !this.isGlobalSleep && !entry.isSleeping) {
            this.connect(entry);
        }

        return () => this.unsubscribe(url, eventName, listener);
    }

    /**
     * Called when tab goes into background (save battery/data)
     */
    sleep() {
        console.log('[SSE] 💤 Sleeping all connections');
        this.isGlobalSleep = true;
        this.connections.forEach(entry => {
            entry.isSleeping = true;
            if (entry.source) {
                entry.source.close();
                entry.source = null;
            }
        });
    }

    /**
     * Called when tab becomes visible (restore realtime)
     */
    wake() {
        if (!this.isGlobalSleep) return;

        console.log('[SSE] ☀️ Waking up connections');
        this.isGlobalSleep = false;
        this.connections.forEach(entry => {
            entry.isSleeping = false;
            if (entry.refCount > 0 && !entry.source) {
                entry.backoff.reset(); // Reset backoff for eager reconnect
                this.connect(entry);
            }
        });
    }

    private connect(entry: any) {
        if (this.isGlobalSleep || entry.isSleeping) return; // Don't connect if sleeping

        if (!navigator.onLine) {
            // Wait for online event handled by Bootstrap
            return;
        }

        const url = entry.url;
        // console.debug(`[SSE] Connecting to ${url}...`);

        try {
            const source = new EventSource(url);
            entry.source = source;

            source.onopen = () => {
                // console.debug(`[SSE] Connected to ${url}`);
                entry.backoff.reset();
                entry.reconnectCallbacks.forEach((cb: any) => cb(null));
            };

            source.onerror = () => {
                if (source.readyState === EventSource.CLOSED) {
                    source.close();
                    entry.source = null;

                    // ENTERPRISE: Infinite Backoff (Never give up while visible)
                    // If we are visible, we must keep trying, but slowly.
                    const delay = entry.backoff.getDelay();

                    if (entry.backoff.count % 5 === 0) {
                        console.warn(`[SSE] Connection struggling for ${url}. Next retry in ${delay}ms. (Attempt ${entry.backoff.count})`);
                        // Notify Lifecycle Engine of persistent failure
                        window.dispatchEvent(new CustomEvent('safespot:sse_struggle', { detail: { url, attempts: entry.backoff.count } }));
                    }

                    setTimeout(() => {
                        if (entry.refCount > 0 && !this.isGlobalSleep) this.connect(entry);
                    }, delay);
                }
            };

            // Proxy all events to listeners
            const dispatch = (e: MessageEvent) => {
                const listeners = entry.listeners.get(e.type) || entry.listeners.get('message');
                listeners?.forEach((fn: any) => fn(e));
            };

            source.onmessage = dispatch;
            [
                'new-message', 'typing', 'messages-read', 'messages-delivered',
                'presence', 'connected', 'inbox-update',
                'notification', 'mark-read'
            ].forEach(evt => source.addEventListener(evt, dispatch));

        } catch (err) {
            console.error('[SSE] Fatal connection error', err);
            // Retry anyway
            setTimeout(() => this.connect(entry), 5000);
        }
    }

    private unsubscribe(url: string, eventName: string, listener: SSEListener) {
        const entry = this.connections.get(url);
        if (!entry) return;

        entry.refCount--;
        entry.listeners.get(eventName)?.delete(listener);

        if (entry.refCount <= 0) {
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

    isConnectionHealthy(): boolean {
        // A simple heuristic: if we have any active sources, we are mostly healthy.
        // Or we could check if any are in CONNECTING state.
        if (this.connections.size === 0) return false;

        for (const [_, entry] of this.connections) {
            if (entry.source && entry.source.readyState === EventSource.OPEN) {
                return true;
            }
        }
        return false;
    }
}

export const ssePool = new SSEPool();
