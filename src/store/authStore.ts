
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

// ... (imports remain)
interface AuthState {
    token: string | null;
    user: User | null;
    isAuthenticated: boolean;
    isInitializing: boolean; // 🆕 Critical for StartupGuard

    // Actions
    loginSuccess: (token: string, anonymousId: string, user: User) => Promise<void>;
    logout: () => void;
    syncIdentity: () => void;
    setInitialized: () => void; // 🆕 Manual override if needed
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            token: null,
            user: null,
            isAuthenticated: false,
            isInitializing: true, // Start in loading state

            loginSuccess: async (token, anonymousId, user) => {
                await updateIdentity(anonymousId);
                set({
                    token,
                    user,
                    isAuthenticated: true
                });
                window.location.reload();
            },

            logout: () => {
                set({
                    token: null,
                    user: null,
                    isAuthenticated: false
                });
                window.location.reload();
            },

            syncIdentity: () => {
                const currentId = getAnonymousId();
                const user = get().user;
                if (user && user.anonymous_id !== currentId) {
                    console.warn('[AuthStore] Identity mismatch. Forcing logout safety.');
                    get().logout();
                }
            },

            setInitialized: () => set({ isInitializing: false })
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                token: state.token,
                user: state.user,
                isAuthenticated: state.isAuthenticated
            }),
            // ⚡ HYDRATION LIFECYCLE
            onRehydrateStorage: () => (state) => {
                // console.debug('[AuthStore] 💧 Hydration finished');
                // Ensure we unset initializing when storage is loaded
                state?.setInitialized();
            }
        }
    )
);
