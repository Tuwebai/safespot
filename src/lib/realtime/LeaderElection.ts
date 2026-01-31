import { getClientId } from '../clientId';
import { telemetry, TelemetrySeverity } from '../telemetry/TelemetryEngine';

/**
 * Motor 11: Multi-Tab Leader Election
 * 
 * Focalized Seniority Algorithm:
 * 1. Visibility (Foreground) has priority 100.
 * 2. Seniority (Creation Timestamp) is the tie-breaker.
 * 3. Tab ID (Lexicographical) is the ultimate tie-breaker.
 * 
 * NOTE ON AUTHORITY: 
 * - BroadcastChannel signals are the REAL authority for heartbeats.
 * - LocalStorage 'expires' is HEURISTIC (used for cold bootstrap or total tab crash detection).
 */

export enum LeadershipState {
    LEADING = 'LEADER',
    FOLLOWING = 'FOLLOWER',
    CANDIDATE = 'CANDIDATE'
}

export interface LeadershipSignal {
    type: 'WHO_IS_LEADER' | 'I_AM_LEADER' | 'LEADER_SURRENDER' | 'LEADER_SURRENDER_REQUEST';
    tabId: string;
    priority: number;
    creationTimestamp: number;
}

const LEASE_KEY = 'safespot_leader_lease';
const LEASE_DURATION = 3500; // ms
const HEARTBEAT_INTERVAL = 1500; // ms
const ELECTION_WINDOW = 300; // ms

class LeaderElection {
    private tabId: string = getClientId();
    private creationTimestamp: number = Date.now();
    private state: LeadershipState = LeadershipState.CANDIDATE;
    private channel: BroadcastChannel;
    private listeners: Set<(state: LeadershipState) => void> = new Set();

    constructor() {
        this.channel = new BroadcastChannel('safespot-m11-election');
        this.channel.onmessage = (e) => this.handleSignal(e.data);

        // Start election process
        this.init();
    }

    private init() {
        this.emitSignal('WHO_IS_LEADER');

        // Enter CANDIDATE window
        setTimeout(() => {
            if (this.state === LeadershipState.CANDIDATE) {
                this.claimLeadership();
            }
        }, ELECTION_WINDOW);

        // Start Visibility Listener
        document.addEventListener('visibilitychange', () => this.handleVisibilityChange());

        // Start Lease Watchdog (Follower safety)
        this.startWatchdog();
    }

    public isLeader(): boolean {
        return this.state === LeadershipState.LEADING;
    }

    public getState(): LeadershipState {
        return this.state;
    }

    public onChange(cb: (state: LeadershipState) => void) {
        this.listeners.add(cb);
        return () => this.listeners.delete(cb);
    }

    private handleVisibilityChange() {
        if (this.state === LeadershipState.LEADING && document.visibilityState === 'hidden') {
            // We are leader but lost focus. Check if there are other visible tabs.
            // (We'll wait for a signal from them)
        } else if (this.state === LeadershipState.FOLLOWING && document.visibilityState === 'visible') {
            // We are visible now. Can we take lead?
            this.emitSignal('LEADER_SURRENDER_REQUEST');
        }
    }

    private handleSignal(signal: LeadershipSignal) {
        if (signal.tabId === this.tabId) return;

        switch (signal.type) {
            case 'WHO_IS_LEADER':
                if (this.state === LeadershipState.LEADING) {
                    this.emitSignal('I_AM_LEADER');
                }
                break;

            case 'I_AM_LEADER':
                this.resolveContention(signal);
                break;

            case 'LEADER_SURRENDER_REQUEST':
                if (this.state === LeadershipState.LEADING && document.visibilityState === 'hidden') {
                    this.surrender();
                }
                break;

            case 'LEADER_SURRENDER':
                if (this.state === LeadershipState.FOLLOWING) {
                    this.state = LeadershipState.CANDIDATE;
                    this.claimLeadership();
                }
                break;
        }
    }

    private resolveContention(other: LeadershipSignal) {
        const myPriority = this.calculatePriority();

        let lost = false;

        if (other.priority > myPriority) {
            lost = true;
        } else if (other.priority === myPriority) {
            if (other.creationTimestamp < this.creationTimestamp) {
                lost = true;
            } else if (other.creationTimestamp === this.creationTimestamp) {
                if (other.tabId < this.tabId) {
                    lost = true;
                }
            }
        }

        if (lost) {
            this.state = LeadershipState.FOLLOWING;
            this.stopHeartbeat();
            this.notifyListeners();
        }
    }

    private claimLeadership() {
        this.state = LeadershipState.LEADING;
        this.updateLease();
        this.startHeartbeat();
        this.notifyListeners();

        telemetry.emit({
            engine: 'M11',
            severity: TelemetrySeverity.SIGNAL,
            payload: { action: 'leader_claimed', tabId: this.tabId }
        });
    }

    private surrender() {
        this.state = LeadershipState.FOLLOWING;
        this.stopHeartbeat();
        this.emitSignal('LEADER_SURRENDER');
        this.notifyListeners();

        telemetry.emit({
            engine: 'M11',
            severity: TelemetrySeverity.INFO,
            payload: { action: 'leader_surrendered', tabId: this.tabId }
        });
    }

    private startHeartbeat() {
        setInterval(() => {
            this.updateLease();
            this.emitSignal('I_AM_LEADER');
        }, HEARTBEAT_INTERVAL);
    }

    private stopHeartbeat() {
        // Heartbeat is persistent for the leader's life
    }

    private updateLease() {
        const lease = {
            leaderId: this.tabId,
            expires: Date.now() + LEASE_DURATION,
            priority: this.calculatePriority()
        };
        localStorage.setItem(LEASE_KEY, JSON.stringify(lease));
    }

    private startWatchdog() {
        setInterval(() => {
            if (this.state === LeadershipState.LEADING) return;

            const raw = localStorage.getItem(LEASE_KEY);
            if (!raw) {
                this.state = LeadershipState.CANDIDATE;
                this.claimLeadership();
                return;
            }

            try {
                const lease = JSON.parse(raw);
                const myPriority = this.calculatePriority();
                const now = Date.now();

                if (lease.expires < now) {
                    // Lease expired
                    this.state = LeadershipState.CANDIDATE;
                    this.claimLeadership();
                } else if (myPriority > lease.priority && document.visibilityState === 'visible') {
                    // We are visible but leader is not
                    this.emitSignal('LEADER_SURRENDER_REQUEST');
                }
            } catch (e) {
                localStorage.removeItem(LEASE_KEY);
            }
        }, 2000);
    }

    private calculatePriority(): number {
        return document.visibilityState === 'visible' ? 100 : 0;
    }

    private emitSignal(type: LeadershipSignal['type']) {
        const signal: LeadershipSignal = {
            type,
            tabId: this.tabId,
            priority: this.calculatePriority(),
            creationTimestamp: this.creationTimestamp
        };
        this.channel.postMessage(signal);
    }

    private notifyListeners() {
        this.listeners.forEach(cb => cb(this.state));
    }
}

export const leaderElection = new LeaderElection();
