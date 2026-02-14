import { useEffect } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

/**
 * 🔔 PushNotificationInitializer
 * 
 * Componente invisible que inicializa las notificaciones push.
 * Se monta una sola vez al iniciar la app y gestiona:
 * - Solicitud de permisos
 * - Suscripción al servicio de push
 * - Sincronización con el backend
 */
export function PushNotificationInitializer() {
    const { isSupported, isSubscribed, permission, subscribe, loading } = usePushNotifications();

    useEffect(() => {
        // Log de estado para debugging
        console.log('[PushInitializer] Estado:', {
            isSupported,
            isSubscribed,
            permission,
            loading
        });

        // Auto-subscribir en modo DEV si es necesario
        if (isSupported && !loading && permission === 'default') {
            const isDevMode = import.meta.env.DEV || window.location.port === '4173';
            if (isDevMode) {
                console.log('[PushInitializer] Auto-subscribiendo en modo DEV...');
                subscribe().catch(err => {
                    console.warn('[PushInitializer] Auto-subscribe failed:', err);
                });
            }
        }
    }, [isSupported, isSubscribed, permission, loading, subscribe]);

    return null; // Componente invisible
}
