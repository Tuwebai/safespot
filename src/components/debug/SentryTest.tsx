import { useEffect } from 'react';

/**
 * Enterprise Diagnostic Tool: Sentry Test
 * 
 * Renders a hidden component that throws an error when a specific
 * window event is triggered ('sentry-test').
 * 
 * Usage from console: 
 * window.dispatchEvent(new Event('sentry-test'))
 */
export function SentryTest() {
    useEffect(() => {
        const trigger = () => {
            console.log('[Sentry Probe] 🚨 Simulating Crash for Verification...');
            throw new Error("SafeSpot Enterprise: Sentry Verification Error " + Date.now());
        };

        window.addEventListener('sentry-test', trigger);
        return () => window.removeEventListener('sentry-test', trigger);
    }, []);

    return null; // Invisible
}
