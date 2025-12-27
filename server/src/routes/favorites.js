import express from 'express';
import { requireAnonymousId } from '../utils/validation.js';
import { logError } from '../utils/logger.js';
import { ensureAnonymousUser } from '../utils/anonymousUser.js';
import { queryWithRLS } from '../utils/rls.js';

const router = express.Router();

/**
 * GET /api/favorites
 * Get all favorite reports for the current anonymous user
 * Requires: X-Anonymous-Id header
 */
router.get('/', requireAnonymousId, async (req, res) => {
  try {
    const anonymousId = req.anonymousId;

    // Ensure anonymous user exists
    try {
      await ensureAnonymousUser(anonymousId);
    } catch (error) {
      logError(error, req);
      return res.status(500).json({
        error: 'Failed to ensure anonymous user',
        message: error.message
      });
    }

    // Get favorites with report details using queryWithRLS for RLS enforcement
    const result = await queryWithRLS(
      anonymousId,
      `SELECT 
        f.id,
        f.created_at,
        r.id as report_id,
        r.anonymous_id as report_anonymous_id,
        r.title,
        r.description,
        r.category,
        r.zone,
        r.address,
        r.latitude,
        r.longitude,
        r.status,
        r.upvotes_count,
        r.comments_count,
        r.created_at as report_created_at,
        r.updated_at as report_updated_at,
        r.incident_date,
        r.image_urls
      FROM favorites f
      INNER JOIN reports r ON f.report_id = r.id
      WHERE f.anonymous_id = $1
      ORDER BY f.created_at DESC`,
      [anonymousId]
    );

    // Transform SQL result to match expected format
    const reports = result.rows.map(row => ({
      id: row.report_id,
      anonymous_id: row.report_anonymous_id,
      title: row.title,
      description: row.description,
      category: row.category,
      zone: row.zone,
      address: row.address,
      latitude: row.latitude,
      longitude: row.longitude,
      status: row.status,
      upvotes_count: row.upvotes_count,
      comments_count: row.comments_count,
      created_at: row.report_created_at,
      updated_at: row.report_updated_at,
      incident_date: row.incident_date,
      image_urls: row.image_urls,
      favorited_at: row.created_at
    }));

    res.json({
      success: true,
      data: reports,
      count: reports.length
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({
      error: 'Failed to fetch favorites'
    });
  }
});

export default router;

