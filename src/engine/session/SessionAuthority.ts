/**
 * Identity & Session Authority Engine (v3 - SSOT Refactor)
 * 
 * ROLE: Single Source of Truth for ALL identity
 * RESPONSIBILITY: Atomic identity management, no stale data possible
 * 
 * v3 CHANGES:
 * - Added authId for authenticated users
 * - Added userMetadata (alias, avatar, email)
 * - State AUTHENTICATED for full identity
 * - Migration from legacy auth-store
 * - No external dependencies for identity validation
 */

import { versionedStorage } from '../../lib/storage/VersionedStorageManager';
import { IdentityInvariantViolation } from '../../lib/errors/IdentityInvariantViolation';
import { eventAuthorityLog } from '../../lib/realtime/EventAuthorityLog';
import { viewReconciliationEngine } from '../../lib/view-reconciliation/ViewReconciliationEngine';
import { realtimeOrchestrator } from '../../lib/realtime/RealtimeOrchestrator';
import { dataIntegrityEngine } from '../../engine/integrity';
import { trafficController } from '../../engine/traffic/TrafficController';
import { locationAuthority } from '../../engine/location/LocationAuthorityEngine';
import { stopSessionWatchdog } from '../../lib/identity';

export enum SessionState {
    UNINITIALIZED = 'UNINITIALIZED',
    BOOTSTRAPPING = 'BOOTSTRAPPING',
    READY = 'READY',           // Anonymous identity confirmed
    AUTHENTICATED = 'AUTHENTICATED',  // Full auth identity confirmed
    DEGRADED = 'DEGRADED',
    RECOVERING = 'RECOVERING',
    EXPIRED = 'EXPIRED',
    FAILED = 'FAILED'
}

export interface UserMetadata {
    alias: string;
    avatarUrl?: string;
    email?: string;
}

export interface SessionToken {
    anonymousId: string;      // Always present - core identity
    authId: string | null;    // Present when authenticated
    jwt: string | null;       // Present when authenticated
    sessionId: string;
    signature: string;
    issuedAt: number;
    expiresAt: number;
    userMetadata: UserMetadata | null;
}

export interface ResolvedIdentity {
    id: string;
    type: 'user' | 'anonymous';
    alias: string;
    avatarUrl?: string;
    anonymousId: string;  // Always included for reference
}

type StateChangeListener = (state: SessionState) => void;

class SessionAuthority {
    private static instance: SessionAuthority;
    private state: SessionState = SessionState.UNINITIALIZED;
    private token: SessionToken | null = null;
    private listeners: Set<StateChangeListener> = new Set();
    private bootstrapPromise: Promise<void> | null = null;

    private readonly STORAGE_KEY = 'safespot_session_v3';
    private readonly LEGACY_KEY = 'safespot_session_v2';

    private constructor() {
        console.debug('[SessionAuthority] [v3.0] Initializing SSOT...');
        this.migrateLegacyData();
        this.rehydrate();
    }

    public static getInstance(): SessionAuthority {
        if (!SessionAuthority.instance) {
            SessionAuthority.instance = new SessionAuthority();
        }
        return SessionAuthority.instance;
    }

