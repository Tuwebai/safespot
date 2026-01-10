import express from 'express';
import { presenceTracker } from '../utils/presenceTracker.js';
// import { authenticateUser } from '../routes/adminAuth.js'; // Authentication not strictly required for heartbeat if using X-Anonymous-Id

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
router.post('/heartbeat', async (req, res) => {
    try {
        const anonymousId = req.headers['x-anonymous-id'];

        if (!anonymousId) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Missing X-Anonymous-Id header' });
        }

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
