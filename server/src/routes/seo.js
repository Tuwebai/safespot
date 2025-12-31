import express from 'express';
import { getReportPreview, getZones, getZonePreview, getGeneralAlertsPreview } from '../controllers/seoController.js';

const router = express.Router();

/**
 * GET /seo/zones
 * List all active zones for sitemap
 */
router.get('/zones', getZones);

/**
 * GET /seo/reporte/:id
 * Serves static HTML for report sharing
 */
router.get('/reporte/:id', getReportPreview);

/**
 * GET /seo/zone/:slug
 * Serves static HTML for neighborhood hubs
 */
router.get('/zone/:slug', getZonePreview);

/**
 * GET /seo/general
 * Serves static HTML for the main /alertas landing page
 */
router.get('/general', getGeneralAlertsPreview);

export default router;
