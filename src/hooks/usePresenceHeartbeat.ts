import { useEffect, useRef } from 'react';
import { getAnonymousId } from '@/lib/identity';
import { ssePool } from '@/lib/ssePool';

const HEARTBEAT_INTERVAL = 30000; // 30 seconds

/**
 * usePresenceHeartbeat
 * 
 * Sends a heartbeat to the backend every 30 seconds to maintain "Online" status in Redis.
 * This is the Client-Side half of the Distributed Presence System.
 */
export const usePresenceHeartbeat = () => {
    const lastPingRef = useRef<number>(0);
    const PING_THROTTLE_MS = 5000; // 5 seconds minimum between pings

    useEffect(() => {
        const sendHeartbeat = async () => {
            // 🛑 THROTTLING: Prevent redundant pings within 5s (fixes StrictMode & rapid visibility toggles)
            const now = Date.now();
            if (now - lastPingRef.current < PING_THROTTLE_MS) {
                // console.debug('[Presence] Heartbeat throttled');
                return;
            }
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

            // 🏛️ PHASE 3: SSE-aware Heartbeat Optimization
            // Skip redundant HTTP heartbeat if SSE connection is healthy
            // SSE server heartbeat already renews TTL every 15s
            if (ssePool.isConnectionHealthy()) {
                if (import.meta.env.DEV && localStorage.getItem('debug_presence') === 'true') {
                    console.debug('[Presence] HTTP heartbeat skipped (SSE connected)');
                }
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

                lastPingRef.current = Date.now();
            } catch (err) {
                // Silently fail - presence is "soft state"
                // Do not warn in console to keep hygiene clean unless explicitly debugging presence
                if (import.meta.env.DEV && localStorage.getItem('debug_presence') === 'true') {
                    console.debug('[Presence] Heartbeat failed:', err);
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
