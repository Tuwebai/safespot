import * as Sentry from "@sentry/react";

/**
 * Initialize Sentry for Enterprise Observability
 * 
 * Features enabled:
 * - Error Tracking: Auto-capture of unhandled exceptions
 * - Performance Tracing: Transparence on slow load times
 * - Session Replay: Video-like replay of errors (Critical for "Black Box" debugging)
 */
export const initSentry = () => {
    const dsn = import.meta.env.VITE_SENTRY_DSN;

    if (!dsn || dsn.includes("YOUR_DSN")) {
        console.warn("[Observability] Sentry DSN missing. Skipping initialization.");
        return;
    }

    Sentry.init({
        dsn: dsn,
        integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration({
                maskAllText: false, // SafeSpot context allows seeing text (except passwords)
                blockAllMedia: false,
            }),
        ],

        // Tracing
        tracesSampleRate: 1.0, // Start with 100% capture in Beta, reduce to 10% in Prod
        tracePropagationTargets: ["localhost", /^https:\/\/safespot\.netlify\.app/],

        // Session Replay
        replaysSessionSampleRate: 0.1, // Record 10% of all sessions
        replaysOnErrorSampleRate: 1.0, // Record 100% of sessions with errors

        environment: import.meta.env.MODE,

        // Sanitize Data
        beforeSend(event) {
            // Filter out noise or sensitive data if needed
            return event;
        },
    });

    console.debug("[Observability] ✅ Sentry initialized");
};

/**
 * Enterprise Error Boundary
 * Wraps critical components to prevent white screens while reporting to Sentry
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary;
