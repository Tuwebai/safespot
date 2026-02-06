import { useState, useEffect } from 'react';
import { sessionAuthority, SessionState } from '@/engine/session/SessionAuthority';
import { IdentityInvariantViolation } from '@/lib/errors/IdentityInvariantViolation';

/**
 * useAnonymousId
 * 
 * v3 SSOT: Reactive Identity Hook
 * Reads exclusively from SessionAuthority.
 * 
 * @returns {string | null}
 *   - null: Identity is bootstrapping or uninitialized
 *   - string: Valid Anonymous ID from SessionAuthority
 */
export function useAnonymousId(): string | null {
    const [id, setId] = useState<string | null>(sessionAuthority.getAnonymousId());

    useEffect(() => {
        // Initial sync
        const currentId = sessionAuthority.getAnonymousId();
        if (currentId !== id) {
            setId(currentId);
        }

        // Subscribe to state changes
        const unsubscribe = sessionAuthority.subscribe(() => {
            const newId = sessionAuthority.getAnonymousId();
            setId(prev => prev === newId ? prev : newId);
        });

        return unsubscribe;
    }, [id]);

    return id;
}

/**
 * useAnonymousIdRequired
 * 
 * Hook for mutations requiring guaranteed identity.
 * Throws if identity is not ready.
 * 
 * @throws {IdentityInvariantViolation} If identity not ready
 */
export function useAnonymousIdRequired(): string {
    const id = useAnonymousId();

    if (!id) {
        throw new IdentityInvariantViolation(
            'Anonymous ID not ready. Ensure guardIdentityReady() was called.',
            'useAnonymousIdRequired',
            'anonymousId',
            null
        );
    }

    return id;
}

/**
 * useIsIdentityReady
 * 
 * Hook to check if identity is ready for mutations.
 */
export function useIsIdentityReady(): boolean {
    const [isReady, setIsReady] = useState(() => {
        const state = sessionAuthority.getState();
        return state === SessionState.READY || state === SessionState.AUTHENTICATED;
    });

    useEffect(() => {
        const unsubscribe = sessionAuthority.subscribe(() => {
            const state = sessionAuthority.getState();
            setIsReady(state === SessionState.READY || state === SessionState.AUTHENTICATED);
        });
        return unsubscribe;
    }, []);

    return isReady;
}

/**
 * useIsAuthenticated
 * 
 * Hook to check if user is fully authenticated.
 */
export function useIsAuthenticated(): boolean {
    const [isAuth, setIsAuth] = useState(() => 
        sessionAuthority.getState() === SessionState.AUTHENTICATED
    );

    useEffect(() => {
        const unsubscribe = sessionAuthority.subscribe(() => {
            setIsAuth(sessionAuthority.getState() === SessionState.AUTHENTICATED);
        });
        return unsubscribe;
    }, []);

    return isAuth;
}

/**
 * useAuthId
 * 
 * Returns authId if authenticated, null otherwise.
 */
export function useAuthId(): string | null {
    const [authId, setAuthId] = useState<string | null>(sessionAuthority.getAuthId());

    useEffect(() => {
        const unsubscribe = sessionAuthority.subscribe(() => {
            setAuthId(sessionAuthority.getAuthId());
        });
        return unsubscribe;
    }, []);

    return authId;
}

// Legacy compatibility
export const useAnonymousIdOrThrow = useAnonymousIdRequired;
