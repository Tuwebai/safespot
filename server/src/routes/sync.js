
import express from 'express';
import { eventStore } from '../services/eventStore.js';
import { logError } from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/sync
 * Event-Sourced Catchup Endpoint (M9/11)
 * Query Params:
 *  - since_id: BIGINT (Last processed sequence_id)
 *  - limit: INT (Default 100)
 */
router.get('/', async (req, res) => {
    try {
        const sinceId = parseInt(req.query.since_id);
        const limit = Math.min(parseInt(req.query.limit) || 100, 500);

        if (isNaN(sinceId)) {
            return res.status(400).json({
                error: 'Invalid parameter',
                message: 'since_id is required and must be a number'
            });
        }

        const events = await eventStore.getCatchup(sinceId, limit);

        res.json({
            success: true,
            data: {
                events: events.map(e => ({
                    sequence_id: e.sequence_id,
                    event_id: e.event_id,
                    aggregate_type: e.aggregate_type,
                    aggregate_id: e.aggregate_id,
                    event_type: e.event_type,
                    payload: e.payload,
                    metadata: e.metadata,
                    created_at: e.created_at
                })),
                meta: {
                    count: events.length,
                    latest_id: events.length > 0 ? events[events.length - 1].sequence_id : sinceId,
                    has_more: events.length === limit
                }
            }
        });

    } catch (err) {
        logError(err, { context: 'API_SYNC_FAIL', query: req.query });
        res.status(500).json({ error: 'Internal sync error' });
    }
});

export default router;
