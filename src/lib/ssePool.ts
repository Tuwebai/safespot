import { Backoff } from '@/engine/traffic/Backoff';
import { telemetry, TelemetrySeverity } from '@/lib/telemetry/TelemetryEngine';
import { leaderElection, LeadershipState } from './realtime/LeaderElection';

type SSEListener = (event: MessageEvent) => void;
type ReconnectCallback = (lastEventId: string | null) => void;

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

    constructor() {
        // 🔄 Sync connections when leadership changes
        leaderElection.onChange((state) => {
            if (state === LeadershipState.LEADING) {
                // console.debug('[SSEPool] 👑 Became Leader. Activating connections...');
                this.connections.forEach(entry => {
                    if (!entry.source && entry.refCount > 0) {
                        this.connect(entry);
                    }
                });
            } else {
                // console.debug('[SSEPool] 👥 Became Follower. Closing connections...');
                this.connections.forEach(entry => {
                    if (entry.source) {
                        entry.source.close();
                        entry.source = null;
                    }
                });
            }
        });
    }

    subscribe(url: string, eventName: string, listener: SSEListener) {
        let entry = this.connections.get(url);

        if (!entry) {
            entry = {
                source: null,
                refCount: 0,
                listeners: new Map(),
                reconnectCallbacks: new Set(),
                backoff: new Backoff(),
                isSleeping: false, // Legacy field, kept for internal structure for now but ignored logic-wise
                url: url
            };
            this.connections.set(url, entry);
        }

        entry.refCount++;
        if (!entry.listeners.has(eventName)) {
            entry.listeners.set(eventName, new Set());
        }
        entry.listeners.get(eventName)!.add(listener);

        if (!entry.source) {
            this.connect(entry);
        }

        return () => this.unsubscribe(url, eventName, listener);
    }

    /**
     * 🧠 ENTERPRISE FIX: SSE is now IMMORTAL.
     * We no longer sleep or wake connections based on tab visibility.
     * The OS/Browser will manage resources, but we never voluntarily disconnect.
     */
    sleep() {
        console.log('[SSE] 🛡️ Sleep ignored: Connection is now persistent/immortal.');
    }

    wake() {
        console.log('[SSE] 🛡️ Wake ignored: Connection was already persistent.');
    }

    private connect(entry: any) {
        if (!navigator.onLine || !leaderElection.isLeader()) {
            return;
        }

        const url = entry.url;
        const SHARED_BACKOFF_KEY = `safespot_backoff_${url}`;

        // Restore backoff state from shared storage if available
        const storedAttempt = localStorage.getItem(SHARED_BACKOFF_KEY);
        if (storedAttempt) {
            entry.backoff.setAttempt(parseInt(storedAttempt, 10));
        }
        // console.debug(`[SSE] Connecting to ${url}...`);

        try {
            const source = new EventSource(url);
            entry.source = source;

            source.onopen = () => {
                // console.debug(`[SSE] Connected to ${url}`);

                // 📡 MOTOR 8: Trace Connection
                telemetry.emit({
                    engine: 'SSE',
                    severity: TelemetrySeverity.SIGNAL,
                    payload: { action: 'connected', url }
                });

                entry.backoff.reset();
                localStorage.removeItem(SHARED_BACKOFF_KEY);
                entry.reconnectCallbacks.forEach((cb: any) => cb(null));
            };

            source.onerror = () => {
                if (source.readyState === EventSource.CLOSED) {
                    source.close();
                    entry.source = null;

                    // ENTERPRISE: Infinite Backoff (Never give up while visible)
                    // If we are visible, we must keep trying, but slowly.
                    const delay = entry.backoff.getDelay();

                    // 📡 MOTOR 8: Trace Error/Retry
                    telemetry.emit({
                        engine: 'SSE',
                        severity: TelemetrySeverity.WARN,
                        payload: { action: 'connection_lost', url, retryIn: delay, attempt: entry.backoff.count }
                    });

                    // Persist backoff state for other tabs (failover sync)
                    localStorage.setItem(SHARED_BACKOFF_KEY, entry.backoff.count.toString());

                    if (entry.backoff.count % 5 === 0) {
                        console.warn(`[SSE] Connection struggling for ${url}. Next retry in ${delay}ms. (Attempt ${entry.backoff.count})`);
                        // Notify Lifecycle Engine of persistent failure
                        window.dispatchEvent(new CustomEvent('safespot:sse_struggle', { detail: { url, attempts: entry.backoff.count } }));
                    }

                    setTimeout(() => {
                        if (entry.refCount > 0) this.connect(entry);
                    }, delay);
                }
            };

            // Proxy all events to listeners
            const dispatch = (e: MessageEvent) => {
                // 📡 MOTOR 8: Root Trace Generation (Fase D/Motor 8 Completion)
                // We stamp the event to propagate the traceId without breaking the public SSEListener contract
                const traceId = telemetry.startTrace();
                (e as any).traceId = traceId;

                telemetry.emit({
                    engine: 'SSE',
                    severity: TelemetrySeverity.DEBUG,
                    traceId,
                    payload: {
                        action: 'event_received',
                        type: e.type,
                        url: entry.url,
                        timestamp: Date.now()
                    }
                });

                // 1. Specific listeners for this event type
                const specificListeners = entry.listeners.get(e.type);
                specificListeners?.forEach((fn: any) => fn(e));

                // 2. 👑 Spy/Global listeners (the Orchestrator)
                // We notify 'message' for EVERY event unless the type is already 'message' (to avoid double call)
                if (e.type !== 'message') {
                    const globalListeners = entry.listeners.get('message');
                    globalListeners?.forEach((fn: any) => fn(e));
                }
            };

            source.onmessage = dispatch;
            [
                'new-message',
                'message.delivered',
                'message.read',
                'typing',
                'presence',
                'presence-update',
                'chat-update',
                'chat-rollback',
                'message-reaction',
                'message-pinned',
                'connected',
                'inbox-update',
                'notification',
                'mark-read',
                'report-update',
                'report-create',
                'report-delete',
                'comment-update',
                'comment-delete'
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
