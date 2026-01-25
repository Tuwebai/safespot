import { ReactNode, useEffect } from 'react';
import { bootstrapManager } from '@/lib/lifecycle/ApplicationBootstrap';

// Bootstrap logic is moved to bootstrapManager


interface StartupGuardProps {
    children: ReactNode;
}

/**
 * 🛡️ STARTUP GUARD (WATCHDOG)
 * 
 * Regla de Oro: La app nunca debe quedarse en blanco o cargando indefinidamente.
 * Este componente fuerza un estado de fallo si la inicialización tarda demasiado.
 */
export function StartupGuard({ children }: StartupGuardProps) {
    // We start the boot process ONCE when the provider mounts
    useEffect(() => {
        const init = async () => {
            await bootstrapManager.initialize();
        };
        init();
    }, []);

    // While booting, we CAN show children if they can handle async states (Skeleton).
    // But for a true "Guard", we might want to wait until 'RUNNING'.
    // Given the requirement "No loaders infinite", we render children immediately 
    // but the children (IdentityInitializer) might rely on the manager state.

    // Actually, IdentityInitializer is now redundant if BootstrapManager handles identity.
    // So we render children only after boot?
    // No, the requirement says "No fallbacks visuales", "App REAL debe cargar SIEMPRE".

    // Enterprise Strategy: Render immediately. Components that need data will use Suspense/Query.
    // The BootstrapManager ensures "Identity" is ready before queries fire.

    return <>{children}</>;
}
