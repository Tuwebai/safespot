import express from 'express';
import { requireAnonymousId } from '../utils/validation.js';
import { validate } from '../utils/validateMiddleware.js';
import { userZoneSchema } from '../utils/schemas.js';
import { DB } from '../utils/db.js';
import { logError } from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/user-zones
 * List all priority zones for the user
 */
router.get('/', requireAnonymousId, async (req, res) => {
    try {
        const anonymousId = req.anonymousId;
        const db = DB.withContext(anonymousId);

        const zones = await db.select('user_zones', {
            where: { anonymous_id: anonymousId },
            orderBy: [{ column: 'created_at', direction: 'desc' }]
        });

        res.json({ success: true, data: zones });
    } catch (error) {
        logError(error, req);
        res.status(500).json({ error: 'Failed to fetch user zones' });
    }
});

/**
 * POST /api/user-zones
 * Create or update a priority zone
 */
router.post('/', requireAnonymousId, validate(userZoneSchema), async (req, res) => {
    try {
        const anonymousId = req.anonymousId;
        const db = DB.withContext(anonymousId);
        const { type, lat, lng, radius_meters, label } = req.body;

        const latitude = Number(lat);
        const longitude = Number(lng);

        // Use upsert-like logic via raw query to handle the UNIQUE constraint on (anonymous_id, type)
        const result = await db.query(`
            INSERT INTO user_zones (anonymous_id, type, lat, lng, radius_meters, label)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (anonymous_id, type) 
            DO UPDATE SET 
                lat = EXCLUDED.lat,
                lng = EXCLUDED.lng,
                radius_meters = EXCLUDED.radius_meters,
                label = EXCLUDED.label,
                updated_at = NOW()
            RETURNING *
        `, [
            anonymousId,
            type,
            latitude,
            longitude,
            radius_meters || 500,
            label || null
        ]);

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        logError(error, req);
        res.status(500).json({ error: 'Failed to save user zone' });
    }
});

/**
 * DELETE /api/user-zones/:type
 * Remove a priority zone by type
 */
router.delete('/:type', requireAnonymousId, async (req, res) => {
    try {
        const { type } = req.params;
        const anonymousId = req.anonymousId;
        const db = DB.withContext(anonymousId);

        const deleted = await db.delete('user_zones', {
            anonymous_id: anonymousId,
            type: type
        });

        if (deleted.length === 0) {
            return res.status(404).json({ error: 'Zone not found' });
        }

        res.json({ success: true, message: `Zone ${type} deleted` });
    } catch (error) {
        logError(error, req);
        res.status(500).json({ error: 'Failed to delete zone' });
    }
});

export default router;
