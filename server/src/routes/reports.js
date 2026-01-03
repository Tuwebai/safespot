import express from 'express';
import multer from 'multer';
import { requireAnonymousId, validateFlagReason, validateCoordinates, validateImageBuffer } from '../utils/validation.js';
import { validate } from '../utils/validateMiddleware.js';
import { reportSchema, geoQuerySchema } from '../utils/schemas.js';
import { checkContentVisibility } from '../utils/trustScore.js';
import { logError, logSuccess } from '../utils/logger.js';
import { ensureAnonymousUser } from '../utils/anonymousUser.js';
import { flagRateLimiter, favoriteLimiter, imageUploadLimiter } from '../utils/rateLimiter.js';
import { queryWithRLS } from '../utils/rls.js';
import { syncGamification } from '../utils/gamificationCore.js';
import { supabaseAdmin } from '../config/supabase.js';
import { sanitizeText, sanitizeContent } from '../utils/sanitize.js';
import { reverseGeocode } from '../utils/georef.js';
import { exportReportPDF } from '../controllers/exportController.js';
import { NotificationService } from '../utils/notificationService.js';

const router = express.Router();

/**
 * GET /api/reports
 * List all reports with optional filters and pagination
 * Query params: search, category, zone, status, page, limit
 * Optional: includes is_favorite and is_flagged if X-Anonymous-Id header is present
 */
import { encodeCursor, decodeCursor } from '../utils/cursor.js';

// ... other imports

/**
 * GET /api/reports
 * List all reports with optional filters and pagination
 * Uses Cursor-based pagination (created_at DESC, id DESC) for infinite scroll performance
 * Query params: search, category, zone, status, limit, cursor
 */
