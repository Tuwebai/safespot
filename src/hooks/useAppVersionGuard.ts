import { useEffect } from 'react';
import { useToast } from '@/components/ui/toast';
import { AppVersion, fetchRemoteVersion } from '@/lib/version';

/**
 * Enterprise Version Guard
 * 
 * Estrategia: "Stability First"
 * 1. MODO DEV: Desactivado totalmente.
 * 2. MODO PROD: Chequeo ÚNICO al inicio de la sesión.
 * 3. TRIGGER: Solo recarga si cambia la VERSION (SemVer).
 * 4. SEVERITY: "breaking" -> Reload Inmediato. "minor" -> User Prompt.
 */
export function useAppVersionGuard() {
    const toast = useToast();

    useEffect(() => {
        // 1. BYPASS EN DESARROLLO
        if (import.meta.env.DEV) {
            console.log('[AppVersionGuard] Modo Dev detectado: Guard desactivado.');
            return;
        }

        // 2. CHEQUEO ÚNICO POR SESIÓN
        const hasChecked = sessionStorage.getItem('ss_version_checked');
        if (hasChecked) {
            return;
        }

        const checkVersion = async () => {
            try {
                // Marcar como chequeado
                sessionStorage.setItem('ss_version_checked', 'true');

                const remote = await fetchRemoteVersion();
                if (!remote) return;

                const local = AppVersion;

                // 3. COMPARACIÓN SEMÁNTICA
                if (remote.version !== local.version) {
                    console.warn(`[AppVersionGuard] Version Update: ${local.version} -> ${remote.version} [${remote.severity}]`);

                    if (remote.severity === 'breaking') {
                        // CRITICAL: Force reload immediately to prevent data corruption
                        console.error('[AppVersionGuard] BREAKING CHANGE DETECTED. Forcing reload.');
                        localStorage.removeItem('vite:build');
                        window.location.reload();
                        return;
                    }

                    // MINOR/PATCH: Polite Notification
                    toast.info(`Nueva versión disponible (v${remote.version}).`, 5000);
                    // Opcional: Mostrar botón de "Actualizar" en el toast si la librería lo permite, 
                    // o simplemente dejar que la próxima visita actualice.
                    return;
                }

                if (remote.buildHash !== local.buildHash) {
                    console.info(`[AppVersionGuard] New build detected (v${remote.version} - ${remote.buildHash}). No action required.`);
                }

            } catch (error) {
                console.error('[AppVersionGuard] Error verificando versión:', error);
            }
        };

        const timer = setTimeout(checkVersion, 2000);
        return () => clearTimeout(timer);

    }, [toast]);
}
