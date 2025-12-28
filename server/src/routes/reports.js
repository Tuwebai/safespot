import express from 'express';
import multer from 'multer';
import { requireAnonymousId, validateReport, validateFlagReason } from '../utils/validation.js';
import { logError, logSuccess } from '../utils/logger.js';
import { ensureAnonymousUser } from '../utils/anonymousUser.js';
import { flagRateLimiter } from '../utils/rateLimiter.js';
import { queryWithRLS } from '../utils/rls.js';
import { evaluateBadges } from '../utils/badgeEvaluation.js';
import { supabaseAdmin } from '../config/supabase.js';

const router = express.Router();

/**
 * GET /api/reports
 * List all reports with optional filters and pagination
 * Query params: search, category, zone, status, page, limit
 * Optional: includes is_favorite and is_flagged if X-Anonymous-Id header is present
 */
router.get('/', async (req, res) => {
  try {
    const anonymousId = req.headers['x-anonymous-id'];
    const { search, category, zone, status, page, limit } = req.query;

    // Parse pagination parameters with defaults and validation
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20)); // Max 50, default 20
    const offset = (pageNum - 1) * limitNum;

    // OPTIMIZATION: If anonymous_id is provided, use optimized SQL query with JOINs
    // This eliminates N+1 queries by fetching reports, favorites, and flags in a single query
    if (anonymousId) {
      try {
        // Build WHERE conditions dynamically
        const conditions = [];
        const params = [anonymousId]; // $1 = anonymousId
        let paramIndex = 2;

        // Search filter
        if (search && typeof search === 'string' && search.trim()) {
          const searchTerm = search.trim();
          // Use concatenation for ILIKE pattern matching (correct SQL syntax)
          conditions.push(`(
            r.title ILIKE '%' || $${paramIndex} || '%' OR 
            r.description ILIKE '%' || $${paramIndex} || '%' OR 
            r.category ILIKE '%' || $${paramIndex} || '%' OR 
            r.address ILIKE '%' || $${paramIndex} || '%' OR 
            r.zone ILIKE '%' || $${paramIndex} || '%'
          )`);
          params.push(searchTerm);
          paramIndex++;
        }

        // Category filter
        if (category && typeof category === 'string' && category.trim() && category !== 'all') {
          conditions.push(`r.category = $${paramIndex}`);
          params.push(category.trim());
          paramIndex++;
        }

        // Zone filter
        if (zone && typeof zone === 'string' && zone.trim() && zone !== 'all') {
          conditions.push(`r.zone = $${paramIndex}`);
          params.push(zone.trim());
          paramIndex++;
        }

        // Status filter
        if (status && typeof status === 'string' && status.trim() && status !== 'all') {
          conditions.push(`r.status = $${paramIndex}`);
          params.push(status.trim());
          paramIndex++;
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Build optimized SQL query with LEFT JOINs to get everything in one query
        // This replaces the previous approach of: 1 query for reports + 2 queries for favorites/flags
        const countQuery = `
          SELECT COUNT(*) as total
          FROM reports r
          ${whereClause}
        `;

        // Add LIMIT and OFFSET parameters
        const limitParamIndex = paramIndex;
        const offsetParamIndex = paramIndex + 1;
        params.push(limitNum, offset);

        // Build data query - use $1 for anonymousId in both JOINs (PostgreSQL allows reusing params)
        // ADDED: threads_count subquery - counts only root threads (is_thread=true AND parent_id IS NULL)
        const dataQuery = `
          SELECT 
            r.*,
            CASE WHEN f.id IS NOT NULL THEN true ELSE false END as is_favorite,
            CASE WHEN rf.id IS NOT NULL THEN true ELSE false END as is_flagged,
            (SELECT COUNT(*) FROM comments c WHERE c.report_id = r.id AND c.is_thread = true AND c.parent_id IS NULL) as threads_count
          FROM reports r
          LEFT JOIN favorites f ON f.report_id = r.id AND f.anonymous_id = $1
          LEFT JOIN report_flags rf ON rf.report_id = r.id AND rf.anonymous_id = $1
          ${whereClause}
          ORDER BY r.created_at DESC
          LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
        `;

        // Note: PostgreSQL allows reusing $1 multiple times in the same query
        // The params array is: [anonymousId, ...filterParams, limitNum, offset]
        // $1 is used twice (in both JOINs) but only passed once - this is valid SQL

        // Execute both queries in parallel
        // countQuery uses only filter params (no LIMIT/OFFSET), dataQuery uses all params
        const [countResult, dataResult] = await Promise.all([
          queryWithRLS('', countQuery, params.slice(0, paramIndex)),
          queryWithRLS('', dataQuery, params)
        ]);

        const totalItems = parseInt(countResult.rows[0].total, 10);
        const totalPages = Math.ceil(totalItems / limitNum);
        const hasNextPage = pageNum < totalPages;
        const hasPrevPage = pageNum > 1;

        // Map results to match Supabase format and normalize image_urls
        const enrichedReports = dataResult.rows.map(row => {
          const { is_favorite, is_flagged, ...report } = row;

          // Normalize image_urls: ensure it's always an array (JSONB can be null or string)
          let normalizedImageUrls = [];
          if (report.image_urls) {
            if (Array.isArray(report.image_urls)) {
              normalizedImageUrls = report.image_urls;
            } else if (typeof report.image_urls === 'string') {
              try {
                normalizedImageUrls = JSON.parse(report.image_urls);
                if (!Array.isArray(normalizedImageUrls)) {
                  normalizedImageUrls = [];
                }
              } catch (e) {
                normalizedImageUrls = [];
              }
            }
          }

          return {
            ...report,
            image_urls: normalizedImageUrls,
            is_favorite: is_favorite === true,
            is_flagged: is_flagged === true
          };
        });

        return res.json({
          success: true,
          data: enrichedReports,
          pagination: {
            page: pageNum,
            limit: limitNum,
            totalItems,
            totalPages,
            hasNextPage,
            hasPrevPage
          }
        });
      } catch (sqlError) {
        // Fallback to queryWithRLS approach if optimized SQL query fails
        logError(sqlError, req);
        // Continue to fallback below
      }
    }

    // Fallback: Use queryWithRLS for cases without anonymousId or if SQL query fails
    // Build dynamic WHERE conditions
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    // Apply search filter if provided
    if (search && typeof search === 'string' && search.trim()) {
      const searchTerm = search.trim();
      conditions.push(`(
        title ILIKE '%' || $${paramIndex} || '%' OR 
        description ILIKE '%' || $${paramIndex} || '%' OR 
        category ILIKE '%' || $${paramIndex} || '%' OR 
        address ILIKE '%' || $${paramIndex} || '%' OR 
        zone ILIKE '%' || $${paramIndex} || '%'
      )`);
      params.push(searchTerm);
      paramIndex++;
    }

    // Apply category filter if provided
    if (category && typeof category === 'string' && category.trim() && category !== 'all') {
      conditions.push(`category = $${paramIndex}`);
      params.push(category.trim());
      paramIndex++;
    }

    // Apply zone filter if provided
    if (zone && typeof zone === 'string' && zone.trim() && zone !== 'all') {
      conditions.push(`zone = $${paramIndex}`);
      params.push(zone.trim());
      paramIndex++;
    }

    // Apply status filter if provided
    if (status && typeof status === 'string' && status.trim() && status !== 'all') {
      conditions.push(`status = $${paramIndex}`);
      params.push(status.trim());
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Execute count and data queries in parallel
    const limitParamIndex = paramIndex;
    const offsetParamIndex = paramIndex + 1;
    const countParams = [...params];
    const dataParams = [...params, limitNum, offset];

    const [countResult, dataResult] = await Promise.all([
      queryWithRLS(anonymousId || '', `SELECT COUNT(*) as total FROM reports ${whereClause}`, countParams),
      queryWithRLS(anonymousId || '', `
        SELECT r.*, 
               (SELECT COUNT(*) FROM comments c WHERE c.report_id = r.id AND c.is_thread = true AND c.parent_id IS NULL) as threads_count
        FROM reports r ${whereClause}
        ORDER BY r.created_at DESC
        LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
      `, dataParams)
    ]);

    const totalItems = parseInt(countResult.rows[0].total, 10);
    const reports = dataResult.rows;

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalItems / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    // If anonymous_id is provided, get favorites and flags
    if (anonymousId && reports.length > 0) {
      const reportIds = reports.map(r => r.id);

      // Get favorites and flags in parallel using queryWithRLS
      const [favoritesResult, flagsResult] = await Promise.all([
        queryWithRLS(anonymousId, `
          SELECT report_id FROM favorites WHERE anonymous_id = $1 AND report_id = ANY($2)
        `, [anonymousId, reportIds]),
        queryWithRLS(anonymousId, `
          SELECT report_id FROM report_flags WHERE anonymous_id = $1 AND report_id = ANY($2)
        `, [anonymousId, reportIds])
      ]);

      const favoriteIds = new Set(favoritesResult.rows.map(f => f.report_id));
      const flaggedIds = new Set(flagsResult.rows.map(f => f.report_id));

      // Enrich reports and normalize image_urls
      const enrichedReports = reports.map(report => {
        // Normalize image_urls: ensure it's always an array (JSONB can be null or string)
        let normalizedImageUrls = [];
        if (report.image_urls) {
          if (Array.isArray(report.image_urls)) {
            normalizedImageUrls = report.image_urls;
          } else if (typeof report.image_urls === 'string') {
            try {
              normalizedImageUrls = JSON.parse(report.image_urls);
              if (!Array.isArray(normalizedImageUrls)) {
                normalizedImageUrls = [];
              }
            } catch (e) {
              normalizedImageUrls = [];
            }
          }
        }

        return {
          ...report,
          image_urls: normalizedImageUrls,
          is_favorite: favoriteIds.has(report.id),
          is_flagged: flaggedIds.has(report.id)
        };
      });

      return res.json({
        success: true,
        data: enrichedReports,
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalItems,
          totalPages,
          hasNextPage,
          hasPrevPage
        }
      });
    }

    // Normalize image_urls for all reports in fallback case
    const normalizedReports = (reports || []).map(report => {
      // Normalize image_urls: ensure it's always an array (JSONB can be null or string)
      let normalizedImageUrls = [];
      if (report.image_urls) {
        if (Array.isArray(report.image_urls)) {
          normalizedImageUrls = report.image_urls;
        } else if (typeof report.image_urls === 'string') {
          try {
            normalizedImageUrls = JSON.parse(report.image_urls);
            if (!Array.isArray(normalizedImageUrls)) {
              normalizedImageUrls = [];
            }
          } catch (e) {
            normalizedImageUrls = [];
          }
        }
      }

      return {
        ...report,
        image_urls: normalizedImageUrls
      };
    });

    res.json({
      success: true,
      data: normalizedReports,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems: totalItems || 0,
        totalPages,
        hasNextPage,
        hasPrevPage
      }
    });
  } catch (err) {
    res.status(500).json({
      error: 'Unexpected server error',
      message: err.message
    });
  }
});

