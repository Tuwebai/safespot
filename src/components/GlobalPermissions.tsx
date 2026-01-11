import { useEffect } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { geocodeApi, notificationsApi } from '@/lib/api';

/**
 * Global Permissions Manager
 * 
 * Responsibilities:
 * 1. Request Location Permission immediately on mount.
 * 2. Request Push Notification Permission immediately on mount.
 * 3. Sync Location to Backend if granted.
 * 
 * Behavior:
 * - If permission is 'prompt', it triggers the browser popup.
 * - If permission is 'granted', it silently syncs data.
 * - If permission is 'denied', it does nothing (respects user decision).
 */
export function GlobalPermissions() {
    const { subscribeSilent } = usePushNotifications();

    useEffect(() => {
        // 1. PUSH NOTIFICATIONS (Aggressive)
        // We call this immediately. Browser will decide whether to show popup or not.
        // User asked: "Pedir apenas entra".
        subscribeSilent();
    }, [subscribeSilent]);

    useEffect(() => {
        // 2. LOCATION (Aggressive)
        if (!navigator.geolocation) return;

        // Check current state first to avoid unnecessary prompts if denied?
        // User asked to prompt on entry.
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                // Success! User granted permission (or already had it)
                try {
                    const { latitude, longitude } = pos.coords;

                    // a) Update Push Service Location
                    // (Done effectively by notificationsApi below if we wanted, but let's do dedicated calls)

                    // b) Update Backend Settings (The "Golden Rule" logic handles safe updates)
                    let city: string | null = null;
                    let province: string | null = null;

                    // Attempt Reverse Geo (Silent)
                    try {
                        const geo = await geocodeApi.reverse(latitude, longitude);
                        if (geo && geo.address) {
                            city = geo.address.city || geo.address.municipality || geo.address.town || null;
                            province = geo.address.province || geo.address.state || null;
                        }
                    } catch (e) { /* ignore silent fail */ }

                    await notificationsApi.updateSettings({
                        lat: latitude,
                        lng: longitude,
                        city: city, // Backend handles NULL vs undefined logic we fixed earlier
                        province: province
                    });

                    console.log('[GlobalPermissions] Location synced successfully');

                } catch (e) {
                    console.error('[GlobalPermissions] Sync error', e);
                }
            },
            (err) => {
                // Error / Denied
                // We do NOT show a toast here to avoid annoying the user if they blocked it on purpose.
                if (err.code === err.PERMISSION_DENIED) {
                    console.log('[GlobalPermissions] Location denied by user');
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000 // Accept cache from last 5 mins
            }
        );

    }, []);

    return null; // Headless
}
