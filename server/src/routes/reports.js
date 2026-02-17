import express from 'express';
import multer from 'multer';
import { requireAnonymousId } from '../utils/validation.js';
import { flagRateLimiter, favoriteLimiter, imageUploadLimiter, createReportLimiter } from '../utils/rateLimiter.js';
import { exportReportPDF } from '../controllers/exportController.js';
import { verifyUserStatus } from '../middleware/moderation.js';
import { toggleFavorite, likeReport, unlikeReport, patchReport, flagReport, deleteReport, createReport, shareReport, uploadReportImages } from './reports.mutations.js';
import { getReportsList, getRelatedReports, getReportById } from './reports.reads.js';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Archivo de imagen inválido: formato no permitido'), false);
    }
  }
});

/**
 * GET /api/reports
 * List all reports with optional filters and pagination
 * Uses Cursor-based pagination (created_at DESC, id DESC) for infinite scroll performance
 * Query params: search, category, zone, status, limit, cursor
 */
router.get('/', getReportsList);

/**
 * GET /api/reports/:id/export/pdf
 * Export report as PDF
 */
router.get('/:id/pdf', exportReportPDF);

/**
 * GET /api/reports/:id
 * Get a single report by ID
 * Optional: includes is_favorite and is_flagged if X-Anonymous-Id header is present
 */
router.get('/:id', getReportById);

/**
 * POST /api/reports
 * Create a new report
 * Body: title, description, category, latitude, longitude, zone (opt), image (opt)
 */
router.post('/',
  requireAnonymousId,
  verifyUserStatus, // Enforce Ban
  createReportLimiter, // ✅ Limit: 3/min
  imageUploadLimiter,
  upload.array('images', 3),
  createReport);

/**
 * GET /api/reports/:id/related
 * Get related reports (same category, nearby or same zone)
 */
router.get('/:id/related', getRelatedReports);

/**
 * PATCH /api/reports/:id
 * Update a report (only by creator)
 * Requires: X-Anonymous-Id header
 */
router.patch('/:id', requireAnonymousId, patchReport);
/**
 * POST /api/reports/:id/favorite
 * Toggle favorite status for a report
 * Requires: X-Anonymous-Id header
 * Rate limited: 20 per minute, 100 per hour
 */
router.post('/:id/favorite', favoriteLimiter, requireAnonymousId, toggleFavorite);

/**
 * POST /api/reports/:id/like
 * Add a like to a report
 * Requires: X-Anonymous-Id header
 */
router.post('/:id/like', favoriteLimiter, requireAnonymousId, likeReport);

/**
 * DELETE /api/reports/:id/like
 * Remove a like from a report
 */
router.delete('/:id/like', favoriteLimiter, requireAnonymousId, unlikeReport);

/**
 * POST /api/reports/:id/flag
 * Flag a report as inappropriate
 * Requires: X-Anonymous-Id header
 * Rate limited: 5 flags per minute per anonymous ID
 */
router.post('/:id/flag', flagRateLimiter, requireAnonymousId, flagReport);
/**
 * DELETE /api/reports/:id
 * Delete a report (only by creator)
 * Requires: X-Anonymous-Id header
 */
router.delete('/:id', requireAnonymousId, deleteReport);

/**
 * POST /api/reports/:id/images
 * Upload images for a report
 * Requires: X-Anonymous-Id header
 * Accepts: multipart/form-data with image files
 * Rate limited: 5 per minute, 20 per hour
 */

router.post('/:id/images', imageUploadLimiter, requireAnonymousId, upload.array('images', 5), uploadReportImages);

/**
 * POST /api/reports/:id/share
 * Register a share event and notify report owner
 */
router.post('/:id/share', requireAnonymousId, shareReport);

export default router;







