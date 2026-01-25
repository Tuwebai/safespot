/**
 * Application Bootstrap Manager (Enterprise Core)
 * 
 * Central Authority for Application Lifecycle & State Recovery.
 * 
 * Responsibilities:
 * 1. Orchestrate initial boot sequence (Identity -> Config -> Connect).
 * 2. Manage "Lifecycle State" (Booting, Running, Suspended, Recovering).
 * 3. Handle "Tab Resurrection" (Self-healing when tab comes back from background).
 * 4. Prevent "Zombie Queries" (Pause network when hidden).
 * 
 * @singleton
 */

import { initializeIdentity, ensureAnonymousId, getAnonymousId } from '@/lib/identity';
import { ssePool } from '@/lib/ssePool';
import { queryClient } from '@/lib/queryClient';

export enum BootstrapState {
    IDLE = 'idle',
    BOOTING = 'booting',
    RUNNING = 'running',
    SUSPENDED = 'suspended',
    RECOVERING = 'recovering',
    FAILED = 'failed' // Should trigger full reload or error boundary
}

type StateListener = (state: BootstrapState) => void;

class ApplicationBootstrapManager {
    private state: BootstrapState = BootstrapState.IDLE;
    private listeners: Set<StateListener> = new Set();
    private recoveryAttempts = 0;
    private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    constructor() {
        if (typeof window !== 'undefined') {
            this.setupSystemListeners();
        }
    }

    public getState(): BootstrapState {
        return this.state;
    }

    public subscribe(listener: StateListener): () => void {
        this.listeners.add(listener);
        // Fire immediately
        listener(this.state);
        return () => this.listeners.delete(listener);
    }

    private setState(newState: BootstrapState) {
        if (this.state === newState) return;

        console.info(`[Bootstrap] 🔄 State Change: ${this.state} -> ${newState}`);
        this.state = newState;

        this.listeners.forEach(fn => fn(newState));
    }

    /**
     * Entry Point: Called by <StartupGuard> or main.tsx
     */
    public async initialize() {
        if (this.state !== BootstrapState.IDLE) return;

        try {
            this.setState(BootstrapState.BOOTING);
            console.time('[Bootstrap] Boot Sequence');

            // 1. Identity (Critical Path)
            await this.ensureIdentity();

            // 2. Network / SSE Prep
            if (this.isOnline) {
                // We don't block boot on SSE connection, but we signal it to start
                // ssePool will handle its own connection logic
            }

            console.timeEnd('[Bootstrap] Boot Sequence');
            this.setState(BootstrapState.RUNNING);

        } catch (error) {
            console.error('[Bootstrap] ❌ Critical Failure:', error);
            // Fallback to emergency identity to allow app usage
            await ensureAnonymousId();
            this.setState(BootstrapState.RUNNING); // Degraded but running
        }
    }

    /**
     * Called when tab becomes visible or network returns
     */
    public async recover() {
        if (this.state === BootstrapState.RECOVERING) return;

        this.setState(BootstrapState.RECOVERING);

        console.log(`[Bootstrap] 🚑 Starting Recovery Protocol (Attempt ${this.recoveryAttempts + 1})`);

        try {
            // 1. Re-verify identity validity
            // Some tokens might expire while in background
            const currentId = getAnonymousId();
            if (!currentId) {
                await this.ensureIdentity();
            }

            // 2. Wake up SSE
            ssePool.wake();

            // 3. Rehydrate Critical Data
            // We force a refetch of "active" queries to ensure UI is fresh
            await queryClient.refetchQueries({ type: 'active' });

            this.setState(BootstrapState.RUNNING);
            this.recoveryAttempts = 0;
            console.log('[Bootstrap] ✅ Recovery Successful');

        } catch (error) {
            console.error('[Bootstrap] ⚠️ Recovery partial failure:', error);
            // Even if refetch fails (e.g. offline), we return to RUNNING
            // React Query will handle retry logic
            this.setState(BootstrapState.RUNNING);
            this.recoveryAttempts++;
        }
    }

    public suspend() {
        if (this.state === BootstrapState.SUSPENDED) return;

        console.log('[Bootstrap] 💤 Suspending Application (Background)');
        this.setState(BootstrapState.SUSPENDED);

        // Pause expensive things
        ssePool.sleep();
    }

    private setupSystemListeners() {
        // VISIBILITY
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                if (this.state === BootstrapState.SUSPENDED) {
                    this.recover();
                }
            } else {
                this.suspend();
            }
        });

        // ONLINE/OFFLINE
        window.addEventListener('online', () => {
            this.isOnline = true;
            if (this.state === BootstrapState.RUNNING || this.state === BootstrapState.SUSPENDED) {
                console.log('[Bootstrap] 🌐 Network Restored -> Triggering Recovery');
                this.recover();
            }
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('[Bootstrap] 🔌 Network Lost');
        });
    }

    // --- Private Recovery Steps ---

    private async ensureIdentity() {
        try {
            // Timeout promise to prevent infinite hang
            const timeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Identity Init Timeout')), 5000)
            );

            await Promise.race([
                initializeIdentity(),
                timeout
            ]);
        } catch (e) {
            console.warn('[Bootstrap] Identity init timed out or failed, forcing anonymous.');
            await ensureAnonymousId();
        }
    }
}

export const bootstrapManager = new ApplicationBootstrapManager();
