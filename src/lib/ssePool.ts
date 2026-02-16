import { Backoff } from '@/engine/traffic/Backoff';
import { telemetry, TelemetrySeverity } from '@/lib/telemetry/TelemetryEngine';
import { leaderElection, LeadershipState } from './realtime/LeaderElection';

type SSEListener = (event: MessageEvent) => void;
type ReconnectCallback = (lastEventId: string | null) => void;

// ✅ ENTERPRISE: SSE State Machine Types
export enum SSEState {
    OFFLINE = 'OFFLINE',           // No network or no subscriptions
    DISCONNECTED = 'DISCONNECTED', // Active subscriptions but source closed
    CONNECTING = 'CONNECTING',     // Attempting to open EventSource
    CONNECTED = 'CONNECTED',       // Active and receiving events
    IDLE_SLEEP = 'IDLE_SLEEP'      // Follower idle (>5min), connection paused
}

interface SSEConnectionEntry {
    source: EventSource | null;
    refCount: number;
    listeners: Map<string, Set<SSEListener>>;
    reconnectCallbacks: Set<ReconnectCallback>;
    backoff: Backoff;
    state: SSEState;
    url: string;
}

class SSEPool {
    private connections = new Map<string, SSEConnectionEntry>();
    private idleTimer: number | null = null;
    private readonly IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
    private isUserIdle = false;

    constructor() {
        if (typeof window !== 'undefined') {
            this.setupIdleDetection();
        }

        // 🔄 Sync connections when leadership changes
        leaderElection.onChange((state) => {
            this.handleLeadershipChange(state);
        });
    }

