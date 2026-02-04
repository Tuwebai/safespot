/**
 * Diagnostics Routes
 * 
 * Endpoints for logging frontend errors and performance metrics.
 * Fire-and-forget - should never block or fail critically.
 */

import express from 'express';
import logger from '../utils/logger.js';
const router = express.Router();

/**
 * POST /api/diagnostics/bootstrap-failure
 * 
 * Logs catastrophic bootstrap failures from the frontend.
 * Used to track infinite loading issues and identity initialization problems.
 * 
 * @rate-limited Client-side should rate-limit to 1 per session
 */
router.post('/bootstrap-failure', async (req, res) => {
    try {
        const {
            type,
            error,
            componentStack,
            timestamp,
            userAgent,
            url
        } = req.body;

        // Log to console (in production, send to monitoring service like Sentry)
        console.error('[DIAGNOSTIC] Bootstrap Failure:', {
            type,
            error: {
                message: error?.message,
                stack: error?.stack?.substring(0, 500), // Truncate for logging
            },
            componentStack: componentStack?.substring(0, 500),
            timestamp,
            userAgent: userAgent?.substring(0, 200),
            url,
        });

        // TODO: In production, send to monitoring service
        // Example:
        // await Sentry.captureException(new Error(error?.message || 'Bootstrap failure'), {
        //   tags: { type },
        //   contexts: {
        //     bootstrap: { componentStack, userAgent, url }
        //   }
        // });

        // Always return 200 OK to avoid blocking frontend
        res.status(200).json({
            success: true,
            message: 'Diagnostic logged',
        });
    } catch (err) {
        // Never throw - diagnostics should never break the app
        console.error('[DIAGNOSTIC] Error logging bootstrap failure:', err);
        res.status(200).json({
            success: false,
            message: 'Failed to log diagnostic, but continuing',
        });
    }
});

/**
 * POST /api/diagnostics/performance
 * 
 * Optional endpoint for logging performance metrics
 * (future enhancement)
 */
router.post('/performance', async (req, res) => {
    try {
        const { metrics, timestamp } = req.body;

        logger.debug('[DIAGNOSTIC] Performance metrics:', {
            metrics,
            timestamp,
        });

        res.status(200).json({ success: true });
    } catch (err) {
        console.error('[DIAGNOSTIC] Error logging performance:', err);
        res.status(200).json({ success: false });
    }
});

export default router;
