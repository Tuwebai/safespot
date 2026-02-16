
import { create } from 'zustand';
import { sessionAuthority, SessionState, type UserMetadata } from '../engine/session/SessionAuthority';
import { realtimeOrchestrator } from '@/lib/realtime/RealtimeOrchestrator';

/**
 * Auth Store v3 - UI State Only
 * 
 * IMPORTANTE: Este store NO persiste datos de identidad.
 * La identidad vive EXCLUSIVAMENTE en SessionAuthority (SSOT).
 * Este store solo maneja estado de UI y acciones.
 */

interface AuthState {
    // UI State ONLY - derived from SessionAuthority
    isAuthenticated: boolean;
    isLoading: boolean;
    userAlias: string | null;
    userAvatar: string | null;

    // Actions
    loginSuccess: (token: string, anonymousId: string, user: {
        auth_id: string;
        anonymous_id: string;
        alias?: string;
        avatar_url?: string;
        email?: string;
    }, signature?: string) => void;
    logout: () => void;
    syncFromAuthority: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
    // Initial state derived from SessionAuthority
    isAuthenticated: sessionAuthority.getState() === SessionState.AUTHENTICATED,
    isLoading: sessionAuthority.getState() === SessionState.BOOTSTRAPPING,
    userAlias: sessionAuthority.getToken()?.userMetadata?.alias || null,
    userAvatar: sessionAuthority.getToken()?.userMetadata?.avatarUrl || null,

    loginSuccess: async (token, _anonymousId, user, signature) => {
        // SessionAuthority is the SSOT - update it atomically
        const userMetadata: UserMetadata = {
            alias: user.alias || 'Usuario',
            avatarUrl: user.avatar_url,
            email: user.email
        };

        sessionAuthority.login({
            token,
            authId: user.auth_id,
            anonymousId: user.anonymous_id,
            userMetadata,
            signature  // ✅ FIX: Pass backend HMAC signature for Identity Shield
        });

        // Update UI state
        set({
            isAuthenticated: true,
            isLoading: false,
            userAlias: userMetadata.alias,
            userAvatar: userMetadata.avatarUrl || null
        });

        // Full reload to ensure clean component state
        window.location.reload();
    },

    logout: () => {
        // Stop realtime channels before session state transition to avoid 401 reconnect loops.
        realtimeOrchestrator.clear();
        sessionAuthority.logout();
        
        set({
            isAuthenticated: false,
            isLoading: false,
            userAlias: null,
            userAvatar: null
        });

        window.location.reload();
    },

    // Sync UI state with SessionAuthority
    syncFromAuthority: () => {
        const token = sessionAuthority.getToken();
        const state = sessionAuthority.getState();
        
        set({
            isAuthenticated: state === SessionState.AUTHENTICATED,
            isLoading: state === SessionState.BOOTSTRAPPING,
            userAlias: token?.userMetadata?.alias || null,
            userAvatar: token?.userMetadata?.avatarUrl || null
        });
    }
}));

// Auto-sync on mount and state changes
if (typeof window !== 'undefined') {
    // Initial sync
    useAuthStore.getState().syncFromAuthority();
    
    // Subscribe to SessionAuthority changes
    sessionAuthority.subscribe(() => {
        useAuthStore.getState().syncFromAuthority();
    });
}
