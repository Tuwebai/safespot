import express from 'express';
import { getReportPreview, getZones, getZonePreview } from '../controllers/seoController.js';

const router = express.Router();

/**
 * GET /api/seo/zones
 * List all active zones for sitemap and programmatic SEO
 */
router.get('/zones', getZones);

/**
 * GET /reporte/:id
 * Serves static HTML with Open Graph tags for social sharing
 */
router.get('/:id', getReportPreview);

/**
 * GET /zone/:slug
 * Serves static HTML for neighborhood hubs
 */
router.get('/zone/:slug', getZonePreview);

export default router;
