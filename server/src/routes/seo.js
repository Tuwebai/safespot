import express from 'express';
import { getReportPreview } from '../controllers/seoController.js';

const router = express.Router();

/**
 * GET /reporte/:id
 * Serves static HTML with Open Graph tags for social sharing
 */
router.get('/:id', getReportPreview);

export default router;
