import express from 'express';
import multer from 'multer';
import { requireAnonymousId, validateReport, validateFlagReason } from '../utils/validation.js';
import { logError, logSuccess } from '../utils/logger.js';
import { ensureAnonymousUser } from '../utils/anonymousUser.js';
import { flagRateLimiter } from '../utils/rateLimiter.js';
import { queryWithRLS } from '../utils/rls.js';
import supabase, { supabaseAdmin } from '../config/supabase.js';

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
          const searchTerm = `%${search.trim()}%`;
          conditions.push(`(
            r.title ILIKE $${paramIndex} OR 
            r.description ILIKE $${paramIndex} OR 
            r.category ILIKE $${paramIndex} OR 
            r.address ILIKE $${paramIndex} OR 
            r.zone ILIKE $${paramIndex}
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
        
        const dataQuery = `
          SELECT 
            r.*,
            CASE WHEN f.id IS NOT NULL THEN true ELSE false END as is_favorite,
            CASE WHEN rf.id IS NOT NULL THEN true ELSE false END as is_flagged
          FROM reports r
          LEFT JOIN favorites f ON f.report_id = r.id AND f.anonymous_id = $1
          LEFT JOIN report_flags rf ON rf.report_id = r.id AND rf.anonymous_id = $1
          ${whereClause}
          ORDER BY r.created_at DESC
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
        
        params.push(limitNum, offset);
        
        // Execute both queries in parallel
        const [countResult, dataResult] = await Promise.all([
          queryWithRLS('', countQuery, params.slice(0, paramIndex)),
          queryWithRLS('', dataQuery, params)
        ]);
        
        const totalItems = parseInt(countResult.rows[0].total, 10);
        const totalPages = Math.ceil(totalItems / limitNum);
        const hasNextPage = pageNum < totalPages;
        const hasPrevPage = pageNum > 1;
        
        // Map results to match Supabase format
        const enrichedReports = dataResult.rows.map(row => {
          const { is_favorite, is_flagged, ...report } = row;
          return {
            ...report,
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
        // Fallback to Supabase approach if SQL query fails
        logError(sqlError, req);
        // Continue to Supabase fallback below
      }
    }
    
    // Fallback: Use Supabase for cases without anonymousId or if SQL query fails
    // Build base query for counting total items (without pagination)
    let countQuery = supabase
      .from('reports')
      .select('*', { count: 'exact', head: true });
    
    // Build query for fetching data (with pagination)
    let dataQuery = supabase
      .from('reports')
      .select('*');
    
    // Apply search filter if provided
    if (search && typeof search === 'string' && search.trim()) {
      const searchTerm = search.trim();
      // Search in title, description, category, address, and zone using OR conditions
      // Supabase .or() syntax: 'column1.ilike.%term%,column2.ilike.%term%'
      const searchFilter = `title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%,address.ilike.%${searchTerm}%,zone.ilike.%${searchTerm}%`;
      countQuery = countQuery.or(searchFilter);
      dataQuery = dataQuery.or(searchFilter);
    }
    
    // Apply category filter if provided
    if (category && typeof category === 'string' && category.trim() && category !== 'all') {
      const categoryValue = category.trim();
      countQuery = countQuery.eq('category', categoryValue);
      dataQuery = dataQuery.eq('category', categoryValue);
    }
    
    // Apply zone filter if provided
    if (zone && typeof zone === 'string' && zone.trim() && zone !== 'all') {
      const zoneValue = zone.trim();
      countQuery = countQuery.eq('zone', zoneValue);
      dataQuery = dataQuery.eq('zone', zoneValue);
    }
    
    // Apply status filter if provided
    if (status && typeof status === 'string' && status.trim() && status !== 'all') {
      const statusValue = status.trim();
      countQuery = countQuery.eq('status', statusValue);
      dataQuery = dataQuery.eq('status', statusValue);
    }
    
    // Order by created_at descending (only for data query)
    dataQuery = dataQuery.order('created_at', { ascending: false });
    
    // Apply pagination to data query
    dataQuery = dataQuery.range(offset, offset + limitNum - 1);
    
    // Execute both queries in parallel
    const [{ count: totalItems, error: countError }, { data: reports, error: dataError }] = await Promise.all([
      countQuery,
      dataQuery
    ]);

    if (countError) {
      return res.status(500).json({
        error: 'Database query error',
        message: countError.message
      });
    }

    if (dataError) {
      return res.status(500).json({
        error: 'Database query error',
        message: dataError.message
      });
    }

    // Calculate pagination metadata
    const totalPages = Math.ceil((totalItems || 0) / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    // If anonymous_id is provided but SQL optimization failed, use original approach
    if (anonymousId && reports && reports.length > 0) {
      const reportIds = reports.map(r => r.id);
      
      // Get favorites and flags in parallel (2 queries instead of N+1)
      const [favoritesResult, flagsResult] = await Promise.all([
        supabase
          .from('favorites')
          .select('report_id')
          .eq('anonymous_id', anonymousId)
          .in('report_id', reportIds),
        supabase
          .from('report_flags')
          .select('report_id')
          .eq('anonymous_id', anonymousId)
          .in('report_id', reportIds)
      ]);
      
      const favoriteIds = new Set(favoritesResult?.data?.map(f => f.report_id) || []);
      const flaggedIds = new Set(flagsResult?.data?.map(f => f.report_id) || []);
      
      // Enrich reports
      const enrichedReports = reports.map(report => ({
        ...report,
        is_favorite: favoriteIds.has(report.id),
        is_flagged: flaggedIds.has(report.id)
      }));
      
      return res.json({
        success: true,
        data: enrichedReports,
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalItems: totalItems || 0,
          totalPages,
          hasNextPage,
          hasPrevPage
        }
      });
    }

    res.json({
      success: true,
      data: reports || [],
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
    const anonymousId = req.headers['x-anonymous-id'];
    
    const { data: report, error } = await supabase
      .from('reports')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          error: 'Report not found'
        });
      }
      return res.status(500).json({
        error: 'Failed to fetch report',
        message: error.message
      });
    }

    // If anonymous_id is provided, check favorite and flag status
    if (anonymousId) {
      const [favoriteResult, flagResult] = await Promise.all([
        supabase
          .from('favorites')
          .select('id')
          .eq('anonymous_id', anonymousId)
          .eq('report_id', id)
          .maybeSingle(),
        supabase
          .from('report_flags')
          .select('id')
          .eq('anonymous_id', anonymousId)
          .eq('report_id', id)
          .maybeSingle()
      ]);
      
      const enrichedReport = {
        ...report,
        is_favorite: !!favoriteResult.data,
        is_flagged: !!flagResult.data
      };
      
      return res.json({
        success: true,
        data: enrichedReport
      });
    }

    res.json({
      success: true,
      data: report
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
        error: 'Failed to ensure anonymous user',
        message: error.message
      });
    }
    
    // Check for duplicate report (same anonymous_id, category, zone, title within last 10 minutes)
    const title = req.body.title.trim();
    const category = req.body.category;
    const zone = req.body.zone;
    
    // Calculate timestamp 10 minutes ago
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { data: duplicateCheck, error: checkError } = await supabase
      .from('reports')
      .select('id')
      .eq('anonymous_id', anonymousId)
      .eq('category', category)
      .eq('zone', zone)
      .eq('title', title)
      .gte('created_at', tenMinutesAgo)
      .maybeSingle();
    
    if (checkError) {
      return res.status(500).json({
        error: 'Failed to check for duplicates',
        message: checkError.message
      });
    }
    
    if (duplicateCheck) {
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
    
    // Insert report using Supabase (which respects RLS policies)
    // The RLS policy will verify anonymous_id = current_anonymous_id()
    const { data: newReport, error: insertError } = await supabase
      .from('reports')
      .insert({
        anonymous_id: anonymousId,
        title: req.body.title.trim(),
        description: req.body.description.trim(),
        category: req.body.category,
        zone: req.body.zone,
        address: req.body.address.trim(),
        latitude: req.body.latitude || null,
        longitude: req.body.longitude || null,
        status: req.body.status || 'pendiente',
        incident_date: incidentDate
      })
      .select()
      .single();
    
    if (insertError) {
      logError(insertError, req);
      return res.status(500).json({
        error: 'Failed to create report',
        message: insertError.message
      });
    }
    
    if (!newReport) {
      logError(new Error('Insert returned no data'), req);
      return res.status(500).json({
        error: 'Failed to create report',
        message: 'Insert operation returned no data'
      });
    }
    
    const data = newReport;
    
    logSuccess('Report created', { 
      id: data.id,
      anonymousId 
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
      error: 'Failed to create report',
      message: error.message
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
    const { data: report, error: checkError } = await supabase
      .from('reports')
      .select('anonymous_id')
      .eq('id', id)
      .maybeSingle();
    
    if (checkError) {
      logError(checkError, req);
      return res.status(500).json({
        error: 'Failed to verify report',
        message: checkError.message
      });
    }
    
    if (!report) {
      return res.status(404).json({
        error: 'Report not found'
      });
    }
    
    if (report.anonymous_id !== anonymousId) {
      return res.status(403).json({
        error: 'Forbidden: You can only update your own reports'
      });
    }
    
    // Build update object dynamically
    const updateData = {};
    
    if (req.body.title !== undefined) {
      updateData.title = req.body.title.trim();
    }
    
    if (req.body.description !== undefined) {
      updateData.description = req.body.description.trim();
    }
    
    if (req.body.status !== undefined) {
      updateData.status = req.body.status;
    }
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: 'No fields to update'
      });
    }
    
    // Add updated_at timestamp
    updateData.updated_at = new Date().toISOString();
    
    // Update report using Supabase (which respects RLS policies)
    // The RLS policy will verify anonymous_id = current_anonymous_id()
    const { data: updatedReport, error: updateError } = await supabase
      .from('reports')
      .update(updateData)
      .eq('id', id)
      .eq('anonymous_id', anonymousId)
      .select()
      .single();
    
    if (updateError) {
      logError(updateError, req);
      return res.status(500).json({
        error: 'Failed to update report',
        message: updateError.message
      });
    }
    
    if (!updatedReport) {
      return res.status(403).json({
        error: 'Forbidden: You can only update your own reports'
      });
    }
    
    logSuccess('Report updated', { id, anonymousId });
    
    res.json({
      success: true,
      data: updatedReport,
      message: 'Report updated successfully'
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({
      error: 'Failed to update report',
      message: error.message
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
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    
    if (reportError) {
      logError(reportError, req);
      return res.status(500).json({
        error: 'Failed to verify report',
        message: reportError.message
      });
    }
    
    if (!report) {
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
        error: 'Failed to ensure anonymous user',
        message: error.message
      });
    }
    
    // Check if favorite already exists
    // Note: Using supabase.from() because favorites RLS policy allows current_anonymous_id() IS NULL
    const { data: existingFavorite, error: checkError } = await supabase
      .from('favorites')
      .select('id')
      .eq('anonymous_id', anonymousId)
      .eq('report_id', id)
      .maybeSingle();
    
    if (checkError) {
      logError(checkError, req);
      return res.status(500).json({
        error: 'Failed to check favorite status',
        message: checkError.message
      });
    }
    
    if (existingFavorite) {
      // Remove favorite (toggle off)
      const { error: deleteError } = await supabase
        .from('favorites')
        .delete()
        .eq('id', existingFavorite.id)
        .eq('anonymous_id', anonymousId);
      
      if (deleteError) {
        logError(deleteError, req);
        return res.status(500).json({
          error: 'Failed to remove favorite',
          message: deleteError.message
        });
      }
      
      res.json({
        success: true,
        data: {
          is_favorite: false
        },
        message: 'Favorite removed successfully'
      });
    } else {
      // Add favorite (toggle on)
      const { data: newFavorite, error: insertError } = await supabase
        .from('favorites')
        .insert({
          anonymous_id: anonymousId,
          report_id: id
        })
        .select()
        .single();
      
      if (insertError) {
        // Check if it's a unique constraint violation (race condition)
        if (insertError.code === '23505' || insertError.message.includes('unique') || insertError.message.includes('duplicate')) {
          res.json({
            success: true,
            data: {
              is_favorite: true
            },
            message: 'Already favorited'
          });
        } else {
          logError(insertError, req);
          return res.status(500).json({
            error: 'Failed to add favorite',
            message: insertError.message
          });
        }
      } else {
        res.json({
          success: true,
          data: {
            is_favorite: true
          },
          message: 'Favorite added successfully'
        });
      }
    }
  } catch (error) {
    logError(error, req);
    res.status(500).json({
      error: 'Failed to toggle favorite',
      message: error.message
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
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('id, anonymous_id')
      .eq('id', id)
      .maybeSingle();
    
    if (reportError) {
      logError(reportError, req);
      return res.status(500).json({
        error: 'Failed to verify report',
        message: reportError.message
      });
    }
    
    if (!report) {
      return res.status(404).json({
        error: 'Report not found'
      });
    }
    
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
        error: 'Failed to ensure anonymous user',
        message: error.message
      });
    }
    
    // Check if already flagged using Supabase
    const { data: existingFlag, error: checkError } = await supabase
      .from('report_flags')
      .select('id')
      .eq('anonymous_id', anonymousId)
      .eq('report_id', id)
      .maybeSingle();
    
    if (checkError) {
      logError(checkError, req);
      return res.status(500).json({
        error: 'Failed to check for existing flag',
        message: checkError.message
      });
    }
    
    if (existingFlag) {
      return res.status(409).json({
        error: 'Report already flagged by this user',
        message: 'You have already flagged this report'
      });
    }
    
    // Create flag using Supabase (which respects RLS policies)
    const { data: newFlag, error: insertError } = await supabase
      .from('report_flags')
      .insert({
        anonymous_id: anonymousId,
        report_id: id,
        reason: reason
      })
      .select('id, report_id, reason')
      .single();
    
    if (insertError) {
      logError(insertError, req);
      return res.status(500).json({
        error: 'Failed to flag report',
        message: insertError.message
      });
    }
    
    if (!newFlag) {
      logError(new Error('Insert returned no data'), req);
      return res.status(500).json({
        error: 'Failed to flag report',
        message: 'Insert operation returned no data'
      });
    }
    
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
      error: 'Failed to flag report',
      message: error.message
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
    const { data: report, error: checkError } = await supabase
      .from('reports')
      .select('id, anonymous_id')
      .eq('id', id)
      .eq('anonymous_id', anonymousId)
      .maybeSingle();
    
    if (checkError) {
      logError(checkError, req);
      return res.status(500).json({
        error: 'Failed to verify report',
        message: checkError.message
      });
    }
    
    if (!report) {
      return res.status(404).json({
        error: 'Report not found or you do not have permission to delete it'
      });
    }
    
    // Delete report using Supabase (which respects RLS policies)
    // The RLS policy will verify anonymous_id = current_anonymous_id()
    const { data: deletedReport, error: deleteError } = await supabase
      .from('reports')
      .delete()
      .eq('id', id)
      .eq('anonymous_id', anonymousId)
      .select('id')
      .single();
    
    if (deleteError) {
      logError(deleteError, req);
      return res.status(500).json({
        error: 'Failed to delete report',
        message: deleteError.message
      });
    }
    
    if (!deletedReport) {
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
      error: 'Failed to delete report',
      message: error.message
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
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('id, anonymous_id')
      .eq('id', id)
      .maybeSingle();

    if (reportError) {
      logError(reportError, req);
      return res.status(500).json({
        error: 'Failed to verify report',
        message: reportError.message
      });
    }

    if (!report) {
      return res.status(404).json({
        error: 'Report not found'
      });
    }

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

    // Update report with image URLs (replace completely)
    const { data: updatedReport, error: updateError } = await supabase
      .from('reports')
      .update({
        image_urls: imageUrls
      })
      .eq('id', id)
      .eq('anonymous_id', anonymousId)
      .select()
      .single();

    if (updateError) {
      logError(updateError, req);
      return res.status(500).json({
        error: 'Failed to update report with image URLs',
        message: updateError.message
      });
    }

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
      error: 'Failed to upload images',
      message: error.message
    });
  }
});

export default router;

