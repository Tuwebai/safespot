import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * 🛰️ PushNotificationListener
 * 
 * Este componente no renderiza nada. Su única responsabilidad es escuchar
 * los mensajes (postMessage) provenientes del Service Worker para ejecutar
 * navegaciones reactivas cuando el usuario toca una notificación Push.
 */
export function PushNotificationListener() {
    const navigate = useNavigate();

    useEffect(() => {
        const handleServiceWorkerMessage = (event: MessageEvent) => {
            // Verificar origen por seguridad si es necesario, 
            // aunque en SW suele ser el mismo origen.
            const { type, url } = event.data || {};

            if (type === 'NAVIGATE_TO' && url) {
                console.log(`[PushListener] 🧭 Navegando a: ${url}`);

                // Normalizar URL (quitar origen si viene completo)
                const relativeUrl = url.replace(window.location.origin, '');

                // Ejecutar navegación en el contexto de React Router
                navigate(relativeUrl);
            }
        };

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);

            // También escuchar mensajes de BroadcastChannel si el SW los usara en el futuro
            // const channel = new BroadcastChannel('safespot_push_sync');
            // channel.onmessage = handleServiceWorkerMessage;
        }

        return () => {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
            }
        };
    }, [navigate]);

    return null; // Invisible
}
