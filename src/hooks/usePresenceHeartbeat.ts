import { useEffect } from 'react';
import { getAnonymousId } from '@/lib/identity';

const HEARTBEAT_INTERVAL = 30000; // 30 seconds

/**
 * usePresenceHeartbeat
 * 
 * Sends a heartbeat to the backend every 30 seconds to maintain "Online" status in Redis.
 * This is the Client-Side half of the Distributed Presence System.
 */
export const usePresenceHeartbeat = () => {
    useEffect(() => {
        const sendHeartbeat = async () => {
            // Check Ghost Mode
            const isGhost = localStorage.getItem('safespot_ghost_mode') === 'true';
            if (isGhost) return;

            // ✅ P0 FIX: Use identity system instead of direct localStorage
            // getAnonymousId() uses cache + fallbacks, guaranteed correct key
            const anonymousId = getAnonymousId();
            if (!anonymousId) {
                console.warn('[Presence] Heartbeat skipped: identity not ready');
                return;
            }

            try {
                // We use fetch directly to avoid circular dependencies with api.ts or complex error handling
                // This is a fire-and-forget background task.
                const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
                // Normalize: Ensure baseUrl ends with /api but WITHOUT a trailing slash
                const baseUrl = rawApiUrl.replace(/\/$/, '').endsWith('/api')
                    ? rawApiUrl.replace(/\/$/, '')
                    : `${rawApiUrl.replace(/\/$/, '')}/api`;

                await fetch(`${baseUrl}/presence/heartbeat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Anonymous-Id': anonymousId
                    },
                    keepalive: true // Ensure request survives page navigation
                });
            } catch (err) {
                // Silently fail - presence is "soft state"
                if (import.meta.env.DEV) {
                    console.warn('[Presence] Heartbeat failed:', err);
                }
            }
        };

        // 1. Initial Ping on Mount
        sendHeartbeat();

        // 2. Interval Ping
        const intervalId = setInterval(() => {
            // Re-check ghost mode inside the interval to be reactive without re-mounting
            const isGhost = localStorage.getItem('safespot_ghost_mode') === 'true';
            if (!isGhost) {
                sendHeartbeat();
            }
        }, HEARTBEAT_INTERVAL);

        // 3. Visibility Change (Immediate Ping on Tab Focus)
        // This handles cases where the user comes back after >60s of background suspension
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                sendHeartbeat();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(intervalId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);
};