    private setupIdleDetection() {
        const resetIdle = () => {
            if (this.isUserIdle) {
                // console.debug('[SSEPool] 🏃 User active. Waking up followers...');
                this.isUserIdle = false;
                this.wake();
            }

            if (this.idleTimer) window.clearTimeout(this.idleTimer);
            this.idleTimer = window.setTimeout(() => {
                // console.debug('[SSEPool] 😴 User idle detected.');
                this.isUserIdle = true;
                this.enterIdleMode();
            }, this.IDLE_TIMEOUT);
        };

        const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'visibilitychange'];
        events.forEach(evt => {
            window.addEventListener(evt, resetIdle, { passive: true });
        });
        resetIdle();
    }

    private handleLeadershipChange(state: LeadershipState) {
        this.connections.forEach(entry => {
            if (state === LeadershipState.LEADING) {
                // Leader ALWAYS connects if there are subscribers
                if (entry.refCount > 0 && entry.state !== SSEState.CONNECTED) {
                    this.transition(entry, SSEState.CONNECTING);
                }
            } else {
                // Follower: Pause if idle
                if (this.isUserIdle && entry.state !== SSEState.IDLE_SLEEP) {
                    this.transition(entry, SSEState.IDLE_SLEEP);
                }
            }
        });
    }

    private enterIdleMode() {
        if (leaderElection.isLeader()) return; // Leader never sleeps

        this.connections.forEach(entry => {
            if (entry.state === SSEState.CONNECTED || entry.state === SSEState.CONNECTING) {
                this.transition(entry, SSEState.IDLE_SLEEP);
            }
        });
    }

    private wake() {
        this.connections.forEach(entry => {
            if (entry.state === SSEState.IDLE_SLEEP && entry.refCount > 0) {
                // When waking up, we trigger catchup via Orchestrator (external to this class)
                this.transition(entry, SSEState.CONNECTING);

                // Trigger Catchup Signal
                window.dispatchEvent(new CustomEvent('safespot:sse_wake', { detail: { url: entry.url } }));
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
                state: SSEState.DISCONNECTED,
                url: url
            };
            this.connections.set(url, entry);
        }

        entry.refCount++;
        if (!entry.listeners.has(eventName)) {
            entry.listeners.set(eventName, new Set());
        }
        entry.listeners.get(eventName)!.add(listener);

        // Auto-connect if not connected and we have permission
        if (entry.state === SSEState.DISCONNECTED || entry.state === SSEState.OFFLINE) {
            this.transition(entry, SSEState.CONNECTING);
        }

        return () => this.unsubscribe(url, eventName, listener);
    }

    private unsubscribe(url: string, eventName: string, listener: SSEListener) {
        const entry = this.connections.get(url);
        if (!entry) return;

        entry.refCount--;
        entry.listeners.get(eventName)?.delete(listener);

        if (entry.refCount <= 0) {
            this.transition(entry, SSEState.DISCONNECTED);
            this.connections.delete(url);
        }
    }

    // 🧠 Central State Transition Logic
    private transition(entry: SSEConnectionEntry, newState: SSEState) {
        const oldState = entry.state;
        if (oldState === newState) return;

        // console.debug(`[SSEPool] ${entry.url} transition: ${oldState} -> ${newState}`);
        entry.state = newState;

        switch (newState) {
            case SSEState.CONNECTING:
                this.connect(entry);
                break;
            case SSEState.CONNECTED:
                // Handled in connect() onopen
                break;
            case SSEState.IDLE_SLEEP:
            case SSEState.DISCONNECTED:
            case SSEState.OFFLINE:
                if (entry.source) {
                    entry.source.close();
                    entry.source = null;
                }
                break;
        }

        telemetry.emit({
            engine: 'SSE',
            severity: TelemetrySeverity.DEBUG,
            payload: { action: 'state_transition', oldState, newState, url: entry.url }
        });
    }

    private connect(entry: SSEConnectionEntry) {
        // Guard: Network check
        if (!navigator.onLine) {
            this.transition(entry, SSEState.OFFLINE);
            return;
        }

        // 🛡️ User Rule: Only Leader maintains SSE when idle
        if (!leaderElection.isLeader() && this.isUserIdle) {
            this.stateTransition(entry, SSEState.IDLE_SLEEP); // Internal call to avoid double logging if needed, or just transition
            return;
        }

        const url = entry.url;
        const SHARED_BACKOFF_KEY = `safespot_backoff_${url}`;

        try {
            if (entry.source) {
                entry.source.close();
                entry.source = null;
            }

            const source = new EventSource(url);
            entry.source = source;

            source.onopen = () => {
                entry.state = SSEState.CONNECTED;
                entry.backoff.reset();
                localStorage.removeItem(SHARED_BACKOFF_KEY);
                entry.reconnectCallbacks.forEach(cb => cb(null));

                telemetry.emit({
                    engine: 'SSE',
                    severity: TelemetrySeverity.SIGNAL,
                    payload: { action: 'connected', url }
                });
            };

            source.onerror = () => {
                if (source.readyState === EventSource.CLOSED) {
                    this.transition(entry, SSEState.DISCONNECTED);

                    const delay = entry.backoff.getDelay();
                    localStorage.setItem(SHARED_BACKOFF_KEY, entry.backoff.count.toString());

                    telemetry.emit({
                        engine: 'SSE',
                        severity: TelemetrySeverity.WARN,
                        payload: { action: 'connection_lost', url, retryIn: delay, attempt: entry.backoff.count }
                    });

                    setTimeout(() => {
                        if (entry.refCount > 0 && entry.state === SSEState.DISCONNECTED) {
                            this.transition(entry, SSEState.CONNECTING);
                        }
                    }, delay);
                }
            };

            const dispatch = (e: MessageEvent) => {
                const traceId = telemetry.startTrace();
                (e as any).traceId = traceId;

                const specificListeners = entry.listeners.get(e.type);
                specificListeners?.forEach(fn => fn(e));

                if (e.type !== 'message') {
                    const globalListeners = entry.listeners.get('message');
                    globalListeners?.forEach(fn => fn(e));
                }
            };

            source.onmessage = dispatch;
            [
                'new-message', 'message.delivered', 'message.read', 'typing',
                'presence', 'presence-update', 'chat-update', 'chat-rollback',
                'message-reaction', 'message-pinned', 'connected', 'inbox-update',
                'notification', 'mark-read', 'report-update', 'report-create',
                'report-delete', 'new-comment', 'comment-update', 'comment-delete'
            ].forEach(evt => source.addEventListener(evt, dispatch));

        } catch (err) {
            console.error('[SSE] Fatal connection error', err);
            this.transition(entry, SSEState.DISCONNECTED);
            setTimeout(() => this.transition(entry, SSEState.CONNECTING), 5000);
        }
    }

    private stateTransition(entry: SSEConnectionEntry, state: SSEState) {
        this.transition(entry, state);
    }

    onReconnect(url: string, callback: ReconnectCallback) {
        const entry = this.connections.get(url);
        if (entry) {
            entry.reconnectCallbacks.add(callback);
        }
        return () => {
            entry?.reconnectCallbacks.delete(callback);
        }
    }

    isConnectionHealthy(): boolean {
        if (this.connections.size === 0) return false;
        for (const [_, entry] of this.connections) {
            if (entry.state === SSEState.CONNECTED) return true;
        }
        return false;
    }

    // Legacy compatibility
    sleep() { this.enterIdleMode(); }
    wakeExplicit() { this.wake(); }

    /**
     * Force closes all EventSource connections and clears subscriptions.
     * Used during logout/session teardown to prevent reconnect loops.
     */
    clearAll(): void {
        this.connections.forEach((entry) => {
            if (entry.source) {
                entry.source.close();
                entry.source = null;
            }
            entry.listeners.clear();
            entry.reconnectCallbacks.clear();
            entry.refCount = 0;
            entry.state = SSEState.DISCONNECTED;
        });
        this.connections.clear();
    }
}

export const ssePool = new SSEPool();
