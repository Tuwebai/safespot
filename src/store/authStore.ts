
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { updateIdentity, getAnonymousId } from '../lib/identity';

interface User {
    email: string;
    auth_id: string;
    anonymous_id: string; // The ID linked to this account
    provider?: string; // 'google' | 'email'
    avatar_url?: string;
    alias?: string; // 🔵 FIX #11: Display name for UX
}

interface AuthState {
    token: string | null;
    user: User | null;
    isAuthenticated: boolean;

    // Actions
    loginSuccess: (token: string, anonymousId: string, user: User) => Promise<void>;
    logout: () => void;
    syncIdentity: () => void; // Ensures store matches localStorage
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            token: null,
            user: null,
            isAuthenticated: false,

            loginSuccess: async (token, anonymousId, user) => {
                // 1. Update Persistent Identity (L1, L2, L3)
                // This is the CRITICAL "Swap Identity" step.
                // We replace the local anonymous_id with the one returned by the server.
                await updateIdentity(anonymousId);

                // 2. Set State
                set({
                    token,
                    user,
                    isAuthenticated: true
                });

                // 3. Force Reload to reset all app state (sockets, react-query, components)
                // usage: Component calling this should handle the reload UI feedback
                window.location.reload();
            },

            logout: () => {
                // 1. Clear Token
                set({
                    token: null,
                    user: null,
                    isAuthenticated: false
                });

                // 2. We DO NOT clear anonymous_id. 
                // The user reverts to being an anonymous user with the SAME identity.

                // 3. Reload to clear sensitive memory state
                window.location.reload();
            },

            syncIdentity: () => {
                // Optional helper to check consistency
                const currentId = getAnonymousId();
                const user = get().user;
                if (user && user.anonymous_id !== currentId) {
                    console.warn('[AuthStore] Identity mismatch detected. Forcing logout safety.');
                    get().logout();
                }
            }
        }),
        {
            name: 'auth-storage', // name of the item in the storage (must be unique)
            partialize: (state) => ({ token: state.token, user: state.user, isAuthenticated: state.isAuthenticated }), // Only persist these fields
        }
    )
);