/**
 * GET /api/reports/:id
 * Get a single report by ID
 * Optional: includes is_favorite and is_flagged if X-Anonymous-Id header is present
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const anonymousId = req.headers['x-anonymous-id'] || '';

    // Fetch report using queryWithRLS for RLS consistency
    // ADDED: threads_count subquery - counts only root threads (is_thread=true AND parent_id IS NULL)
    const reportResult = await queryWithRLS(anonymousId, `
      SELECT r.*, 
             (SELECT COUNT(*) FROM comments c WHERE c.report_id = r.id AND c.is_thread = true AND c.parent_id IS NULL) as threads_count
      FROM reports r WHERE r.id = $1
    `, [id]);

    if (reportResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Report not found'
      });
    }

    const report = reportResult.rows[0];

    // If anonymous_id is provided, check favorite and flag status
    if (anonymousId) {
      const [favoriteResult, flagResult] = await Promise.all([
        queryWithRLS(anonymousId, `
          SELECT id FROM favorites WHERE anonymous_id = $1 AND report_id = $2 LIMIT 1
        `, [anonymousId, id]),
        queryWithRLS(anonymousId, `
          SELECT id FROM report_flags WHERE anonymous_id = $1 AND report_id = $2 LIMIT 1
        `, [anonymousId, id])
      ]);

      // Normalize image_urls: ensure it's always an array (JSONB can be null or string)
      let normalizedImageUrls = [];
      if (report.image_urls) {
        if (Array.isArray(report.image_urls)) {
          normalizedImageUrls = report.image_urls;
        } else if (typeof report.image_urls === 'string') {
          try {
            normalizedImageUrls = JSON.parse(report.image_urls);
            if (!Array.isArray(normalizedImageUrls)) {
              normalizedImageUrls = [];
            }
          } catch (e) {
            normalizedImageUrls = [];
          }
        }
      }

      const enrichedReport = {
        ...report,
        image_urls: normalizedImageUrls,
        is_favorite: favoriteResult.rows.length > 0,
        is_flagged: flagResult.rows.length > 0
      };

      return res.json({
        success: true,
        data: enrichedReport
      });
    }

    // Normalize image_urls for non-authenticated requests too
    let normalizedImageUrls = [];
    if (report.image_urls) {
      if (Array.isArray(report.image_urls)) {
        normalizedImageUrls = report.image_urls;
      } else if (typeof report.image_urls === 'string') {
        try {
          normalizedImageUrls = JSON.parse(report.image_urls);
          if (!Array.isArray(normalizedImageUrls)) {
            normalizedImageUrls = [];
          }
        } catch (e) {
          normalizedImageUrls = [];
        }
      }
    }

    const normalizedReport = {
      ...report,
      image_urls: normalizedImageUrls
    };

    res.json({
      success: true,
      data: normalizedReport
    });
  } catch (err) {
    res.status(500).json({
      error: 'Unexpected server error',
      message: err.message
    });
  }
});

/**
 * POST /api/reports
 * Create a new report
 * Requires: X-Anonymous-Id header
 */
