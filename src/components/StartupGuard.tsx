import { ReactNode, useEffect, useState } from 'react';
import { GlobalErrorFallback } from './GlobalErrorFallback';
import { useAuthStore } from '@/store/authStore';

const BOOTSTRAP_TIMEOUT_MS = 5000; // 5 segundos máximo para arrancar

type BootState = 'booting' | 'ready' | 'timeout' | 'error';

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
    const [bootState, setBootState] = useState<BootState>('booting');
    const isInitializing = useAuthStore(state => state.isInitializing); // Necesitaremos agregar esto al store

    useEffect(() => {
        let timeoutId: NodeJS.Timeout;

        if (bootState === 'booting') {
            // 1. Iniciar Watchdog Timer
            timeoutId = setTimeout(() => {
                console.error('[StartupGuard] 🚨 Bootstrap timeout triggered (5000ms). Forcing fallback.');
                setBootState('timeout');
            }, BOOTSTRAP_TIMEOUT_MS);
        }

        // 2. Verificar si Auth Store terminó de inicializar
        if (!isInitializing && bootState === 'booting') {
            clearTimeout(timeoutId!);
            setBootState('ready');
        }

        return () => clearTimeout(timeoutId);
    }, [bootState, isInitializing]);

    // ✅ ENTERPRISE CHANGE: Phase 0 - Render Immediately
    // We do NOT block the UI while booting. We render content with placeholders.
    // If timeout occurs, we trigger a "Degraded Mode" toast/alert, but we KEEP rendering.

    if (bootState === 'timeout') {
        // NON-BLOCKING ERROR: Just log or show toast via effect, but return children
        // For now, if strictly required by user to "never show global error", we render children.
        // We could inject a context here to tell children "we are in degraded mode".
        return <>{children}</>;
    }

    if (bootState === 'error') {
        return (
            <GlobalErrorFallback
                title="Error Crítico"
                message="Falló la secuencia de arranque. Intenta recargar."
            />
        );
    }

    // While booting, just render children. 
    // Components inside should handle "loading" states via skeleton UI.
    return <>{children}</>;
}
