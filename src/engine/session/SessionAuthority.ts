/**
 * Identity & Session Authority Engine (v2)
 * 
 * ROLE: Staff Software Architect
 * RESPONSIBILITY: Single Source of Truth for identity and session.
 * 
 * This engine manages the Finite State Machine (FSM) of the user session,
 * handling token rehydration, bootstrapping, and expiration.
 */

import { versionedStorage } from '../../lib/storage/VersionedStorageManager';

export enum SessionState {
    UNINITIALIZED = 'UNINITIALIZED',
    BOOTSTRAPPING = 'BOOTSTRAPPING',
    READY = 'READY',
    DEGRADED = 'DEGRADED',  // ✅ MOTOR 2: Emergency non-authority state
    RECOVERING = 'RECOVERING',
    EXPIRED = 'EXPIRED',
    FAILED = 'FAILED'
}

// Robust URL normalization to match api.ts and avoid 404s
const apiRaw = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const API_BASE_URL = apiRaw.replace(/\/$/, '').endsWith('/api')
    ? apiRaw.replace(/\/$/, '')
    : `${apiRaw.replace(/\/$/, '')}/api`;

export interface SessionToken {
    anonymousId: string;
    sessionId: string;
    signature: string; // ✅ Identity Shield Signature
    issuedAt: number;
    expiresAt: number;
    jwt: string;
}

type StateChangeListener = (state: SessionState) => void;

/**
 * SessionAuthority (v2.1) - Corrected & Resilient
 * 
 * ROLE: Identity Authority resource. 
 * RULES: 
 * - Never blocks the app on its own.
 * - Always falls back to DEGRADED if bootstrap fails.
 */
class SessionAuthority {
    private static instance: SessionAuthority;
    private state: SessionState = SessionState.UNINITIALIZED;
    private token: SessionToken | null = null;
    private listeners: Set<StateChangeListener> = new Set();
    private bootstrapPromise: Promise<void> | null = null;

    private readonly STORAGE_KEY = 'safespot_session_v2';

    private constructor() {
        console.debug('[SessionAuthority] [v2.1] Initializing Authority Resource...');
        this.rehydrate();
    }

    public static getInstance(): SessionAuthority {
        if (!SessionAuthority.instance) {
            SessionAuthority.instance = new SessionAuthority();
        }
        return SessionAuthority.instance;
    }

    /**
     * Rehydrate session from localStorage (FAST path)
     */
    private rehydrate() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const parsed: SessionToken = JSON.parse(stored);
                const now = Date.now();

                // ✅ MOTOR 2.1: Only rehydrate if token is valid AND has signature
                if (parsed.expiresAt > now && parsed.signature) {
                    this.token = parsed;
                    this.state = SessionState.READY;
                    console.debug(`[SessionAuthority] [READY] Session rehydrated. ID: ${parsed.anonymousId.substring(0, 8)}`);
                } else {
                    const reason = parsed.expiresAt <= now ? 'expired' : 'missing signature';
                    console.warn(`[SessionAuthority] [STALE] Stored session is ${reason}. Re-bootstrap required.`);
                    // We stay in UNINITIALIZED to force a fresh init()
                }
            }
        } catch (e) {
            console.error('[SessionAuthority] [FAILED] Rehydration corrupted:', e);
            this.state = SessionState.FAILED;
        }
    }

    /**
     * Negotiate identity with backend
     */
    public async init(): Promise<void> {
        if (this.state === SessionState.READY) return;
        if (this.state === SessionState.BOOTSTRAPPING) return this.bootstrapPromise!;

        console.debug('[SessionAuthority] [BOOTSTRAPPING] Negotiating identity with authority server...');
        this.setState(SessionState.BOOTSTRAPPING);

        this.bootstrapPromise = (async () => {
            try {
                // ✅ MOTOR 2.1: Use VersionedStorage for bootstrap negotiation
                const currentId = versionedStorage.getVersioned<string>('safespot_anonymous_id');

                // Normalize URL to avoid double slashes or missing /api
                const bootstrapUrl = `${API_BASE_URL}/auth/bootstrap`.replace(/([^:]\/)\/+/g, '$1');

                const response = await fetch(bootstrapUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ currentAnonymousId: currentId || undefined }),
                    signal: AbortSignal.timeout(5000) // 5s Strict Timeout
                });

                if (!response.ok) {
                    throw new Error(`Bootstrap Authority rejected request with status: ${response.status}`);
                }

                const data = await response.json();
                if (data.success && data.session && data.token && data.signature) {
                    this.token = {
                        ...data.session,
                        jwt: data.token,
                        signature: data.signature // ✅ Persist signature
                    };
                    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.token));
                    this.setState(SessionState.READY);
                } else {
                    throw new Error('Authority server response malformed.');
                }
            } catch (err) {
                console.error('[SessionAuthority] [DEGRADED] Authority server unreachable or error. Falling back to local identity.', err);

                // FALLBACK FACTORY: Create an emergency local session
                // This allows the app to stay usable (non-authority verified)
                if (!this.token) {
                    // If we have nothing, we even use ensureAnonymousId later via api.ts
                    // but we mark ourselves as DEGRADED.
                }
                this.setState(SessionState.DEGRADED);
            } finally {
                this.bootstrapPromise = null;
            }
        })();

        return this.bootstrapPromise;
    }

    /**
     * Wait until authority is READY or DEGRADED (Safe-path)
     * Used by API Request Gate to avoid race conditions.
     */
    public async waitUntilReady(): Promise<void> {
        if (this.state === SessionState.READY || this.state === SessionState.DEGRADED) {
            return;
        }

        if (this.state === SessionState.BOOTSTRAPPING && this.bootstrapPromise) {
            await this.bootstrapPromise;
            return;
        }

        // Defensive wait for other states
        return new Promise((resolve) => {
            const unsubscribe = this.subscribe((state) => {
                if (state === SessionState.READY || state === SessionState.DEGRADED || state === SessionState.FAILED) {
                    unsubscribe();
                    resolve();
                }
            });

            // Safety timeout
            setTimeout(() => {
                unsubscribe();
                resolve();
            }, 10000);
        });
    }

    public setSession(token: SessionToken) {
        this.token = token;
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(token));
        this.setState(SessionState.READY);
    }

    public getState(): SessionState {
        return this.state;
    }

    public getToken(): SessionToken | null {
        return this.token;
    }

    public getAnonymousId(): string | null {
        // ✅ MOTOR 2.1: Use VersionedStorageManager helper (fixes JSON-in-header leak)
        return this.token?.anonymousId || versionedStorage.getVersioned<string>('safespot_anonymous_id') || null;
    }

    private setState(newState: SessionState) {
        if (this.state === newState) return;
        console.debug(`[SessionAuthority] [${this.state}] -> [${newState}]`);
        this.state = newState;
        this.notify();
    }

    public subscribe(listener: StateChangeListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify() {
        this.listeners.forEach(l => l(this.state));
    }
}

export const sessionAuthority = SessionAuthority.getInstance();

// ✅ MOTOR 2.1 Bridge: Expose to window for legacy identity.ts proxying
if (typeof window !== 'undefined') {
    (window as any).__safespot_session_authority = sessionAuthority;
}
