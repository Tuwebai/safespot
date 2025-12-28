/**
 * usePushNotifications Hook
 * 
 * Manages Web Push API subscriptions with privacy-first approach.
 * Only requests permission when user explicitly opts in.
 */

import { useState, useCallback, useEffect } from 'react';
import { useToast } from '@/components/ui/toast';
import { ensureAnonymousId } from '@/lib/identity';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ============================================
// TYPES
// ============================================

interface PushStatus {
    isSupported: boolean;
    isSubscribed: boolean;
    permission: NotificationPermission | 'default';
    radius: number;
    hasLocation: boolean;
    isLoading: boolean;
    error: string | null;
}

// ============================================
// HOOK
// ============================================

export function usePushNotifications() {
    const toast = useToast();
    const [status, setStatus] = useState<PushStatus>({
        isSupported: false,
        isSubscribed: false,
        permission: 'default',
        radius: 500,
        hasLocation: false,
        isLoading: true,
        error: null
    });

    // Check if push is supported
    const isSupported = typeof window !== 'undefined'
        && 'serviceWorker' in navigator
        && 'PushManager' in window
        && 'Notification' in window;

    // ============================================
    // INITIALIZATION
    // ============================================

    useEffect(() => {
        if (!isSupported) {
            setStatus(prev => ({ ...prev, isSupported: false, isLoading: false }));
            return;
        }

        checkStatus();
    }, [isSupported]);

    // Check current subscription status
    const checkStatus = useCallback(async () => {
        try {
            setStatus(prev => ({ ...prev, isLoading: true, error: null }));

            const anonymousId = ensureAnonymousId();
            const response = await fetch(`${API_BASE}/api/push/status`, {
                headers: { 'X-Anonymous-Id': anonymousId }
            });

            if (!response.ok) {
                throw new Error('Failed to check status');
            }

            const { data } = await response.json();

            setStatus(prev => ({
                ...prev,
                isSupported: true,
                isSubscribed: data.isSubscribed || false,
                permission: Notification.permission,
                radius: data.radius || 500,
                hasLocation: data.hasLocation || false,
                isLoading: false
            }));
        } catch (error) {
            console.error('Error checking push status:', error);
            setStatus(prev => ({
                ...prev,
                isSupported: true,
                isLoading: false,
                error: 'Error verificando estado'
            }));
        }
    }, []);

    // ============================================
    // SUBSCRIBE
    // ============================================

    const subscribe = useCallback(async (radius: number = 500) => {
        if (!isSupported) {
            toast.error('Tu navegador no soporta notificaciones push');
            return false;
        }

        try {
            setStatus(prev => ({ ...prev, isLoading: true, error: null }));

            // 1. Request notification permission
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                toast.warning('Necesitamos permiso para enviarte alertas');
                setStatus(prev => ({ ...prev, permission, isLoading: false }));
                return false;
            }

            // 2. Request geolocation
            let location: { lat: number; lng: number } | null = null;
            try {
                const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: false,
                        timeout: 10000,
                        maximumAge: 300000 // 5 min cache
                    });
                });
                location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
            } catch (geoError) {
                toast.error('Necesitamos tu ubicación para alertas cercanas');
                setStatus(prev => ({ ...prev, isLoading: false }));
                return false;
            }

            // 3. Register service worker
            const registration = await navigator.serviceWorker.register('/sw.js');
            await navigator.serviceWorker.ready;

            // 4. Get VAPID public key
            const vapidResponse = await fetch(`${API_BASE}/api/push/vapid-key`);
            if (!vapidResponse.ok) {
                throw new Error('Push no configurado en el servidor');
            }
            const { publicKey } = await vapidResponse.json();

            // 5. Subscribe to push
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource
            });

            // 6. Send subscription to backend
            const anonymousId = ensureAnonymousId();
            const response = await fetch(`${API_BASE}/api/push/subscribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Anonymous-Id': anonymousId
                },
                body: JSON.stringify({
                    subscription: subscription.toJSON(),
                    location,
                    radius
                })
            });

            if (!response.ok) {
                throw new Error('Error guardando suscripción');
            }

            toast.success('¡Alertas activadas! Te avisaremos de reportes cercanos.');

            setStatus(prev => ({
                ...prev,
                isSubscribed: true,
                permission: 'granted',
                radius,
                hasLocation: true,
                isLoading: false
            }));

            return true;
        } catch (error) {
            console.error('Error subscribing to push:', error);
            const message = error instanceof Error ? error.message : 'Error activando alertas';
            toast.error(message);
            setStatus(prev => ({ ...prev, isLoading: false, error: message }));
            return false;
        }
    }, [isSupported, toast]);

    // ============================================
    // UNSUBSCRIBE
    // ============================================

    const unsubscribe = useCallback(async () => {
        try {
            setStatus(prev => ({ ...prev, isLoading: true }));

            const anonymousId = ensureAnonymousId();
            await fetch(`${API_BASE}/api/push/subscribe`, {
                method: 'DELETE',
                headers: { 'X-Anonymous-Id': anonymousId }
            });

            toast.success('Alertas desactivadas');

            setStatus(prev => ({
                ...prev,
                isSubscribed: false,
                isLoading: false
            }));

            return true;
        } catch (error) {
            console.error('Error unsubscribing:', error);
            toast.error('Error desactivando alertas');
            setStatus(prev => ({ ...prev, isLoading: false }));
            return false;
        }
    }, [toast]);

    // ============================================
    // UPDATE LOCATION
    // ============================================

    const updateLocation = useCallback(async () => {
        if (!status.isSubscribed) return;

        try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: false,
                    timeout: 10000,
                    maximumAge: 300000
                });
            });

            const anonymousId = ensureAnonymousId();
            await fetch(`${API_BASE}/api/push/location`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Anonymous-Id': anonymousId
                },
                body: JSON.stringify({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                })
            });

            setStatus(prev => ({ ...prev, hasLocation: true }));
        } catch (error) {
            console.error('Error updating location:', error);
        }
    }, [status.isSubscribed]);

    return {
        ...status,
        subscribe,
        unsubscribe,
        updateLocation,
        checkStatus
    };
}

// ============================================
// UTILITIES
// ============================================

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