router.get('/', async (req, res) => {
  try {
    const anonymousId = req.headers['x-anonymous-id'];
    const { search, category, zone, status, lat, lng, radius, limit, cursor, province } = req.query;

    // Parse limit
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20)); // Max 50, default 20
    const { bounds } = req.query;

    // ============================================
    // BOUNDS FEED: "Buscar en esta zona"
    // ============================================
    if (bounds) {
      const parts = bounds.split(',').map(Number);
      if (parts.length !== 4 || parts.some(isNaN)) {
        return res.status(400).json({
          error: 'Bounds inválidos',
          details: 'Formato esperado: north,south,east,west'
        });
      }

      const [north, south, east, west] = parts;

      // Basic validation
      if (north < south || east < west) {
        // This check might fail near dateline, but assuming standard viewport for now
        // For simple checks:
      }

      const boundsQuery = `
        SELECT 
          r.id, r.title, r.category, r.status, r.latitude, r.longitude, r.created_at, r.is_hidden, r.anonymous_id
        FROM reports r
        WHERE 
          r.location && ST_MakeEnvelope($1, $2, $3, $4, 4326)
          AND r.location IS NOT NULL
          AND r.is_hidden = false
        ORDER BY r.created_at DESC
        LIMIT 100
      `;
      // ST_MakeEnvelope(xmin, ymin, xmax, ymax, srid) -> (west, south, east, north)

      const boundsParams = [west, south, east, north];

      const result = await queryWithRLS(anonymousId || '', boundsQuery, boundsParams);

      // Filter visibility if needed (though is_hidden checked, shadow ban might need check)
      // For performance on map, checking individual trust score for 100 items might be slow.
      // We'll rely on r.is_hidden being correct (updated by triggers/cron).

      return res.json({
        success: true,
        data: result.rows,
        meta: { feedType: 'bounds', count: result.rows.length }
      });
    }

    // ============================================
    // GEOGRAPHIC FEED: "Cerca de Mí"
    // ============================================
    const isGeoFeed = lat && lng;

    if (isGeoFeed) {
      // Validate coordinates and radius using Zod
      const validatedGeo = geoQuerySchema.parse({
        lat,
        lng,
        radius_meters: radius
      });

      const userLat = validatedGeo.lat;
      const userLng = validatedGeo.lng;
      const radiusMeters = validatedGeo.radius_meters;

      // Parse cursor for geographic feed
      const decodedCursor = cursor ? decodeCursor(cursor) : null;
      let cursorDistance = null;
      let cursorDate = null;
      let cursorId = null;

      if (decodedCursor && decodedCursor.d && decodedCursor.c && decodedCursor.i) {
        cursorDistance = decodedCursor.d; // distance
        cursorDate = decodedCursor.c;     // created_at
        cursorId = decodedCursor.i;       // id
      }

      const fetchLimit = limitNum + 1;

      // Build filters for geographic feed
      const buildGeoFilters = (startIdx) => {
        const conds = ['r.deleted_at IS NULL']; // Always filter out soft-deleted records
        const vals = [];
        let idx = startIdx;

        if (search && typeof search === 'string' && search.trim()) {
          const searchTerm = search.trim();
          conds.push(`(
            r.title % $${idx} OR 
            r.description % $${idx} OR 
            r.category % $${idx} OR 
            r.address % $${idx} OR 
            r.zone % $${idx}
          )`);
          vals.push(searchTerm);
          idx++;
        }

        if (category && category !== 'all') {
          conds.push(`r.category = $${idx}`);
          vals.push(category.trim());
          idx++;
        }

        if (zone && zone !== 'all') {
          conds.push(`r.zone = $${idx}`);
          vals.push(zone.trim());
          idx++;
        }

        if (status && status !== 'all') {
          conds.push(`r.status = $${idx}`);
          vals.push(status.trim());
          idx++;
        }

        return { conds, vals, nextIdx: idx };
      };

      let dataQuery = '';
      let dataParams = [];

      if (anonymousId) {
        // Authenticated flow with favorites/flags
        const f = buildGeoFilters(9); // $1-$8 reserved
        const additionalWhere = f.conds.length > 0 ? `AND ${f.conds.join(' AND ')}` : '';

        dataQuery = `
          WITH user_location AS (
            SELECT ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography AS point
          )
          SELECT 
            r.id, r.anonymous_id, r.title, r.description, r.category, r.zone, r.address, 
            r.latitude, r.longitude, r.status, r.upvotes_count, r.comments_count, 
            r.created_at, r.updated_at, r.incident_date, r.image_urls,
            ST_Distance(r.location, ul.point) AS distance_meters,
            CASE WHEN f.id IS NOT NULL THEN true ELSE false END AS is_favorite,
            CASE WHEN rf.id IS NOT NULL THEN true ELSE false END AS is_flagged,
            r.threads_count,
            uz.type as priority_zone,
            u.avatar_url,
            u.alias
          FROM reports r
          CROSS JOIN user_location ul
          LEFT JOIN anonymous_users u ON r.anonymous_id = u.anonymous_id
          LEFT JOIN favorites f ON f.report_id = r.id AND f.anonymous_id = $8
          LEFT JOIN report_flags rf ON rf.report_id = r.id AND rf.anonymous_id = $8
          LEFT JOIN LATERAL (
            SELECT type 
            FROM user_zones 
            WHERE anonymous_id = $8 
            AND ST_DWithin(r.location, location, radius_meters)
            ORDER BY CASE 
                WHEN type = 'home' THEN 1
                WHEN type = 'work' THEN 2
                WHEN type = 'frequent' THEN 3
            END ASC
            LIMIT 1
          ) uz ON true
          WHERE 
            r.deleted_at IS NULL
            AND ST_DWithin(r.location, ul.point, $3)
            AND r.location IS NOT NULL
            ${additionalWhere}
            AND (
              $4::DECIMAL IS NULL OR
              (
                ST_Distance(r.location, ul.point) > $4 OR
                (ST_Distance(r.location, ul.point) = $4 AND r.created_at < $5) OR
                (ST_Distance(r.location, ul.point) = $4 AND r.created_at = $5 AND r.id < $6)
              )
            )
          ORDER BY 
            (uz.type IS NOT NULL) DESC, 
            distance_meters ASC, 
            r.created_at DESC, 
            r.id DESC
          LIMIT $7
        `;

        dataParams = [
          userLat,           // $1
          userLng,           // $2
          radiusMeters,      // $3
          cursorDistance,    // $4
          cursorDate,        // $5
          cursorId,          // $6
          fetchLimit,        // $7
          anonymousId,       // $8
          ...f.vals          // $9+
        ];
      } else {
        // Public flow
        const f = buildGeoFilters(8);
        const additionalWhere = f.conds.length > 0 ? `AND ${f.conds.join(' AND ')}` : '';

        dataQuery = `
          WITH user_location AS (
            SELECT ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography AS point
          )
          SELECT 
            r.id, r.anonymous_id, r.title, r.description, r.category, r.zone, r.address, 
            r.latitude, r.longitude, r.status, r.upvotes_count, r.comments_count, 
            r.created_at, r.updated_at, r.incident_date, r.image_urls,
            ST_Distance(r.location, ul.point) AS distance_meters,
            r.threads_count,
            u.avatar_url,
            u.alias
          FROM reports r
          CROSS JOIN user_location ul
          LEFT JOIN anonymous_users u ON r.anonymous_id = u.anonymous_id
          WHERE 
            r.deleted_at IS NULL
            AND ST_DWithin(r.location, ul.point, $3)
            AND r.location IS NOT NULL
            ${additionalWhere}
            AND (
              $4::DECIMAL IS NULL OR
              (
                ST_Distance(r.location, ul.point) > $4 OR
                (ST_Distance(r.location, ul.point) = $4 AND r.created_at < $5) OR
                (ST_Distance(r.location, ul.point) = $4 AND r.created_at = $5 AND r.id < $6)
              )
            )
          ORDER BY distance_meters ASC, r.created_at DESC, r.id DESC
          LIMIT $7
        `;

        dataParams = [
          userLat,
          userLng,
          radiusMeters,
          cursorDistance,
          cursorDate,
          cursorId,
          fetchLimit,
          ...f.vals
        ];
      }

      const dataResult = await queryWithRLS(anonymousId || '', dataQuery, dataParams);
      const rawReports = dataResult.rows;

      // Pagination logic
      const hasNextPage = rawReports.length > limitNum;
      const reports = hasNextPage ? rawReports.slice(0, limitNum) : rawReports;

      let nextCursor = null;
      if (hasNextPage) {
        const lastItem = reports[reports.length - 1];
        nextCursor = encodeCursor({
          d: lastItem.distance_meters,  // distance
          c: lastItem.created_at,       // created_at
          i: lastItem.id                // id
        });
      }

      // Filter by Trust Score visibility
      const visibleReports = [];
      for (const report of reports) {
        const isVisible = await checkContentVisibility(report.anonymous_id, 'report');
        if (isVisible) {
          visibleReports.push(report);
        }
      }

      logSuccess('GET /api/reports (geographic)', anonymousId);

      return res.json({
        items: visibleReports,
        pagination: {
          hasMore: hasNextPage,
          nextCursor,
          limit: limitNum
        },
        meta: {
          feedType: 'geographic',
          userLocation: { lat: userLat, lng: userLng },
          radius: radiusMeters
        }
      });
    }

    // ============================================
    // CHRONOLOGICAL FEED (Fallback)
    // ============================================

    // Parse cursor if present
    // Parse cursor if present
    const decodedCursor = cursor ? decodeCursor(cursor) : null;
    let cursorDate = null;
    let cursorId = null;

    if (decodedCursor && decodedCursor.c && decodedCursor.i) {
      cursorDate = decodedCursor.c;
      cursorId = decodedCursor.i;
    }

    const { startDate, endDate, sortBy } = req.query;

    const buildFilters = (startIndex) => {
      const conds = ['r.deleted_at IS NULL']; // Always filter out soft-deleted records
      const vals = [];
      let idx = startIndex;
      let searchIdx = null;

      if (search && typeof search === 'string' && search.trim()) {
        const searchTerm = search.trim();
        searchIdx = idx; // Capture index
        // Uses pg_trgm '%' operator for fuzzy matching (requires index)
        conds.push(`(
          r.title % $${idx} OR 
          r.description % $${idx} OR 
          r.category % $${idx} OR 
          r.address % $${idx} OR 
          r.zone % $${idx}
        )`);
        vals.push(searchTerm);
        idx++;
      }

      if (category && typeof category === 'string' && category.trim() && category !== 'all') {
        conds.push(`r.category = $${idx}`);
        vals.push(category.trim());
        idx++;
      }

      if (zone && typeof zone === 'string' && zone.trim() && zone !== 'all') {
        conds.push(`r.zone = $${idx}`);
        vals.push(zone.trim());
        idx++;
      }

      if (province && typeof province === 'string' && province.trim()) {
        conds.push(`r.province = $${idx}`);
        vals.push(province.trim());
        idx++;
      }

      if (status && typeof status === 'string' && status.trim() && status !== 'all') {
        conds.push(`r.status = $${idx}`);
        vals.push(status.trim());
        idx++;
      }

      // Date Range Filters
      if (startDate && typeof startDate === 'string') {
        // Validate date format (YYYY-MM-DD or ISO)
        if (!isNaN(Date.parse(startDate))) {
          conds.push(`r.created_at >= $${idx}`);
          vals.push(startDate); // Postgre handles ISO strings well
          idx++;
        }
      }

      if (endDate && typeof endDate === 'string') {
        if (!isNaN(Date.parse(endDate))) {
          // Add time to include the end date fully if it's just a date string date '2023-01-01' -> '2023-01-01 23:59:59.999'
          // If it's already ISO, use as is. Simplest is to cast to date + 1 day or check <=
          conds.push(`r.created_at <= ($${idx}::timestamp + INTERVAL '1 day' - INTERVAL '1 second')`);
          vals.push(endDate);
          idx++;
        }
      }

      // Filter by Followed Users ("Mi Círculo")
      const followedOnly = req.query.followed_only === 'true';
      if (followedOnly && anonymousId) {
        conds.push(`r.anonymous_id IN (SELECT following_id FROM followers WHERE follower_id = $${idx})`);
        vals.push(anonymousId);
        idx++;
      }

      return { conds, vals, nextIdx: idx, searchIdx };
    };

    // Calculate total count (Optional/Legacy compatibility)
    let totalItems = 0;
    // We skip exact total count for complex filters if performance is an issue, but for now we keep it.

    // ----------- 2. FETCH DATA WITH CURSOR -----------

    const fetchLimit = limitNum + 1;

    let dataQuery = '';
    let dataParams = [];

    // Helper to determine Sort Order
    const getOrderByClause = (searchIdx) => {
      if (searchIdx) {
        // Search relevance takes precedence if searching
        return `ORDER BY GREATEST(
              similarity(r.title, $${searchIdx}),
              similarity(r.description, $${searchIdx}),
              similarity(r.category, $${searchIdx}),
              similarity(r.zone, $${searchIdx}),
              similarity(r.address, $${searchIdx})
            ) DESC, r.created_at DESC`;
      }

      switch (sortBy) {
        case 'popular':
          // Weight: Comments * 2 + Upvotes
          return `ORDER BY (r.upvotes_count + (r.comments_count * 2)) DESC, r.created_at DESC`;
        case 'oldest':
          return `ORDER BY r.created_at ASC, r.id ASC`;
        case 'recent':
        default:
          return `ORDER BY r.created_at DESC, r.id DESC`;
      }
    };

    if (anonymousId) {
      // Authenticated flow
      const f = buildFilters(2); // $1 is anonymousId
      let whereConds = [...f.conds];
      let queryParams = [anonymousId, ...f.vals];
      let pIdx = f.nextIdx;

      const orderByClause = getOrderByClause(f.searchIdx);

      const isDefaultSort = (!sortBy || sortBy === 'recent') && !f.searchIdx;

      if (isDefaultSort && cursorDate && cursorId) {
        whereConds.push(`(r.created_at < $${pIdx} OR (r.created_at = $${pIdx} AND r.id < $${pIdx + 1}))`);
        queryParams.push(cursorDate, cursorId);
        pIdx += 2;
      }

      const whereClause = whereConds.length > 0 ? `WHERE ${whereConds.join(' AND ')}` : '';

      dataQuery = `
        SELECT 
          r.*,
          u.avatar_url,
          u.alias,
          CASE WHEN f.id IS NOT NULL THEN true ELSE false END as is_favorite,
          CASE WHEN rf.id IS NOT NULL THEN true ELSE false END as is_flagged,
          uz.type as priority_zone
        FROM reports r
        LEFT JOIN anonymous_users u ON r.anonymous_id = u.anonymous_id
        LEFT JOIN favorites f ON f.report_id = r.id AND f.anonymous_id = $1
        LEFT JOIN report_flags rf ON rf.report_id = r.id AND rf.anonymous_id = $1
        LEFT JOIN LATERAL (
          SELECT type 
          FROM user_zones 
          WHERE anonymous_id = $1 
          AND ST_DWithin(r.location, location, radius_meters)
          ORDER BY CASE 
              WHEN type = 'home' THEN 1
              WHEN type = 'work' THEN 2
              WHEN type = 'frequent' THEN 3
          END ASC
          LIMIT 1
        ) uz ON true
        ${whereClause || 'WHERE r.deleted_at IS NULL'}
        ${orderByClause}
        LIMIT $${pIdx}
      `;
      queryParams.push(fetchLimit);
      dataParams = queryParams;

    } else {
      // Public flow
      const f = buildFilters(1);
      let whereConds = [...f.conds];
      let queryParams = [...f.vals];
      let pIdx = f.nextIdx;

      const orderByClause = getOrderByClause(f.searchIdx);
      const isDefaultSort = (!sortBy || sortBy === 'recent') && !f.searchIdx;

      if (isDefaultSort && cursorDate && cursorId) {
        whereConds.push(`(r.created_at < $${pIdx} OR (r.created_at = $${pIdx} AND r.id < $${pIdx + 1}))`);
        queryParams.push(cursorDate, cursorId);
        pIdx += 2;
      }

      const whereClause = whereConds.length > 0 ? `WHERE ${whereConds.join(' AND ')}` : '';

      dataQuery = `
        SELECT r.*, u.avatar_url, u.alias
        FROM reports r 
        LEFT JOIN anonymous_users u ON r.anonymous_id = u.anonymous_id 
        ${whereClause}
        ${orderByClause}
        LIMIT $${pIdx}
      `;
      queryParams.push(fetchLimit);
      dataParams = queryParams;
    }

    const dataResult = await queryWithRLS(anonymousId || '', dataQuery, dataParams);
    const rawReports = dataResult.rows;

    // Check for next page
    const hasNextPage = rawReports.length > limitNum;
    const reports = hasNextPage ? rawReports.slice(0, limitNum) : rawReports;

    // Generate next cursor
    let nextCursor = null;
    if (hasNextPage && reports.length > 0) {
      const lastReport = reports[reports.length - 1];
      nextCursor = encodeCursor({
        c: lastReport.created_at, // timestamp
        i: lastReport.id          // uuid for ties
      });
    }

    // Process results (image formatting)
    const processedReports = reports.map(report => {
      let normalizedImageUrls = [];
      if (report.image_urls) {
        if (Array.isArray(report.image_urls)) {
          normalizedImageUrls = report.image_urls;
        } else if (typeof report.image_urls === 'string') {
          try {
            normalizedImageUrls = JSON.parse(report.image_urls);
            if (!Array.isArray(normalizedImageUrls)) normalizedImageUrls = [];
          } catch (e) { normalizedImageUrls = []; }
        }
      }

      return {
        ...report,
        image_urls: normalizedImageUrls,
        is_favorite: report.is_favorite === true, // Only present in auth flow logic but safe to access
        is_flagged: report.is_flagged === true
      };
    });

    res.json({
      success: true,
      data: processedReports,
      pagination: {
        nextCursor,
        hasNextPage,
        totalItems // Legacy support
      }
    });

  } catch (err) {
    logError(err, req);
    res.status(500).json({
      error: 'Unexpected server error',
      message: err.message
    });
  }
});

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
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const anonymousId = req.headers['x-anonymous-id'] || '';

    // threads_count is now a denormalized column (no subquery needed)
    const reportResult = await queryWithRLS(anonymousId, `
      SELECT r.*, u.avatar_url, u.alias
      FROM reports r 
      LEFT JOIN anonymous_users u ON r.anonymous_id = u.anonymous_id
      WHERE r.id = $1
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

router.post('/', requireAnonymousId, validate(reportSchema), async (req, res) => {
  try {
    const anonymousId = req.anonymousId;

    logSuccess('Creating report', { anonymousId, title: req.body.title });

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

    // ... other imports

    // Check for Duplicate Report (same block)
    // ...

    // NEW: Check Trust Score & Shadow Ban Status
    let isHidden = false;
    try {
      const visibility = await checkContentVisibility(anonymousId);
      if (visibility.isHidden) {
        isHidden = true;
        logSuccess('Shadow ban applied', { anonymousId, action: visibility.moderationAction });
      }
    } catch (checkError) {
      logError(checkError, req);
      // Fail open: Default to visible if check fails to avoid blocking valid users
    }

    // Context for logging suspicious content
    const sanitizeContext = { anonymousId, ip: req.ip };

    // SECURITY: Sanitize all user input BEFORE database insert
    const sanitizedTitle = sanitizeText(req.body.title, 'report.title', sanitizeContext);
    const sanitizedDescription = sanitizeContent(req.body.description, 'report.description', sanitizeContext);
    const sanitizedAddress = sanitizeText(req.body.address, 'report.address', sanitizeContext);
    const sanitizedZone = sanitizeText(req.body.zone, 'report.zone', sanitizeContext);

    // GEOLOCATION: Get province/locality from Georef API (Argentina)
    let province = null;
    let locality = null;
    let department = null;

    if (req.body.latitude && req.body.longitude) {
      try {
        const geoData = await reverseGeocode(
          parseFloat(req.body.latitude),
          parseFloat(req.body.longitude)
        );
        province = geoData.province;
        locality = geoData.locality;
        department = geoData.department;
        logSuccess('Georef resolved', { province, locality });
      } catch (geoError) {
        // Non-blocking: continue without province data
        logError(geoError, { context: 'georef.reverseGeocode' });
      }
    }

    // AUTO-POPULATE ZONE: If zone is empty or generic, use locality/department from Georef
    // This ensures meaningful location data for new reports while maintaining backward compatibility
    let finalZone = sanitizedZone;
    if (!finalZone || finalZone.trim() === '' || finalZone === 'Sin zona') {
      // Priority: locality > department > keep original
      finalZone = locality || department || sanitizedZone || '';
    }

    // Insert report using queryWithRLS for RLS consistency
    const insertResult = await queryWithRLS(anonymousId, `
      INSERT INTO reports (
        anonymous_id, title, description, category, zone, address, 
        latitude, longitude, status, incident_date, is_hidden,
        province, locality, department
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [
      anonymousId,
      sanitizedTitle,
      sanitizedDescription,
      req.body.category,  // Validated against whitelist, no sanitization needed
      finalZone,
      sanitizedAddress,
      req.body.latitude || null,
      req.body.longitude || null,
      req.body.status || 'pendiente',
      incidentDate,
      isHidden,
      province,
      locality,
      department
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

    // Evaluate badges (await to include in response for real-time notification)
    let newBadges = [];
    try {
      const gamification = await syncGamification(anonymousId);
      if (gamification && gamification.profile && gamification.profile.newlyAwarded) {
        newBadges = gamification.profile.newlyAwarded;

        // Notify for each new badge
        for (const badge of newBadges) {
          NotificationService.notifyBadgeEarned(anonymousId, badge)
            .catch(err => logError(err, { context: 'notifyBadgeEarned', badge: badge.code }));
        }
      }
    } catch (err) {
      logError(err, req);
    }

    // NOTIFICATIONS: Notify users (In-app)
    NotificationService.notifyNearbyNewReport(data).catch(err => logError(err, { context: 'notifyNearbyNewReport' }));
    NotificationService.notifySimilarReports(data).catch(err => logError(err, { context: 'notifySimilarReports' }));

    // PUSH NOTIFICATIONS: Notify nearby users (async, non-blocking)
    // Import dynamically to avoid circular dependencies
    import('./push.js').then(({ notifyNearbyUsers }) => {
      notifyNearbyUsers(data).catch(err => {
        logError(err, { context: 'notifyNearbyUsers' });
      });
    }).catch(() => {
      // Push module not available, ignore
    });

    res.status(201).json({
      success: true,
      data: {
        ...data,
        newBadges
      },
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
 * GET /api/reports/:id/related
 * Get related reports (same category, nearby or same zone)
 */
router.get('/:id/related', async (req, res) => {
  try {
    const { id } = req.params;
    const anonymousId = req.headers['x-anonymous-id'] || '';

    // 1. Get reference report
    const referenceResult = await queryWithRLS(anonymousId, `
      SELECT category, latitude, longitude, zone 
      FROM reports WHERE id = $1
    `, [id]);

    if (referenceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const { category, latitude, longitude, zone } = referenceResult.rows[0];

    let query = '';
    let params = [];

    // 2. Query related
    if (latitude && longitude) {
      // PostGIS KNN search by location
      // MODIFIED: Removes strict category filter to ensure results. 
      // Orders by Category Match first, then Distance.
      query = `
        SELECT id, title, category, zone, incident_date, status, image_urls, latitude, longitude, created_at
        FROM reports
        WHERE id != $2
          AND is_hidden = false
          AND deleted_at IS NULL
          AND location IS NOT NULL
        ORDER BY
          (category = $1) DESC, -- Best matches (same category) first
          location <-> ST_SetSRID(ST_MakePoint($4, $3), 4326) ASC -- Then nearest
        LIMIT 5
      `;
      params = [category, id, latitude, longitude];
    } else {
      // Fallback: Same zone
      query = `
        SELECT id, title, category, zone, incident_date, status, image_urls, latitude, longitude, created_at
        FROM reports
        WHERE id != $2
          AND is_hidden = false
          AND deleted_at IS NULL
          AND zone = $3
        ORDER BY 
          (category = $1) DESC,
          created_at DESC
        LIMIT 5
      `;
      params = [category, id, zone];
    }

    const result = await queryWithRLS(anonymousId, query, params);

    // Initial Dev Log to verify results
    if (result.rows.length === 0) {
      console.log(`[RELATED] No related reports found for Report ${id} (Lat: ${latitude}, Lng: ${longitude}, Zone: ${zone}, Cat: ${category})`);
    } else {
      console.log(`[RELATED] Found ${result.rows.length} related reports for Report ${id}`);
    }

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({ error: 'Failed to fetch related reports' });
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

    // Context for logging suspicious content
    const sanitizeContext = { anonymousId, ip: req.ip };

    if (req.body.title !== undefined) {
      updates.push(`title = $${paramIndex}`);
      // SECURITY: Sanitize before database update
      params.push(sanitizeText(req.body.title, 'report.title', sanitizeContext));
      paramIndex++;
    }

    if (req.body.description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      // SECURITY: Sanitize before database update
      params.push(sanitizeContent(req.body.description, 'report.description', sanitizeContext));
      paramIndex++;
    }

    if (req.body.status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      params.push(req.body.status);  // Status is validated against enum, no sanitization needed
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
 * Rate limited: 20 per minute, 100 per hour
 */
router.post('/:id/favorite', favoriteLimiter, requireAnonymousId, async (req, res) => {
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
        // Return 200 OK with status field so frontend knows it's idempotent
        if (insertError.code === '23505' || insertError.message?.includes('unique') || insertError.message?.includes('duplicate')) {
          return res.status(200).json({
            success: true,
            data: {
              is_favorite: true
            },
            status: 'already_exists',
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
    // Return 200 OK instead of 409 - user's intent is satisfied (report is flagged)
    const checkResult = await queryWithRLS(anonymousId, `
      SELECT id FROM report_flags WHERE anonymous_id = $1 AND report_id = $2
    `, [anonymousId, id]);

    if (checkResult.rows.length > 0) {
      return res.status(200).json({
        success: true,
        data: {
          is_flagged: true,
          flag_id: checkResult.rows[0].id
        },
        status: 'already_exists',
        message: 'Already flagged'
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

    // Soft Delete report using queryWithRLS for RLS consistency
    const deleteResult = await queryWithRLS(anonymousId, `
      UPDATE reports 
      SET deleted_at = NOW() 
      WHERE id = $1 AND anonymous_id = $2 
      AND deleted_at IS NULL
      RETURNING id
    `, [id, anonymousId]);

    if (deleteResult.rows.length === 0) {
      return res.status(403).json({
        error: 'Forbidden: You can only delete your own reports or report is already deleted'
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
 * Rate limited: 5 per minute, 20 per hour
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max per file (production grade limit)
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Archivo de imagen inválido'), false);
    }
  },
});

router.post('/:id/images', imageUploadLimiter, requireAnonymousId, upload.array('images', 5), async (req, res) => {
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
      SELECT id, anonymous_id, image_urls FROM reports WHERE id = $1
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

    // Parse existing image URLs
    let existingUrls = [];
    if (report.image_urls) {
      if (Array.isArray(report.image_urls)) {
        existingUrls = report.image_urls;
      } else if (typeof report.image_urls === 'string') {
        try {
          existingUrls = JSON.parse(report.image_urls);
        } catch (e) {
          existingUrls = [];
        }
      }
    }

    // Check if supabaseAdmin is available
    if (!supabaseAdmin) {
      return res.status(500).json({
        error: 'Storage service not configured',
        message: 'SUPABASE_SERVICE_ROLE_KEY is required for image uploads'
      });
    }

    // Upload files to Supabase Storage
    const newImageUrls = [];
    const bucketName = 'report-images';

    for (const file of files) {
      try {
        // VALIDATION: Strict MIME verification with Sharp
        await validateImageBuffer(file.buffer);

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
          newImageUrls.push(urlData.publicUrl);
        } else {
          throw new Error(`Failed to get public URL for ${file.originalname}`);
        }
      } catch (fileError) {
        logError(fileError, req);
        // Continue with other files, but log the error
        console.error(`Error uploading file ${file.originalname}:`, fileError.message);
      }
    }

    if (newImageUrls.length === 0) {
      return res.status(500).json({
        error: 'Failed to upload any images',
        message: 'All image uploads failed'
      });
    }

    const finalImageUrls = [...existingUrls, ...newImageUrls];

    // Update report with merged image URLs using queryWithRLS for RLS consistency
    await queryWithRLS(anonymousId, `
      UPDATE reports SET image_urls = $1 WHERE id = $2 AND anonymous_id = $3
    `, [JSON.stringify(finalImageUrls), id, anonymousId]);

    logSuccess('Images uploaded and appended', { id, anonymousId, new_count: newImageUrls.length, total_count: finalImageUrls.length });

    res.json({
      success: true,
      data: {
        image_urls: finalImageUrls
      },
      message: `Successfully uploaded ${newImageUrls.length} image(s)`
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({
      error: 'Failed to upload images'
    });
  }
});

/**
 * POST /api/reports/:id/share
 * Register a share event and notify report owner
 */
router.post('/:id/share', requireAnonymousId, async (req, res) => {
  try {
    const { id } = req.params;
    const anonymousId = req.anonymousId;

    // Trigger notification for the owner
    // We don't need to await this as it's non-critical for the response
    NotificationService.notifyActivity(id, 'share', id, anonymousId).catch(err => {
      logError(err, { context: 'notifyActivity.share', reportId: id });
    });

    res.json({ success: true, message: 'Share registered' });
  } catch (error) {
    logError(error, req);
    res.status(500).json({ error: 'Failed to register share' });
  }
});

export default router;

