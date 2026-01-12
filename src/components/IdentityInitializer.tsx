import { ReactNode, useEffect } from 'react';
import { initializeIdentity, ensureAnonymousId } from '@/lib/identity';

interface Props {
    children: ReactNode;
}

/**
 * IdentityInitializer
 * 
 * Initializes the anonymous identity system in React context with aggressive timeout.
 * Unlike the previous blocking approach, this allows React to mount immediately
 * while identity initialization happens in parallel.
 * 
 * @invariant This component MUST be high in the tree, before any components that need identity
 * @invariant ALWAYS shows children (never blocks UI)
 */
export function IdentityInitializer({ children }: Props) {
    useEffect(() => {
        let mounted = true;

        // HARD TIMEOUT: 2 seconds max for identity init
        const globalTimeout = setTimeout(() => {
            if (!mounted) return;

            console.warn('[IdentityInitializer] Global timeout (2s) - forcing emergency ID');
            ensureAnonymousId(); // Generate emergency ID
        }, 2000);

        // Attempt identity initialization
        initializeIdentity()
            .then(() => {
                if (!mounted) return;
                clearTimeout(globalTimeout);
                console.log('[IdentityInitializer] ✅ Identity initialized successfully');
            })
            .catch((error) => {
                if (!mounted) return;
                clearTimeout(globalTimeout);
                console.error('[IdentityInitializer] Identity init failed, using emergency ID:', error);
                ensureAnonymousId(); // Fallback to emergency ID
            });

        return () => {
            mounted = false;
            clearTimeout(globalTimeout);
        };
    }, []);

    // CRITICAL: Always render children
    // We don't block UI while identity is initializing
    // Components that need identity can use getAnonymousId() which has sync fallbacks
    return <>{children}</>;
}
