import express from 'express';
import { presenceTracker } from '../utils/presenceTracker.js';
import { requireAnonymousId } from '../utils/validation.js';

const router = express.Router();

/**
 * HEARTBEAT Endpoint
 * POST /api/presence/heartbeat
 * 
 * Client sends this every 30s to renew TTL in Redis.
 * 
 * Headers:
 *  X-Anonymous-Id: <uuid>
 */
router.post('/heartbeat', requireAnonymousId, async (req, res) => {
    try {
        const anonymousId = req.anonymousId;

        // Renew TTL in Redis
        await presenceTracker.markOnline(anonymousId);

        res.json({ status: 'ok', timestamp: Date.now() });
    } catch (error) {
        console.error('[Presence] Heartbeat failed:', error);
        // Fail soft - do not block client
        res.status(200).json({ status: 'ignored', error: 'Backend error' });
    }
});

export default router;
