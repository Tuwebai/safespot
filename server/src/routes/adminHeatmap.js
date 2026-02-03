import express from 'express';
import { supabaseAdmin } from '../utils/db.js';
import { verifyAdminToken } from '../utils/adminMiddleware.js';

const router = express.Router();

/**
 * GET /api/admin/heatmap
 * Returns GeoJSON of recent reports for the heatmap
 */
router.get('/', verifyAdminToken, async (req, res) => {
    try {
        // 1. Fetch reports from the last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const { data: reports, error } = await supabaseAdmin
            .from('reports')
            .select('id, created_at, category, latitude, longitude')
            .gt('created_at', thirtyDaysAgo)
            .not('latitude', 'is', null) // Ensure coordinates exist
            .not('longitude', 'is', null);

        if (error) {
            console.error('❌ Error fetching heatmap data:', error);
            throw error;
        }

        // 2. Transform to GeoJSON FeatureCollection
        // Leaflet expects [lng, lat] for GeoJSON geometry, but [lat, lng] for markers.
        // GeoJSON standard is [longitude, latitude].
        const features = (reports || []).map(report => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [report.longitude, report.latitude]
            },
            properties: {
                id: report.id,
                type: report.category,
                created_at: report.created_at,
                intensity: 0.8 // Uniform intensity for now, can be dynamic based on type
            }
        }));

        const geoJson = {
            type: 'FeatureCollection',
            features: features
        };

        res.json(geoJson);

    } catch (error) {
        console.error('Admin Heatmap Error:', error);
        res.status(500).json({ error: 'Failed to fetch heatmap data' });
    }
});

export default router;