router.post('/', requireAnonymousId, async (req, res) => {
  try {
    const anonymousId = req.anonymousId;

    logSuccess('Creating report', { anonymousId, title: req.body.title });

    // Validate request body
    validateReport(req.body);

    // Ensure anonymous user exists in anonymous_users table (idempotent)
    try {
      await ensureAnonymousUser(anonymousId);
    } catch (error) {
      logError(error, req);
      return res.status(500).json({
        error: 'Failed to ensure anonymous user'
      });
    }

    // Check for duplicate report (same anonymous_id, category, zone, title within last 10 minutes)
    const title = req.body.title.trim();
    const category = req.body.category;
    const zone = req.body.zone;

    // Calculate timestamp 10 minutes ago
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const duplicateResult = await queryWithRLS(anonymousId, `
      SELECT id FROM reports
      WHERE anonymous_id = $1 AND category = $2 AND zone = $3 AND title = $4 AND created_at >= $5
      LIMIT 1
    `, [anonymousId, category, zone, title, tenMinutesAgo]);

    if (duplicateResult.rows.length > 0) {
      return res.status(409).json({
        error: 'DUPLICATE_REPORT',
        message: 'Ya existe un reporte similar reciente'
      });
    }

    // Parse and validate incident_date if provided
    let incidentDate = null;
    if (req.body.incident_date) {
      const parsedDate = new Date(req.body.incident_date);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'incident_date must be a valid ISO 8601 date string'
        });
      }
      incidentDate = parsedDate.toISOString();
    } else {
      incidentDate = new Date().toISOString();
    }

    // Insert report using queryWithRLS for RLS consistency
    const insertResult = await queryWithRLS(anonymousId, `
      INSERT INTO reports (
        anonymous_id, title, description, category, zone, address, 
        latitude, longitude, status, incident_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      anonymousId,
      req.body.title.trim(),
      req.body.description.trim(),
      req.body.category,
      req.body.zone,
      req.body.address.trim(),
      req.body.latitude || null,
      req.body.longitude || null,
      req.body.status || 'pendiente',
      incidentDate
    ]);

    if (insertResult.rows.length === 0) {
      logError(new Error('Insert returned no data'), req);
      return res.status(500).json({
        error: 'Failed to create report',
        message: 'Insert operation returned no data'
      });
    }

    const newReport = insertResult.rows[0];

    const data = newReport;

    logSuccess('Report created', {
      id: data.id,
      anonymousId
    });

    // Evaluate badges (async, don't wait for response)
    // This will check if user should receive badges for creating reports
    evaluateBadges(anonymousId).catch(err => {
      logError(err, req);
      // Don't fail the request if badge evaluation fails
    });

    res.status(201).json({
      success: true,
      data: data,
      message: 'Report created successfully'
    });
  } catch (error) {
    logError(error, req);

    if (error.message.startsWith('VALIDATION_ERROR')) {
      return res.status(400).json({
        error: 'Validation failed',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Failed to create report'
    });
  }
});

/**
 * PATCH /api/reports/:id
 * Update a report (only by creator)
 * Requires: X-Anonymous-Id header
 */
router.patch('/:id', requireAnonymousId, async (req, res) => {
  try {
    const { id } = req.params;
    const anonymousId = req.anonymousId;

    // Check if report exists and belongs to user
    const checkResult = await queryWithRLS(anonymousId, `
      SELECT anonymous_id FROM reports WHERE id = $1
    `, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Report not found'
      });
    }

    const report = checkResult.rows[0];

    if (report.anonymous_id !== anonymousId) {
      return res.status(403).json({
        error: 'Forbidden: You can only update your own reports'
      });
    }

    // Build update SET clause dynamically
    const updates = [];
    const params = [id, anonymousId];
    let paramIndex = 3;

    if (req.body.title !== undefined) {
      updates.push(`title = $${paramIndex}`);
      params.push(req.body.title.trim());
      paramIndex++;
    }

    if (req.body.description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(req.body.description.trim());
      paramIndex++;
    }

    if (req.body.status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      params.push(req.body.status);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No fields to update'
      });
    }

    // Add updated_at timestamp
    updates.push(`updated_at = $${paramIndex}`);
    params.push(new Date().toISOString());

    // Update report using queryWithRLS for RLS consistency
    const updateResult = await queryWithRLS(anonymousId, `
      UPDATE reports SET ${updates.join(', ')}
      WHERE id = $1 AND anonymous_id = $2
      RETURNING *
    `, params);

    if (updateResult.rows.length === 0) {
      return res.status(403).json({
        error: 'Forbidden: You can only update your own reports'
      });
    }

    const updatedReport = updateResult.rows[0];

    logSuccess('Report updated', { id, anonymousId });

    res.json({
      success: true,
      data: updatedReport,
      message: 'Report updated successfully'
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({
      error: 'Failed to update report'
    });
  }
});

/**
 * POST /api/reports/:id/favorite
 * Toggle favorite status for a report
 * Requires: X-Anonymous-Id header
 */
router.post('/:id/favorite', requireAnonymousId, async (req, res) => {
  try {
    const { id } = req.params;
    const anonymousId = req.anonymousId;

    // Verify report exists
    const reportResult = await queryWithRLS(anonymousId, `
      SELECT id FROM reports WHERE id = $1
    `, [id]);

    if (reportResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Report not found'
      });
    }

    // Ensure anonymous user exists
    try {
      await ensureAnonymousUser(anonymousId);
    } catch (error) {
      logError(error, req);
      return res.status(500).json({
        error: 'Failed to ensure anonymous user'
      });
    }

    // Check if favorite already exists
    const checkResult = await queryWithRLS(anonymousId, `
      SELECT id FROM favorites WHERE anonymous_id = $1 AND report_id = $2
    `, [anonymousId, id]);

    if (checkResult.rows.length > 0) {
      // Remove favorite (toggle off)
      await queryWithRLS(anonymousId, `
        DELETE FROM favorites WHERE id = $1 AND anonymous_id = $2
      `, [checkResult.rows[0].id, anonymousId]);

      res.json({
        success: true,
        data: {
          is_favorite: false
        },
        message: 'Favorite removed successfully'
      });
    } else {
      // Add favorite (toggle on)
      try {
        await queryWithRLS(anonymousId, `
          INSERT INTO favorites (anonymous_id, report_id) VALUES ($1, $2)
        `, [anonymousId, id]);

        res.json({
          success: true,
          data: {
            is_favorite: true
          },
          message: 'Favorite added successfully'
        });
      } catch (insertError) {
        // Check if it's a unique constraint violation (race condition)
        if (insertError.code === '23505' || insertError.message?.includes('unique') || insertError.message?.includes('duplicate')) {
          res.json({
            success: true,
            data: {
              is_favorite: true
            },
            message: 'Already favorited'
          });
        } else {
          throw insertError;
        }
      }
    }
  } catch (error) {
    logError(error, req);
    res.status(500).json({
      error: 'Failed to toggle favorite'
    });
  }
});

/**
 * POST /api/reports/:id/flag
 * Flag a report as inappropriate
 * Requires: X-Anonymous-Id header
 * Rate limited: 5 flags per minute per anonymous ID
 */
router.post('/:id/flag', flagRateLimiter, requireAnonymousId, async (req, res) => {
  try {
    const { id } = req.params;
    const anonymousId = req.anonymousId;
    const reason = req.body.reason || null;

    // Validate reason if provided
    try {
      validateFlagReason(reason);
    } catch (error) {
      if (error.message.startsWith('VALIDATION_ERROR')) {
        return res.status(400).json({
          error: 'Validation failed',
          message: error.message.replace('VALIDATION_ERROR: ', ''),
          code: 'VALIDATION_ERROR'
        });
      }
      throw error;
    }

    // Verify report exists and get owner
    const reportResult = await queryWithRLS(anonymousId, `
      SELECT id, anonymous_id FROM reports WHERE id = $1
    `, [id]);

    if (reportResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Report not found'
      });
    }

    const report = reportResult.rows[0];

    // Check if user is trying to flag their own report
    if (report.anonymous_id === anonymousId) {
      return res.status(403).json({
        error: 'You cannot flag your own report'
      });
    }

    // Ensure anonymous user exists
    try {
      await ensureAnonymousUser(anonymousId);
    } catch (error) {
      logError(error, req);
      return res.status(500).json({
        error: 'Failed to ensure anonymous user'
      });
    }

    // Check if already flagged
    const checkResult = await queryWithRLS(anonymousId, `
      SELECT id FROM report_flags WHERE anonymous_id = $1 AND report_id = $2
    `, [anonymousId, id]);

    if (checkResult.rows.length > 0) {
      return res.status(409).json({
        error: 'Report already flagged by this user',
        message: 'You have already flagged this report'
      });
    }

    // Create flag using queryWithRLS for RLS consistency
    const insertResult = await queryWithRLS(anonymousId, `
      INSERT INTO report_flags (anonymous_id, report_id, reason)
      VALUES ($1, $2, $3)
      RETURNING id, report_id, reason
    `, [anonymousId, id, reason]);

    if (insertResult.rows.length === 0) {
      logError(new Error('Insert returned no data'), req);
      return res.status(500).json({
        error: 'Failed to flag report',
        message: 'Insert operation returned no data'
      });
    }

    const newFlag = insertResult.rows[0];

    res.status(201).json({
      success: true,
      data: {
        is_flagged: true,
        flag_id: newFlag.id
      },
      message: 'Report flagged successfully'
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({
      error: 'Failed to flag report'
    });
  }
});

/**
 * DELETE /api/reports/:id
 * Delete a report (only by creator)
 * Requires: X-Anonymous-Id header
 */
router.delete('/:id', requireAnonymousId, async (req, res) => {
  try {
    const { id } = req.params;
    const anonymousId = req.anonymousId;

    // Check if report exists and belongs to user
    const checkResult = await queryWithRLS(anonymousId, `
      SELECT id, anonymous_id FROM reports WHERE id = $1 AND anonymous_id = $2
    `, [id, anonymousId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Report not found or you do not have permission to delete it'
      });
    }

    // Delete report using queryWithRLS for RLS consistency
    const deleteResult = await queryWithRLS(anonymousId, `
      DELETE FROM reports WHERE id = $1 AND anonymous_id = $2 RETURNING id
    `, [id, anonymousId]);

    if (deleteResult.rows.length === 0) {
      return res.status(403).json({
        error: 'Forbidden: You can only delete your own reports'
      });
    }

    logSuccess('Report deleted', { id, anonymousId });

    res.json({
      success: true,
      message: 'Report deleted successfully'
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({
      error: 'Failed to delete report'
    });
  }
});

/**
 * POST /api/reports/:id/images
 * Upload images for a report
 * Requires: X-Anonymous-Id header
 * Accepts: multipart/form-data with image files
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max per file
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only jpg, jpeg, png, and webp are allowed.'), false);
    }
  },
});

router.post('/:id/images', requireAnonymousId, upload.array('images', 5), async (req, res) => {
  try {
    const { id } = req.params;
    const anonymousId = req.anonymousId;
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({
        error: 'No images provided'
      });
    }

    // Verify report exists and belongs to user
    const reportResult = await queryWithRLS(anonymousId, `
      SELECT id, anonymous_id FROM reports WHERE id = $1
    `, [id]);

    if (reportResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Report not found'
      });
    }

    const report = reportResult.rows[0];

    if (report.anonymous_id !== anonymousId) {
      return res.status(403).json({
        error: 'Forbidden: You can only upload images to your own reports'
      });
    }

    // Check if supabaseAdmin is available
    if (!supabaseAdmin) {
      return res.status(500).json({
        error: 'Storage service not configured',
        message: 'SUPABASE_SERVICE_ROLE_KEY is required for image uploads'
      });
    }

    // Upload files to Supabase Storage
    const imageUrls = [];
    const bucketName = 'report-images';

    for (const file of files) {
      try {
        // Generate unique filename
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from(bucketName)
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false,
          });

        if (uploadError) {
          logError(uploadError, req);
          throw new Error(`Failed to upload ${file.originalname}: ${uploadError.message}`);
        }

        // Get public URL
        const { data: urlData } = supabaseAdmin.storage
          .from(bucketName)
          .getPublicUrl(fileName);

        if (urlData?.publicUrl) {
          imageUrls.push(urlData.publicUrl);
        } else {
          throw new Error(`Failed to get public URL for ${file.originalname}`);
        }
      } catch (fileError) {
        logError(fileError, req);
        // Continue with other files, but log the error
        console.error(`Error uploading file ${file.originalname}:`, fileError.message);
      }
    }

    if (imageUrls.length === 0) {
      return res.status(500).json({
        error: 'Failed to upload any images',
        message: 'All image uploads failed'
      });
    }

    // Update report with image URLs using queryWithRLS for RLS consistency
    await queryWithRLS(anonymousId, `
      UPDATE reports SET image_urls = $1 WHERE id = $2 AND anonymous_id = $3
    `, [JSON.stringify(imageUrls), id, anonymousId]);

    logSuccess('Images uploaded', { id, anonymousId, count: imageUrls.length });

    res.json({
      success: true,
      data: {
        image_urls: imageUrls
      },
      message: `Successfully uploaded ${imageUrls.length} image(s)`
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({
      error: 'Failed to upload images'
    });
  }
});

export default router;

