import { queryWithRLS } from '../utils/rls.js';
import { isValidUuid } from '../utils/validation.js';
import { logError } from '../utils/logger.js';
import logger from '../utils/logger.js';

/**
 * GET /api/reports/:id/related
 * Get related reports (same category, nearby or same zone)
 *
 * Contrato y comportamiento preservados (extraccion literal desde reports.reads.js)
 */
export async function getRelatedReports(req, res) {
    try {
        const { id } = req.params;
        // 🔒 SECURITY FIX: Use verified identity from JWT if available
        const anonymousId = req.user?.anonymous_id || null;
        const userRole = req.user?.role || 'citizen';

        // Graceful handling for temp IDs
        if (id.startsWith('temp-') || !isValidUuid(id)) {
            return res.json({ success: true, data: [] });
        }

        // 1. Get reference report
        const referenceResult = await queryWithRLS(anonymousId, `
      SELECT category, latitude, longitude, zone, locality, province 
      FROM reports WHERE id = $1
    `, [id]);

        if (referenceResult.rows.length === 0) {
            return res.status(404).json({ error: 'Report not found' });
        }

        const { category, latitude, longitude, zone, locality } = referenceResult.rows[0];

        let query = '';
        let params = [];

        // 2. Query related
        // PRIORITY: Locality (Same City) > Zone (Same Neighborhood/Zone Name)
        if (locality) {
            // STRICT FILTER: Only reports in the same city
            query = `
        SELECT r.id, r.title, r.category, r.zone, r.incident_date, r.status, r.image_urls, r.latitude, r.longitude, r.created_at, r.locality,
               u.alias, u.avatar_url
        FROM reports r
        LEFT JOIN anonymous_users u ON r.anonymous_id = u.anonymous_id
        WHERE r.id != $2
          AND (r.is_hidden = false OR r.anonymous_id = $6 OR $7 = 'admin')
          AND (r.deleted_at IS NULL)
          AND r.locality = $5
        ORDER BY
          (r.category = $1) DESC, -- Best matches (same category) first
          r.location <-> ST_SetSRID(ST_MakePoint($4, $3), 4326) ASC -- Then nearest within city
        LIMIT 5
      `;
            params = [category, id, latitude || 0, longitude || 0, locality, anonymousId || '00000000-0000-0000-0000-000000000000', userRole];

        } else if (latitude && longitude) {
            // PostGIS KNN search by location (Fallback if no locality data)
            query = `
        SELECT r.id, r.title, r.category, r.zone, r.incident_date, r.status, r.image_urls, r.latitude, r.longitude, r.created_at, r.locality,
               u.alias, u.avatar_url
        FROM reports r
        LEFT JOIN anonymous_users u ON r.anonymous_id = u.anonymous_id
        WHERE r.id != $2
          AND (r.is_hidden = false OR r.anonymous_id = $5 OR $6 = 'admin')
          AND (r.deleted_at IS NULL)
          AND r.location IS NOT NULL
        ORDER BY
          (r.category = $1) DESC, 
          r.location <-> ST_SetSRID(ST_MakePoint($4, $3), 4326) ASC 
        LIMIT 5
      `;
            params = [category, id, latitude, longitude, anonymousId || '00000000-0000-0000-0000-000000000000', userRole];
        } else {
            // Fallback: Same zone (Text match)
            query = `
        SELECT r.id, r.title, r.category, r.zone, r.incident_date, r.status, r.image_urls, r.latitude, r.longitude, r.created_at, r.locality,
               u.alias, u.avatar_url
        FROM reports r
        LEFT JOIN anonymous_users u ON r.anonymous_id = u.anonymous_id
        WHERE r.id != $2
          AND (r.is_hidden = false OR r.anonymous_id = $4 OR $5 = 'admin')
          AND (r.deleted_at IS NULL)
          AND r.zone = $3
        ORDER BY 
          (r.category = $1) DESC,
          r.created_at DESC
        LIMIT 5
      `;
            params = [category, id, zone, anonymousId || '00000000-0000-0000-0000-000000000000', userRole];
        }

        const result = await queryWithRLS(anonymousId, query, params);

        // Initial Dev Log to verify results
        if (result.rows.length === 0) {
            logger.debug(`[RELATED] No related reports found for Report ${id} (Locality: ${locality}, Zone: ${zone})`);
        } else {
            logger.debug(`[RELATED] Found ${result.rows.length} related reports for Report ${id} (Locality: ${locality})`);
        }

        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        logError(error, req);
        res.status(500).json({ error: 'Failed to fetch related reports' });
    }
}