    /**
     * Migrate from v2 storage format and legacy auth-store
     */
    private migrateLegacyData(): void {
        try {
            // Check for v2 format
            const legacyV2 = localStorage.getItem(this.LEGACY_KEY);
            if (legacyV2) {
                const parsed = JSON.parse(legacyV2);
                if (parsed.anonymousId) {
                    console.log('[SessionAuthority] Migrating v2 session...');
                    // ✅ SECURITY FIX: Never generate signatures locally
                    // If legacy session has no signature, it will be obtained on next bootstrap
                    this.token = {
                        anonymousId: parsed.anonymousId,
                        authId: null,
                        jwt: null,
                        sessionId: parsed.sessionId || self.crypto.randomUUID(),
                        signature: parsed.signature || '', // Empty string triggers re-bootstrap
                        issuedAt: Date.now(),
                        expiresAt: Date.now() + (1000 * 60 * 60 * 24 * 365),
                        userMetadata: null
                    };
                    this.persist();
                    localStorage.removeItem(this.LEGACY_KEY);
                    return;
                }
            }

            // Check for legacy Zustand auth-store
            const zustandAuth = localStorage.getItem('auth-storage');
            if (zustandAuth) {
                const parsed = JSON.parse(zustandAuth);
                if (parsed.state?.user?.anonymous_id) {
                    console.log('[SessionAuthority] Migrating legacy auth-store...');
                    // ✅ SECURITY FIX: Never generate signatures locally
                    // Legacy sessions without signature will trigger re-bootstrap
                    this.token = {
                        anonymousId: parsed.state.user.anonymous_id,
                        authId: parsed.state.user.auth_id || null,
                        jwt: parsed.state.token || null,
                        sessionId: self.crypto.randomUUID(),
                        signature: '', // Empty string triggers re-bootstrap for valid HMAC signature
                        issuedAt: Date.now(),
                        expiresAt: Date.now() + (1000 * 60 * 60 * 24 * 30),
                        userMetadata: parsed.state.user ? {
                            alias: parsed.state.user.alias || 'Usuario',
                            avatarUrl: parsed.state.user.avatar_url,
                            email: parsed.state.user.email
                        } : null
                    };
                    this.persist();
                    // Clear legacy but keep as backup reference
                    localStorage.removeItem('auth-storage');
                }
            }
        } catch (e) {
            console.error('[SessionAuthority] Migration failed:', e);
        }
    }

    // ❌ REMOVED: generateSignature()
    // Signatures MUST come from backend (HMAC-SHA256 with secret)
    // Local generation creates invalid signatures that fail backend validation

