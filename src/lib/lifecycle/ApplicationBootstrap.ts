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

import { sessionAuthority, SessionState } from '@/engine/session/SessionAuthority';
import { ssePool } from '@/lib/ssePool';
import { queryClient } from '@/lib/queryClient';

export enum BootstrapState {
    IDLE = 'idle',
    BOOTING = 'booting',
    RUNNING = 'running',
    SUSPENDED = 'suspended',
    RECOVERING = 'recovering',
    FAILED = 'failed'
}

type StateListener = (state: BootstrapState) => void;

/**
 * ApplicationBootstrapManager (Enterprise Core v2.1)
 * 
 * ROLE: Primary Orchestrator & State Commander.
 * RESPONSIBILITY: Link Identity Engine with App Lifecycle.
 */
class ApplicationBootstrapManager {
    private state: BootstrapState = BootstrapState.IDLE;
    private listeners: Set<StateListener> = new Set();
    private recoveryAttempts = 0;
    private lastRecoveryAt = 0;
    private readonly RECOVERY_COOLDOWN = 5000; // 5s Cooldown to avoid storms

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
        listener(this.state);
        return () => this.listeners.delete(listener);
    }

    private setState(newState: BootstrapState, reason: string = 'internal') {
        if (this.state === newState) return;

        // 🔴 ENTERPRISE LOGGING: Structured Trace
        console.info(`[Lifecycle] STATE_TRANSITION from=${this.state} to=${newState} reason=${reason}`);

        this.state = newState;
        this.listeners.forEach(fn => fn(newState));
    }

    /**
     * Entry Point: Orchestrates the secure boot sequence
     */
    public async initialize() {
        if (this.state !== BootstrapState.IDLE) return;

        console.time('[Bootstrap] Secure Boot Sequence');
        this.setState(BootstrapState.BOOTING, 'app_init');

        try {
            // 🧠 FAIL-SAFE BOOT: 8s Hard Limit
            // This ensures the user NEVER sees a skeleton for more than 8 seconds.
            await Promise.race([
                sessionAuthority.init(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('BOOT_TIMEOUT')), 8000))
            ]);

            const idState = sessionAuthority.getState();
            console.log(`[Bootstrap] Identity Phase Result: ${idState}`);

            if (idState === SessionState.FAILED) {
                console.error('[Bootstrap] Identity failed. Proceeding in degraded mode.');
            }

            this.setState(BootstrapState.RUNNING, 'boot_success');
        } catch (error) {
            console.error('[Bootstrap] ⚠️ Critical Failure or Timeout during Boot:', error);
            // GUARANTEE: Always end in RUNNING state to show UI
            this.setState(BootstrapState.RUNNING, 'failsafe_trigger');
        } finally {
            console.timeEnd('[Bootstrap] Secure Boot Sequence');
        }
    }

    /**
     * Recovery Logic: Re-validates state after suspension
     * 
     * @param reason The trigger for recovery (visibility, online, etc)
     */
    public async recover(reason: string = 'event') {
        // 1. Guard against redundant calls
        if (this.state === BootstrapState.RECOVERING) return;
        if (this.state !== BootstrapState.SUSPENDED && this.state !== BootstrapState.FAILED) return;

        // 2. Cooldown check (Enterprise Throttling)
        const now = Date.now();
        if (now - this.lastRecoveryAt < this.RECOVERY_COOLDOWN) {
            console.debug(`[Lifecycle] Recovery suppressed: Cooldown active (${now - this.lastRecoveryAt}ms)`);
            return;
        }

        this.setState(BootstrapState.RECOVERING, reason);
        this.lastRecoveryAt = now;

        console.log(`[Lifecycle] 🚑 RECOVERY_START attempt=${this.recoveryAttempts + 1} reason=${reason}`);

        try {
            // 🧠 FAIL-SAFE RECOVERY: 10s Hard Limit
            await Promise.race([
                this._performRecoverySteps(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('RECOVERY_TIMEOUT')), 10000))
            ]);

            this.setState(BootstrapState.RUNNING, 'recovery_success');
            this.recoveryAttempts = 0;
            console.log('[Lifecycle] ✅ System Restored');

        } catch (error) {
            console.error('[Lifecycle] ⚠️ Recovery Partial failure or Timeout:', error);
            // GUARANTEE: Never stay in RECOVERING forever
            this.setState(BootstrapState.RUNNING, 'recovery_failsafe');
            this.recoveryAttempts++;
        }
    }

    /**
     * Internal: Specific steps to restore the system
     */
    private async _performRecoverySteps() {
        // A. Identity Check: Only init if we are not in a terminal/ready state
        const idState = sessionAuthority.getState();
        if (idState !== SessionState.READY && idState !== SessionState.DEGRADED) {
            console.log('[Lifecycle] RECOVERY_STEP identity=verify');
            await sessionAuthority.init();
        } else {
            console.log('[Lifecycle] RECOVERY_STEP identity=skipped');
        }

        // B. Resume Realtime (SSE)
        ssePool.wake();
        console.log('[Lifecycle] RECOVERY_STEP sse=wake');

        // C. Staggered Data Rehydration (Prioritized)
        console.log('[Lifecycle] RECOVERY_STEP queries=staggered');

        // 1. Critical Profile
        await queryClient.refetchQueries({ queryKey: [['users', 'profile']], type: 'active' });

        // 2. Security Context
        await queryClient.refetchQueries({ queryKey: [['notifications', 'settings']], type: 'active' });

        // 3. Background Jittered Re-fetch (Non-blocking)
        setTimeout(async () => {
            const activeQueries = queryClient.getQueryCache().findAll({ type: 'active' });
            for (const query of activeQueries) {
                const keyStr = JSON.stringify(query.queryKey);
                if (keyStr.includes('profile') || keyStr.includes('settings')) continue;

                // 50-250ms Jitter to avoid massive spikes
                await new Promise(r => setTimeout(r, 50 + Math.random() * 200));
                query.fetch();
            }
        }, 300);
    }

    public suspend(reason: string = 'event') {
        // RULE: Only suspend if we are actually RUNNING or RECOVERING
        // DO NOT suspend during BOOTING (prevents infinite bootstrap loop)
        if (this.state !== BootstrapState.RUNNING && this.state !== BootstrapState.RECOVERING) {
            console.debug(`[Lifecycle] Suspend ignored: state=${this.state}`);
            return;
        }

        this.setState(BootstrapState.SUSPENDED, reason);
        ssePool.sleep();
        console.log(`[Lifecycle] 💤 System Suspended reason=${reason}`);
    }

    private setupSystemListeners() {
        // 1. Visibility (Tab background/foreground)
        document.addEventListener('visibilitychange', () => {
            const reason = `visibility:${document.visibilityState}`;
            if (document.visibilityState === 'visible') {
                this.recover(reason);
            } else {
                this.suspend(reason);
            }
        });

        // 2. Connectivity (Network offline/online)
        window.addEventListener('online', () => {
            this.recover('network:online');
        });

        window.addEventListener('offline', () => {
            console.warn('[Lifecycle] Network offline detected.');
            // We stay in current state but app is aware
        });

        // 3. User Focus (Window focus/blur)
        // Useful for detecting "Return to app" even if tab was always visible
        window.addEventListener('focus', () => {
            // Only trigger if we were potentially stale
            if (this.state === BootstrapState.RUNNING) {
                console.log('[Lifecycle] App Focused. Checking for freshness...');
                // Optional: trigger light recovery or just log
            }
        });

        // 4. Global Error Gate
        window.addEventListener('unhandledrejection', (event) => {
            if (event.reason?.message === 'BOOT_TIMEOUT' || event.reason?.message === 'RECOVERY_TIMEOUT') {
                console.warn(`[Lifecycle] Fail-safe gate caught: ${event.reason.message}. Blocking UI freeze.`);
                // Prevent noisy console errors for expected fail-safes
                event.preventDefault();
            }
        });

        // 5. SSE Failure Signal
        window.addEventListener('safespot:sse_struggle', (event: any) => {
            console.warn(`[Lifecycle] SSE Struggle detected at ${event.detail?.url}. Triggering light recovery.`);
            // Only recover if we aren't already busy
            if (this.state === BootstrapState.RUNNING) {
                // We don't change state to RECOVERING to avoid UI flickering for minor SSE issues,
                // but we trigger the recovery logic internally.
                this._performRecoverySteps().catch(() => { });
            }
        });
    }
}

export const bootstrapManager = new ApplicationBootstrapManager();
