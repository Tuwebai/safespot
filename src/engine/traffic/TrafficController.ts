import { Backoff } from './Backoff';

/**
 * Traffic State Definition
 */
export enum TrafficState {
    IDLE = 'IDLE',
    RATE_LIMITED = 'RATE_LIMITED',
    BACKING_OFF = 'BACKING_OFF',
    ALLOWING = 'ALLOWING',
    CONGESTED = 'CONGESTED'
}

/**
 * Motor 7 - Client-side Traffic Control Engine
 * 
 * Objectives:
 * 1. Global Rate Limit Management (429 handling)
 * 2. Serialized Action Queue (Atomic actions)
 * 3. Coordinated Backoff
 */
class TrafficController {
    private state: TrafficState = TrafficState.IDLE;
    private globalBackoff = new Backoff(2000, 60000); // Start at 2s, cap at 60s
    private resumePromise: Promise<void> | null = null;
    private resumeResolver: (() => void) | null = null;

    // Serial queue for sensitive actions
    private serialQueue: Promise<any> = Promise.resolve();

    /**
     * Semáforo: Wait until traffic is allowed
     */
    async waitUntilAllowed(): Promise<void> {
        if (this.state === TrafficState.IDLE) return;

        if (this.resumePromise) {
            console.debug(`[Traffic] 🚦 Request paused. Current state: ${this.state}`);
            await this.resumePromise;
        }
    }

    /**
     * Report a 429 or congestion event
     */
    reportRateLimit() {
        if (this.state === TrafficState.RATE_LIMITED || this.state === TrafficState.BACKING_OFF) return;

        this.state = TrafficState.RATE_LIMITED;
        const delay = this.globalBackoff.getDelay();

        console.warn(`[Traffic] 🔴 RATE_LIMITED detected. Entering global backoff: ${delay}ms`);
        this.state = TrafficState.BACKING_OFF;

        // Create the blocking promise
        this.resumePromise = new Promise((resolve) => {
            this.resumeResolver = resolve;
        });

        // Auto-resume after backoff
        setTimeout(() => this.resume(), delay);
    }

    /**
     * Resume traffic
     */
    resume() {
        if (this.state === TrafficState.IDLE) return;

        this.state = TrafficState.ALLOWING;
        console.log('[Traffic] 🟢 RESUMED - Releasing global traffic');

        if (this.resumeResolver) {
            this.resumeResolver();
            this.resumeResolver = null;
            this.resumePromise = null;
        }

        // Return to IDLE after clearing the gate
        this.state = TrafficState.IDLE;
    }

    /**
     * Execute sensitive action in serial queue (Concurrency: 1)
     */
    async enqueueSerial<T>(action: () => Promise<T>, label = 'anonymous'): Promise<T> {
        const result = this.serialQueue.then(async () => {
            console.debug(`[Traffic] 🔄 SERIAL_QUEUE_EXECUTING: ${label}`);
            try {
                return await action();
            } finally {
                console.debug(`[Traffic] ✅ SERIAL_QUEUE_FINISHED: ${label}`);
            }
        });

        // Chaining to current queue
        this.serialQueue = result.catch(() => { }); // Prevent individual crash from stalling queue

        return result;
    }

    /**
     * Reset backoff count (call on successful request)
     */
    notifySuccess() {
        if (this.globalBackoff.count > 0) {
            this.globalBackoff.reset();
        }
    }

    getState() {
        return this.state;
    }
}

export const trafficController = new TrafficController();