    private persist(): void {
        if (this.token) {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.token));
        }
    }

    private rehydrate(): void {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const parsed: SessionToken = JSON.parse(stored);
                const now = Date.now();

                if (parsed.expiresAt > now && parsed.signature) {
                    this.token = parsed;
                    // Determine correct state based on auth presence
                    this.state = parsed.authId && parsed.jwt
                        ? SessionState.AUTHENTICATED
                        : SessionState.READY;
                    console.debug(`[SessionAuthority] [${this.state}] Rehydrated. Anonymous: ${parsed.anonymousId.substring(0, 8)}, Auth: ${parsed.authId?.substring(0, 8) || 'none'}`);
                } else {
                    console.warn('[SessionAuthority] Session expired or invalid. Re-bootstrap required.');
                    localStorage.removeItem(this.STORAGE_KEY);
                }
            }
        } catch (e) {
            console.error('[SessionAuthority] Rehydration failed:', e);
            this.state = SessionState.FAILED;
        }
    }

    public async init(): Promise<void> {
        if (this.state === SessionState.READY || this.state === SessionState.AUTHENTICATED) return;
        if (this.state === SessionState.BOOTSTRAPPING) return this.bootstrapPromise!;

        console.debug('[SessionAuthority] [BOOTSTRAPPING] Negotiating identity...');
        this.setState(SessionState.BOOTSTRAPPING);

        this.bootstrapPromise = (async () => {
            try {
                const apiRaw = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
                const API_BASE_URL = apiRaw.replace(/\/$/, '').endsWith('/api')
                    ? apiRaw.replace(/\/$/, '')
                    : `${apiRaw.replace(/\/$/, '')}/api`;

                const currentId = versionedStorage.getVersioned<string>('safespot_anonymous_id');
                const bootstrapUrl = `${API_BASE_URL}/auth/bootstrap`.replace(/([^:]\/\/[^/]+)\/+/g, '$1/');

                const response = await fetch(bootstrapUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ currentAnonymousId: currentId || undefined }),
                    signal: AbortSignal.timeout(5000)
                });

                if (!response.ok) {
                    throw new Error(`Bootstrap failed: ${response.status}`);
                }

                const data = await response.json();
                if (data.success && data.session) {
                    // ✅ SECURITY: Use backend-provided HMAC signature for Identity Shield
                    // Backend generates: HMAC-SHA256(anonymousId, SECRET)
                    // Frontend must use this signature for X-Anonymous-Signature header
                    const serverSignature = data.signature;
                    if (!serverSignature) {
                        console.error('[SessionAuthority] 🚨 Bootstrap response missing signature. Backend must provide HMAC signature.');
                    }

                    this.token = {
                        anonymousId: data.session.anonymousId,
                        authId: null,  // Anonymous bootstrap
                        jwt: data.token || null,
                        sessionId: self.crypto.randomUUID(),
                        signature: serverSignature || '', // Empty if backend fails to provide
                        issuedAt: Date.now(),
                        expiresAt: Date.now() + (1000 * 60 * 60 * 24 * 365),
                        userMetadata: null
                    };
                    this.persist();
                    this.setState(SessionState.READY);
                } else {
                    throw new Error('Malformed bootstrap response');
                }
            } catch (err) {
                console.error('[SessionAuthority] [DEGRADED] Bootstrap failed:', err);
                this.setState(SessionState.DEGRADED);
            } finally {
                this.bootstrapPromise = null;
            }
        })();

        return this.bootstrapPromise;
    }

    /**
     * ATOMIC LOGIN: Sets ALL identity fields at once
     * No partial state possible
     */
    public login(authData: {
        token: string;
        authId: string;
        anonymousId: string;
        userMetadata: UserMetadata;
        signature?: string;
    }): void {
        console.log('[SessionAuthority] Atomic login:', authData.authId.substring(0, 8));

        // ✅ SECURITY: Use backend-provided HMAC signature (REQUIRED)
        // Backend generates: HMAC-SHA256(anonymousId, SECRET)
        // This signature is required for Identity Shield validation
        const serverSignature = authData.signature;
        if (!serverSignature) {
            console.error('[SessionAuthority] 🚨 Login called without backend signature. Mutations will be blocked.');
        }

        this.token = {
            anonymousId: authData.anonymousId,
            authId: authData.authId,
            jwt: authData.token,
            sessionId: self.crypto.randomUUID(),
            signature: serverSignature || '', // Empty if backend fails to provide
            issuedAt: Date.now(),
            expiresAt: Date.now() + (1000 * 60 * 60 * 24 * 30),
            userMetadata: authData.userMetadata
        };

        this.persist();
        this.setState(SessionState.AUTHENTICATED);
    }

    /**
     * ATOMIC LOGOUT: Clears auth but preserves anonymous identity
     */
    public logout(): void {
        if (!this.token) return;

        console.log('[SessionAuthority] Logout - preserving anonymous:', this.token.anonymousId.substring(0, 8));

        // 🧹 MEMORY FIX: Limpiar logs de memoria para prevenir leaks
        // Solo en logout completo, no afecta la experiencia del usuario
        eventAuthorityLog.clear();
        viewReconciliationEngine.clear();
        realtimeOrchestrator.clear();
        dataIntegrityEngine.clear();
        trafficController.clear();
        locationAuthority.clear();
        stopSessionWatchdog(); // 🧹 Stop identity watchdog to prevent memory leaks

        // ✅ SECURITY: Preserve existing signature on logout
        // Signature is tied to anonymousId, which persists across auth sessions
        // Only bootstrap can issue new signatures
        this.token = {
            ...this.token,
            authId: null,
            jwt: null,
            userMetadata: null,
            issuedAt: Date.now(),
            expiresAt: Date.now() + (1000 * 60 * 60 * 24 * 365)
            // signature: preserved from existing token
        };

        this.persist();
        this.setState(SessionState.READY);
    }

    /**
     * FULL RESET: For account switching or data corruption
     */
    public clearAll(): void {
        this.token = null;
        this.state = SessionState.UNINITIALIZED;
        localStorage.removeItem(this.STORAGE_KEY);
        localStorage.removeItem(this.LEGACY_KEY);
        
        // 🧹 MEMORY FIX: Limpiar logs de memoria en reset completo
        eventAuthorityLog.clear();
        viewReconciliationEngine.clear();
        realtimeOrchestrator.clear();
        dataIntegrityEngine.clear();
        trafficController.clear();
        locationAuthority.clear();
        stopSessionWatchdog(); // 🧹 Stop identity watchdog to prevent memory leaks
        
        this.notify();
    }

    /**
     * SSOT IDENTITY RESOLUTION
     * Returns complete identity information
     */
    public requireIdentity(): ResolvedIdentity {
        if (this.state !== SessionState.READY &&
            this.state !== SessionState.AUTHENTICATED) {
            throw new IdentityInvariantViolation(
                `Identity not ready. State: ${this.state}`,
                'SessionAuthority.requireIdentity',
                'state',
                this.state
            );
        }

        if (!this.token) {
            throw new IdentityInvariantViolation(
                'Token missing despite ready state',
                'SessionAuthority.requireIdentity',
                'token',
                null
            );
        }

        // ✅ CRITICAL FIX: anonymous_id es la identidad pública universal
        // authId es solo metadata de autenticación, NO identidad pública
        // Comentarios, reportes, chats, etc. usan anonymous_id
        if (this.token.authId && this.token.userMetadata) {
            return {
                id: this.token.anonymousId,  // ✅ FIX: Usar anonymousId, NO authId
                type: 'user',
                alias: this.token.userMetadata.alias,
                avatarUrl: this.token.userMetadata.avatarUrl,
                anonymousId: this.token.anonymousId
            };
        }

        // Anonymous identity
        return {
            id: this.token.anonymousId,
            type: 'anonymous',
            alias: 'Usuario',  // Fallback, UI can override
            anonymousId: this.token.anonymousId
        };
    }

    public requireAnonymousId(): string {
        if (!this.token?.anonymousId) {
            throw new IdentityInvariantViolation(
                'Anonymous ID not available',
                'SessionAuthority.requireAnonymousId',
                'anonymousId',
                null
            );
        }
        return this.token.anonymousId;
    }

    public getAnonymousId(): string | null {
        if (this.state === SessionState.BOOTSTRAPPING ||
            this.state === SessionState.UNINITIALIZED) {
            return null;
        }
        return this.token?.anonymousId || null;
    }

    public getAuthId(): string | null {
        return this.token?.authId || null;
    }

    public getJwt(): string | null {
        return this.token?.jwt || null;
    }

    public getState(): SessionState {
        return this.state;
    }

    public getToken(): SessionToken | null {
        return this.token;
    }

    public async waitUntilReady(): Promise<void> {
        if (this.state === SessionState.READY ||
            this.state === SessionState.AUTHENTICATED ||
            this.state === SessionState.DEGRADED) {
            return;
        }

        if (this.state === SessionState.BOOTSTRAPPING && this.bootstrapPromise) {
            await this.bootstrapPromise;
            return;
        }

        return new Promise((resolve) => {
            const unsubscribe = this.subscribe((state) => {
                if (state === SessionState.READY ||
                    state === SessionState.AUTHENTICATED ||
                    state === SessionState.DEGRADED ||
                    state === SessionState.FAILED) {
                    unsubscribe();
                    resolve();
                }
            });

            setTimeout(() => {
                unsubscribe();
                resolve();
            }, 10000);
        });
    }

    // Legacy compatibility
    public setSession(token: Partial<SessionToken>) {
        if (this.token) {
            this.token = { ...this.token, ...token } as SessionToken;
        } else {
            this.token = token as SessionToken;
        }
        this.persist();
        this.setState(this.token.authId ? SessionState.AUTHENTICATED : SessionState.READY);
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

if (typeof window !== 'undefined') {
    (window as any).__safespot_session_authority = sessionAuthority;
}
