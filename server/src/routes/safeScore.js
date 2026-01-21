import express from 'express';
import { SafeScoreService } from '../services/safeScoreService.js';
import { UserZoneService } from '../services/userZoneService.js';
import { logError } from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/safe-score
 * Obtiene el SafeScore para una ubicación arbitraria (lat, lng) o zone_id.
 * URL Params: lat, lng OR zone_id
 */
router.get('/', async (req, res) => {
    try {
        const { lat, lng, zone_id } = req.query;
        let targetZoneId = zone_id;

        if (!targetZoneId && lat && lng) {
            // Resolver zoneId on-the-fly sin persistir user_zone
            const geoData = await UserZoneService.resolveZoneName(lat, lng);
            if (geoData) {
                targetZoneId = UserZoneService.normalizeZoneId(geoData.city, geoData.province);
            }
        }

        if (!targetZoneId) {
            // Default or Error
            return res.json({
                success: true,
                data: { score: 100, breakdown: { note: 'Ubicación no resuelta' } }
            });
        }

        const scoreData = await SafeScoreService.getZoneScore(targetZoneId);

        res.json({
            success: true,
            data: {
                zoneId: targetZoneId,
                ...scoreData
            }
        });

    } catch (error) {
        logError(error, req);
        res.status(500).json({ error: 'Failed to fetch safe score' });
    }
});

export default router;
