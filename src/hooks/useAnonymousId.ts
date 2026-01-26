import { useState, useEffect } from 'react';
import { sessionAuthority, SessionState } from '@/engine/session/SessionAuthority';

/**
 * useAnonymousId
 * 
 * ✅ MOTOR 2: Reactive Identity Hook
 * Subscribes to SessionAuthority for real-time identity updates.
 * 
 * @returns {string | null}
 *   - null: Identity is bootstrapping or failed.
 *   - string: Valid Anonymous ID from the active session.
 */
export function useAnonymousId(): string | null {
    const [id, setId] = useState<string | null>(sessionAuthority.getAnonymousId());

    useEffect(() => {
        // 1. Initial sync
        const currentId = sessionAuthority.getAnonymousId();
        if (currentId !== id) setId(currentId);

        // 2. Subscribe to state changes
        const unsubscribe = sessionAuthority.subscribe((state) => {
            const newId = sessionAuthority.getAnonymousId();
            if (newId !== id) {
                setId(newId);
                if (state === SessionState.READY) {
                    console.log('[useAnonymousId] ✅ Identity resolved via Motor 2:', newId?.substring(0, 8));
                }
            }
        });

        return unsubscribe;
    }, [id]);

    return id;
}

/**
 * useAnonymousIdOrThrow
 * 
 * Variant that throws if identity is not ready.
 * Use ONLY in components that absolutely require identity (e.g., profile page).
 * 
 * Most components should use useAnonymousId() + enabled flag instead.
 */
export function useAnonymousIdOrThrow(): string {
    const id = useAnonymousId();

    if (!id) {
        throw new Error(
            'Anonymous ID not initialized. Wrap component in Suspense or use useAnonymousId() with conditional rendering.'
        );
    }

    return id;
}
