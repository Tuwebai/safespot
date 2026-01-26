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

    private setState(newState: BootstrapState) {
        if (this.state === newState) return;
        console.info(`[BootstrapManager] [${this.state}] -> [${newState}]`);
        this.state = newState;
        this.listeners.forEach(fn => fn(newState));
    }

    /**
     * Entry Point: Orchestrates the secure boot sequence
     */
    public async initialize() {
        if (this.state !== BootstrapState.IDLE) return;

        try {
            this.setState(BootstrapState.BOOTING);
            console.time('[Bootstrap] Secure Boot Sequence');

            // 1. Identity Authority Negotiation
            // We use a safe race to prevent infinite hanging
            await Promise.race([
                sessionAuthority.init(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Identity Timeout')), 8000))
            ]);

            const idState = sessionAuthority.getState();
            console.log(`[Bootstrap] Identity Phase Result: ${idState}`);

            // 2. Network / Context Prep
            // If we are DEGRADED or READY, we can continue. 
            // Only FAILED blocks if critical.
            if (idState === SessionState.FAILED) {
                throw new Error('Identity Engine failed critical initialization');
            }

            console.timeEnd('[Bootstrap] Secure Boot Sequence');
            this.setState(BootstrapState.RUNNING);

        } catch (error) {
            console.error('[Bootstrap] ⚠️ Critical Failure during Boot:', error);
            // In Enterprise, we prefer DEGRADED running over SKELETON INFINITO
            this.setState(BootstrapState.RUNNING);
        }
    }

    /**
     * Recovery Logic: Re-validates state after suspension
     */
    public async recover() {
        // Only recover if we were suspended or failed
        if (this.state === BootstrapState.RECOVERING) return;
        if (this.state !== BootstrapState.SUSPENDED && this.state !== BootstrapState.FAILED) return;

        this.setState(BootstrapState.RECOVERING);
        console.log(`[Bootstrap] 🚑 Protocol Recovery Attempt ${this.recoveryAttempts + 1}`);

        try {
            // 1. Refresh Identity if needed
            if (sessionAuthority.getState() !== SessionState.READY) {
                await sessionAuthority.init();
            }

            // 2. Resume sub-systems
            ssePool.wake();

            // 🧠 ENTERPRISE: STAGGERED REFETCH
            // Instead of { type: 'active' } which nukes the backend with 10+ reqs,
            // we prioritize critical resources and stagger the rest.

            console.log('[Bootstrap] ⚡ Beginning Staggered Recovery...');

            // A. Priority 1: User Profile & Context
            await queryClient.refetchQueries({ queryKey: [['users', 'profile']], type: 'active' });

            // B. Priority 2: Infrastructure & Safety Config
            await queryClient.refetchQueries({ queryKey: [['notifications', 'settings']], type: 'active' });

            // C. Jittered Background: Refetch everything else with a staggered delay
            // This is non-blocking to the recovery state
            setTimeout(async () => {
                const activeQueries = queryClient.getQueryCache().findAll({ type: 'active' });
                for (const query of activeQueries) {
                    const keyString = JSON.stringify(query.queryKey);
                    if (keyString.includes('profile') || keyString.includes('settings')) continue;

                    // Small jitter between requests (50-200ms)
                    await new Promise(r => setTimeout(r, 50 + Math.random() * 150));
                    query.fetch();
                }
                console.log('[Bootstrap] ✨ Total system rehydration complete.');
            }, 500);

            this.setState(BootstrapState.RUNNING);
            this.recoveryAttempts = 0;
            console.log('[Bootstrap] ✅ System Restored');

        } catch (error) {
            console.error('[Bootstrap] ⚠️ Recovery Partial failure:', error);
            this.setState(BootstrapState.RUNNING); // Degraded but alive
            this.recoveryAttempts++;
        }
    }

    public suspend() {
        // RULE: Only suspend if we are actually RUNNING or RECOVERING
        // DO NOT suspend during BOOTING (prevents infinite bootstrap loop)
        if (this.state !== BootstrapState.RUNNING && this.state !== BootstrapState.RECOVERING) {
            console.log('[Bootstrap] Suspend ignored: System not initialized yet.');
            return;
        }

        console.log('[Bootstrap] 💤 Suspending Application (Background)');
        this.setState(BootstrapState.SUSPENDED);
        ssePool.sleep();
    }

    private setupSystemListeners() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.recover();
            } else {
                this.suspend();
            }
        });

        window.addEventListener('online', () => {
            this.recover();
        });

        window.addEventListener('offline', () => {
            // Passive listener: system is aware but doesn't block
        });
    }
}

export const bootstrapManager = new ApplicationBootstrapManager();
