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

    // 🧠 DEFINE SUBSCRIBE FUNCTION FIRST (To be used in useEffect)
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
            // Ensure SW is ready
            const registration = await navigator.serviceWorker.ready;

            // Convert Key
            const convertedVapidKey = urlBase64ToUint8Array(publicKey);

            // ⚠️ FORCE NEW SUBSCRIPTION
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });

            // 4. Send to Backend
            let location = null;
            try {
                // Quick timeout for location
                const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: false,
                        timeout: 5000
                    });
                });
                location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            } catch (e) {
                console.debug('[Push] GPS unavailable (Timeout/Denied). Subscribing with generic location scope.');
            }

            await apiRequest(SUBSCRIBE_URL, {
                method: 'POST',
                body: JSON.stringify({
                    subscription: subscription,
                    location: location
                })
            });

            setIsSubscribed(true);
            console.debug('[Push Authority] Subscription fresh and synced.');

        } catch (err) {
            console.error('Failed to subscribe:', err);
            error('No se pudo activar las notificaciones. Intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    }, [isSupported, success, error]);

    // Check current status on mount AND perform Authority Check
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
                const existingSubscription = await registration.pushManager.getSubscription();
                const currentPermission = Notification.permission;

                setPermission(currentPermission);

                // 🧠 PUSH AUTHORITY STRATEGY (WhatsApp-Grade)
                // Goal: If permission is granted, we MUST have a valid subscription.

                if (currentPermission === 'granted') {
                    if (existingSubscription) {
                        // We check if it's potentially stale or if we just want to ensure the backend has it.
                        // For maximum reliability, we re-subscribe to ensure the token is active.
                        console.debug('[Push Authority] Permission is GRANTED and subscription exists. Refreshing to ensure backend sync...');
                        await subscribe();
                    } else {
                        // Permission is granted but NO subscription? This is the "Root Cause" of the bug.
                        // We auto-subscribe silently.
                        console.debug('[Push Authority] Permission is GRANTED but NO subscription found. Auto-subscribing...');
                        await subscribe();
                    }
                } else {
                    // If not granted, we can't do much silently, just update state.
                    if (existingSubscription) {
                        setIsSubscribed(true);
                    } else {
                        setIsSubscribed(false);
                    }
                }

            } catch (err) {
                console.warn('[Push] Subscription check aborted (SW not ready or timeout).', err);
                setPermission(Notification.permission);
            } finally {
                setLoading(false);
            }
        };

        checkSubscription();
    }, [isSupported, subscribe]);

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
