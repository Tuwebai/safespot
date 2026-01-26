import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../lib/api';
import { useToast } from '../components/ui/toast/useToast';

const VAPID_PUBLIC_KEY_URL = '/push/vapid-key';
const SUBSCRIBE_URL = '/push/subscribe';

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export function usePushNotifications() {
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [loading, setLoading] = useState(true);
    const [permission, setPermission] = useState<NotificationPermission>('default');

    // Custom toast context
    const { success, error } = useToast();

    // Check supported browser
    const isSupported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

    // Check current status on mount
    useEffect(() => {
        if (!isSupported) {
            setLoading(false);
            return;
        }

        const checkSubscription = async () => {
            try {
                // ✅ ENTERPRISE RESILIENCE: 5s timeout for SW ready
                const swReady = Promise.race([
                    navigator.serviceWorker.ready,
                    new Promise((_, reject) => setTimeout(() => reject(new Error('SW Timeout')), 5000))
                ]) as Promise<ServiceWorkerRegistration>;

                const registration = await swReady;
                const subscription = await registration.pushManager.getSubscription();

                if (subscription) {
                    setIsSubscribed(true);
                    // 🧠 PROACTIVE AUTO-SYNC (Identity Bridge)
                    // If we have a subscription, we refresh it on the backend to ensure 
                    // the current anonymous_id is linked to this endpoint.
                    // This is silent and non-blocking.
                    console.log('[Push] Active subscription found. Triggering identity sync...');
                    apiRequest(SUBSCRIBE_URL, {
                        method: 'POST',
                        body: JSON.stringify({
                            subscription: subscription,
                            location: null // Location is updated separately via updateServiceLocation if needed
                        })
                    }).then(() => console.log('[Push] Identity sync successful.'))
                        .catch(e => console.warn('[Push] Identity sync failed (ignored):', e));
                } else {
                    setIsSubscribed(false);
                }

                setPermission(Notification.permission);
            } catch (err) {
                console.warn('[Push] Subscription check aborted (SW not ready or timeout).', err);
                setPermission(Notification.permission);
            } finally {
                setLoading(false);
            }
        };

        checkSubscription();
    }, [isSupported]);

    const subscribe = useCallback(async () => {
        if (!isSupported) {
            error('Tu navegador no soporta notificaciones push.');
            return;
        }

        setLoading(true);
        try {
            // 1. Request Permission
            const perm = await Notification.requestPermission();
            setPermission(perm);

            if (perm !== 'granted') {
                error('Necesitas dar permiso para recibir notificaciones.');
                setLoading(false);
                return;
            }

            // 2. Get VAPID Key
            const response = await apiRequest<{ publicKey: string }>(VAPID_PUBLIC_KEY_URL);
            const publicKey = response.publicKey;

            if (!publicKey) throw new Error('No VAPID key available');

            // 3. Subscribe in Browser
            const registration = await navigator.serviceWorker.ready;
            const convertedVapidKey = urlBase64ToUint8Array(publicKey);

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });

            // 4. Send to Backend
            // Try to get location, but don't fail subscription if it's denied/unavailable
            let location = null;
            try {
                const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: false,
                        timeout: 5000
                    });
                });
                location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            } catch (e) {
                console.log('[Push] GPS unavailable (Timeout/Denied). Subscribing with generic location scope.');
                // Proceed with location = null
            }

            await apiRequest(SUBSCRIBE_URL, {
                method: 'POST',
                body: JSON.stringify({
                    subscription: subscription,
                    location: location // Can be null now
                })
            });

            setIsSubscribed(true);
            success('Notificaciones activadas. Ahora recibirás alertas.');

        } catch (err) {
            console.error('Failed to subscribe:', err);
            error('No se pudo activar las notificaciones. Intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    }, [isSupported, success, error]);

    const unsubscribe = useCallback(async () => {
        setLoading(true);
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                await subscription.unsubscribe();
                // Optionally notify backend to delete/deactivate
                try {
                    await apiRequest(SUBSCRIBE_URL, {
                        method: 'DELETE'
                    });
                } catch (e) {
                    console.warn('Backend unsubscribe failed, but local is done', e);
                }
            }

            setIsSubscribed(false);
            success('Notificaciones desactivadas.');
        } catch (err) {
            console.error('Error unsubscribing', err);
            error('Error al desactivar notificaciones.');
        } finally {
            setLoading(false);
        }
    }, [success, error]);

    const updateServiceLocation = useCallback(async (lat: number, lng: number) => {
        if (!isSubscribed) return;
        try {
            await apiRequest('/push/location', {
                method: 'PATCH',
                body: JSON.stringify({ lat, lng })
            });
        } catch (e) {
            console.error('Failed to update push location', e);
        }
    }, [isSubscribed]);

    return {
        isSupported,
        isSubscribed,
        loading,
        permission,
        subscribe,
        unsubscribe,
        updateServiceLocation
    };
}
