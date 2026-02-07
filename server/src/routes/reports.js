import express from 'express';
import multer from 'multer';
import { requireAnonymousId, validateFlagReason, validateCoordinates, validateImageBuffer, isValidUuid, sanitizeUuidParam } from '../utils/validation.js';
import { validate } from '../utils/validateMiddleware.js';
import { reportSchema, geoQuerySchema } from '../utils/schemas.js';
import { checkContentVisibility } from '../utils/trustScore.js';
import { logError, logSuccess } from '../utils/logger.js';
import { ensureAnonymousUser } from '../utils/anonymousUser.js';
import { flagRateLimiter, favoriteLimiter, imageUploadLimiter, createReportLimiter } from '../utils/rateLimiter.js';
import { queryWithRLS, transactionWithRLS } from '../utils/rls.js';
import { syncGamification } from '../utils/gamificationCore.js';
import { supabaseAdmin } from '../config/supabase.js';
import { sanitizeText, sanitizeContent } from '../utils/sanitize.js';
import { reverseGeocode } from '../utils/georef.js';
import pool from '../config/database.js';
import { exportReportPDF } from '../controllers/exportController.js';
import { NotificationService as AppNotificationService } from '../utils/appNotificationService.js';
import { verifyUserStatus } from '../middleware/moderation.js';
import { realtimeEvents } from '../utils/eventEmitter.js';
import { NotificationService } from '../utils/notificationService.js';
import { AppError, ValidationError, NotFoundError, ForbiddenError } from '../utils/AppError.js';
import { ErrorCodes } from '../utils/errorCodes.js';
import { reportsListResponseSchema, singleReportResponseSchema } from '../schemas/responses.js';
import { executeUserAction } from '../utils/governance.js';
import { normalizeStatus } from '../utils/legacyShim.js';

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
 * Query params: search, category, zone, status, page, limit
 * Optional: includes is_favorite and is_flagged if X-Anonymous-Id header is present
 */
import { encodeCursor, decodeCursor } from '../utils/cursor.js';
import logger from '../utils/logger.js';

// ... other imports

/**
 * GET /api/reports
 * List all reports with optional filters and pagination
 * Uses Cursor-based pagination (created_at DESC, id DESC) for infinite scroll performance
 * Query params: search, category, zone, status, limit, cursor
 */
router.get('/', async (req, res, next) => {
  try {
    const authHeader = req.headers['x-anonymous-id'];
    const anonymousId = (authHeader && authHeader.trim() !== '') ? authHeader.trim() : null;
    const userRole = req.user?.role || 'citizen';
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
          r.id, r.title, r.description, r.category, r.zone, r.address,
          r.status, r.latitude, r.longitude, 
          r.created_at, r.updated_at, r.is_hidden, r.deleted_at, r.anonymous_id,
          r.upvotes_count, r.comments_count, r.image_urls,
          u.alias, u.avatar_url
        FROM reports r
        LEFT JOIN anonymous_users u ON r.anonymous_id = u.anonymous_id
        WHERE 
          r.location && ST_MakeEnvelope($1, $2, $3, $4, 4326)
          AND r.location IS NOT NULL
          AND (r.is_hidden = false OR r.anonymous_id = $5::uuid)
          AND (r.deleted_at IS NULL) -- Consistencia visual: no ver borrados en feed
        ORDER BY r.created_at DESC
        LIMIT 100
      `;
      // ST_MakeEnvelope(xmin, ymin, xmax, ymax, srid) -> (west, south, east, north)

      const safeBoundsId = (anonymousId && isValidUuid(anonymousId)) ? anonymousId : '00000000-0000-0000-0000-000000000000';
      const boundsParams = [west, south, east, north, safeBoundsId];

      const result = await queryWithRLS(anonymousId || '', boundsQuery, boundsParams);

      // Filter visibility if needed (though is_hidden checked, shadow ban might need check)
      // For performance on map, checking individual trust score for 100 items might be slow.
      // We'll rely on r.is_hidden being correct (updated by triggers/cron).

      return res.validateJson(reportsListResponseSchema, {
        success: true,
        data: result.rows,
        meta: { feedType: 'bounds', count: result.rows.length },
        pagination: {
          hasNextPage: false,
          nextCursor: null
        }
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
      // If radius was not in query, we pass null to let SQL use user setting
      const explicitRadius = req.query.radius ? validatedGeo.radius_meters : null;
      const defaultRadius = 1000;

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
      const buildGeoFilters = (startIdx, ownerIdIdx = null, roleIdx = null) => {
        const adminBypass = roleIdx ? ` OR $${roleIdx} = 'admin'` : '';
        const conds = ownerIdIdx
          ? [
            `(r.deleted_at IS NULL)`,
            `(r.is_hidden = false OR r.anonymous_id = $${ownerIdIdx}::uuid${adminBypass})`
          ]
          : [
            `(r.deleted_at IS NULL${adminBypass})`,
            `(r.is_hidden = false${adminBypass})`
          ];
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
          // Enterprise: Case-insensitive match for robust city filtering
          conds.push(`r.zone ILIKE $${idx}`);
          // Add wildcards for partial match robustness if desired, but exact name match is better for "City"
          // Let's stick to ILIKE with exact string for now to avoid false positives between similar cities
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

      const isSocialV2Enabled = process.env.ENABLE_SOCIAL_FEED_V2 !== 'false';

      if (anonymousId && isSocialV2Enabled && isValidUuid(anonymousId)) {
        // Authenticated flow with favorites/flags
        const sanitizedId = sanitizeUuidParam(anonymousId);
        const f = buildGeoFilters(10, 8, 9); // $1-$7 reserved, $8 is anonymousId, $9 is role
        const additionalWhere = f.conds.length > 0 ? `AND ${f.conds.join(' AND ')}` : '';

        dataQuery = `
          WITH user_location AS (
            SELECT ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography AS point
          )
          SELECT 
            r.id, r.anonymous_id, r.title, r.description, r.category, r.zone, r.address, 
            r.latitude, r.longitude, r.status, r.upvotes_count, r.comments_count, 
            r.created_at, r.updated_at, r.last_edited_at, r.incident_date, r.image_urls, r.is_hidden, r.deleted_at,
            ST_Distance(r.location, ul.point) AS distance_meters,
            CASE WHEN f.id IS NOT NULL THEN true ELSE false END AS is_favorite,
            CASE WHEN rf.id IS NOT NULL THEN true ELSE false END AS is_flagged,
            CASE WHEN rl.id IS NOT NULL THEN true ELSE false END AS is_liked,
            r.threads_count,
            uz.type as priority_zone,
            u.avatar_url,
            u.alias
          FROM reports r
          CROSS JOIN user_location ul
          LEFT JOIN anonymous_users u ON r.anonymous_id = u.anonymous_id
          LEFT JOIN anonymous_trust_scores ts ON r.anonymous_id = ts.anonymous_id
          LEFT JOIN favorites f ON f.report_id = r.id AND f.anonymous_id = $8::uuid
          LEFT JOIN report_flags rf ON rf.report_id = r.id AND rf.anonymous_id = $8::uuid
          LEFT JOIN votes v ON v.target_type = 'report' AND v.target_id = r.id AND v.anonymous_id = $8::uuid
          LEFT JOIN LATERAL (
            SELECT type 
            FROM user_zones 
            WHERE anonymous_id = $8::uuid 
            AND ST_DWithin(r.location, location, radius_meters)
            ORDER BY CASE 
                WHEN type = 'home' THEN 1
                WHEN type = 'work' THEN 2
                WHEN type = 'frequent' THEN 3
            END ASC
            LIMIT 1
          ) uz ON true
          WHERE 
            ST_DWithin(r.location, ul.point, COALESCE($3, (SELECT interest_radius_meters FROM anonymous_users WHERE anonymous_id = $8::uuid), 1000))
            AND r.location IS NOT NULL
            AND (ts.trust_score IS NULL OR ts.trust_score >= 30 OR r.anonymous_id = $8::uuid)
            AND (ts.moderation_status IS NULL OR ts.moderation_status NOT IN ('shadow_banned', 'banned') OR r.anonymous_id = $8::uuid)
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
          explicitRadius,    // $3
          cursorDistance,    // $4
          cursorDate,        // $5
          cursorId,          // $6
          fetchLimit,        // $7
          sanitizedId,       // $8
          userRole,          // $9
          ...f.vals          // $10+
        ];
      } else {
        // Public flow
        const f = buildGeoFilters(9, null, 8); // $1-$7 reserved, $8 is role
        const additionalWhere = f.conds.length > 0 ? `AND ${f.conds.join(' AND ')}` : '';

        dataQuery = `
          WITH user_location AS (
            SELECT ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography AS point
          )
          SELECT 
            r.id, r.anonymous_id, r.title, r.description, r.category, r.zone, r.address, 
            r.latitude, r.longitude, r.status, r.upvotes_count, r.comments_count, 
            r.created_at, r.updated_at, r.last_edited_at, r.incident_date, r.image_urls, r.is_hidden, r.deleted_at,
            ST_Distance(r.location, ul.point) AS distance_meters,
            r.threads_count,
            u.avatar_url,
            u.alias
          FROM reports r
          CROSS JOIN user_location ul
          LEFT JOIN anonymous_users u ON r.anonymous_id = u.anonymous_id
          LEFT JOIN anonymous_trust_scores ts ON r.anonymous_id = ts.anonymous_id
          WHERE 
            ST_DWithin(r.location, ul.point, COALESCE($3, 1000))
            AND r.location IS NOT NULL
            AND (ts.trust_score IS NULL OR ts.trust_score >= 30)
            AND (ts.moderation_status IS NULL OR ts.moderation_status NOT IN ('shadow_banned', 'banned'))
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
          explicitRadius,
          cursorDistance,
          cursorDate,
          cursorId,
          fetchLimit,
          userRole, // $8
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

      // Trust Score filter now applied at SQL level (see JOIN + WHERE above)
      // No N+1 loop needed - all reports returned are already visible
      const visibleReports = reports;

      logger.debug('GET /api/reports (geographic)', { anonymousId });

      return res.validateJson(reportsListResponseSchema, {
        success: true,
        data: visibleReports,
        pagination: {
          hasMore: hasNextPage, // Schema expects hasNextPage, but check if reportsListResponseSchema definitions match
          hasNextPage: hasNextPage,
          nextCursor,
          limit: limitNum
        },
        meta: {
          feedType: 'geographic',
          userLocation: { lat: userLat, lng: userLng },
          radius: explicitRadius
        }
      });
    }

    // ============================================
    // CHRONOLOGICAL FEED (Fallback)
    // ============================================

    const decodedCursor = cursor ? decodeCursor(cursor) : null;
    let cursorDate = null;
    let cursorId = null;

    if (decodedCursor?.c && decodedCursor?.i) {
      cursorDate = decodedCursor.c;
      cursorId = decodedCursor.i;
    }

    const { startDate, endDate, sortBy } = req.query;

    const buildFilters = (startIndex, ownerIdIdx = null, roleIdx = null) => {
      const adminBypass = roleIdx ? ` OR $${roleIdx} = 'admin'` : '';
      const conds = ownerIdIdx
        ? [
          `(r.deleted_at IS NULL)`,
          `(r.is_hidden = false OR r.anonymous_id = $${ownerIdIdx}::uuid${adminBypass})`
        ]
        : [
          `(r.deleted_at IS NULL)`,
          `(r.is_hidden = false${adminBypass})`
        ];
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
        conds.push(`r.anonymous_id IN (SELECT following_id FROM followers WHERE follower_id = $${idx}::uuid)`);
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
          // Weight: Likes * 5 + Comments * 2 + Upvotes * 1
          return `ORDER BY ((COALESCE(r.upvotes_count, 0) * 5) + (r.comments_count * 2)) DESC, r.created_at DESC`;
        case 'oldest':
          return `ORDER BY r.created_at ASC, r.id ASC`;
        case 'recent':
        default:
          return `ORDER BY r.created_at DESC, r.id DESC`;
      }
    };

    const isSocialV2Enabled = process.env.ENABLE_SOCIAL_FEED_V2 !== 'false'; // Enabled by default in this phase

    if (anonymousId && isSocialV2Enabled && isValidUuid(anonymousId)) {
      // Authenticated flow: Includes personal signals (is_liked, is_favorite, etc.)
      const sanitizedId = sanitizeUuidParam(anonymousId);
      const f = buildFilters(3, 1, 2); // $1 is anonymousId, $2 is role, start from $3
      let whereConds = [...f.conds];
      let queryParams = [sanitizedId, userRole, ...f.vals];
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
          r.id, r.anonymous_id, r.title, r.description, r.category, r.zone, r.address, 
          r.latitude, r.longitude, r.status, r.upvotes_count, r.comments_count, 
          r.created_at, r.updated_at, r.last_edited_at, r.incident_date, r.image_urls, r.is_hidden, r.deleted_at,
          u.avatar_url,
          u.alias,
          CASE WHEN ($1::uuid IS NOT NULL AND f.id IS NOT NULL) THEN true ELSE false END as is_favorite,
          CASE WHEN ($1::uuid IS NOT NULL AND rf.id IS NOT NULL) THEN true ELSE false END as is_flagged,
          CASE WHEN ($1::uuid IS NOT NULL AND v.id IS NOT NULL) THEN true ELSE false END as is_liked,
          uz.type as priority_zone
        FROM reports r
        LEFT JOIN anonymous_users u ON r.anonymous_id = u.anonymous_id
        LEFT JOIN favorites f ON f.report_id = r.id AND ($1::uuid IS NOT NULL AND f.anonymous_id = $1::uuid)
        LEFT JOIN report_flags rf ON rf.report_id = r.id AND ($1::uuid IS NOT NULL AND rf.anonymous_id = $1::uuid)
        LEFT JOIN votes v ON v.target_type = 'report' AND v.target_id = r.id AND ($1::uuid IS NOT NULL AND v.anonymous_id = $1::uuid)
        LEFT JOIN LATERAL (
          SELECT type 
          FROM user_zones 
          WHERE ($1::uuid IS NOT NULL AND anonymous_id = $1::uuid)
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
      // Public flow: Optmized, no social joins
      const f = buildFilters(2, null, 1); // $1 is role
      let whereConds = [...f.conds];
      let queryParams = [userRole, ...f.vals];
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
          r.id, r.anonymous_id, r.title, r.description, r.category, r.zone, r.address, 
          r.latitude, r.longitude, r.status, r.upvotes_count, r.comments_count, 
          r.created_at, r.updated_at, r.last_edited_at, r.incident_date, r.image_urls, r.is_hidden, r.deleted_at,
          u.avatar_url, u.alias
        FROM reports r 
        LEFT JOIN anonymous_users u ON r.anonymous_id = u.anonymous_id 
        ${whereClause}
        ${orderByClause}
        LIMIT $${pIdx}
      `;
      queryParams.push(fetchLimit);
      dataParams = queryParams;
    }

    const dataResult = await queryWithRLS(anonymousId, dataQuery, dataParams);
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
    const processedReports = reports.map((report) => {
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
        id: report.id,
        anonymous_id: report.anonymous_id,
        title: report.title,
        description: report.description,
        category: report.category,
        zone: report.zone,
        address: report.address,
        latitude: report.latitude,
        longitude: report.longitude,
        status: report.status,
        upvotes_count: report.upvotes_count,
        comments_count: report.comments_count,
        created_at: report.created_at,
        updated_at: report.updated_at,
        last_edited_at: report.last_edited_at,
        incident_date: report.incident_date,
        image_urls: normalizedImageUrls,
        is_hidden: report.is_hidden,
        deleted_at: report.deleted_at,
        avatar_url: report.avatar_url,
        alias: report.alias,
        is_favorite: report.is_favorite === true,
        is_flagged: report.is_flagged === true,
        priority_zone: report.priority_zone
      };
    });

    return res.validateJson(reportsListResponseSchema, {
      success: true,
      data: processedReports,
      pagination: {
        nextCursor,
        hasNextPage,
        totalItems // Legacy support
      }
    });

    // ... (rest of logic unchanged)

  } catch (err) {
    next(err);
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
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers['x-anonymous-id'];
    const anonymousId = (authHeader && authHeader.trim() !== '') ? authHeader.trim() : null;
    const sanitizedId = sanitizeUuidParam(anonymousId);

    // Graceful handling for temp IDs
    if (id.startsWith('temp-') || !isValidUuid(id)) {
      return res.status(404).json({ error: 'Report not found (Optimistic state)' });
    }

    // PERFORMANCE FIX: Single query with LEFT JOINs for favorites/flags (was 3 queries)
    const reportResult = await queryWithRLS(anonymousId, `
      SELECT r.id, r.anonymous_id, r.title, r.description, r.category, r.zone, r.address, 
        r.latitude, r.longitude, r.status, r.upvotes_count, r.comments_count, 
        r.created_at, r.updated_at, r.last_edited_at, r.incident_date, r.image_urls, r.is_hidden, r.deleted_at,
        u.avatar_url, 
        u.alias,
        CASE WHEN ($2::uuid IS NOT NULL AND f.id IS NOT NULL) THEN true ELSE false END AS is_favorite,
        CASE WHEN ($2::uuid IS NOT NULL AND rf.id IS NOT NULL) THEN true ELSE false END AS is_flagged,
        CASE WHEN ($2::uuid IS NOT NULL AND v.id IS NOT NULL) THEN true ELSE false END AS is_liked
      FROM reports r 
      LEFT JOIN anonymous_users u ON r.anonymous_id = u.anonymous_id
      LEFT JOIN favorites f ON f.report_id = r.id AND ($2::uuid IS NOT NULL AND f.anonymous_id = $2::uuid)
      LEFT JOIN report_flags rf ON rf.report_id = r.id AND ($2::uuid IS NOT NULL AND rf.anonymous_id = $2::uuid)
      LEFT JOIN votes v ON v.target_type = 'report' AND v.target_id = r.id AND ($2::uuid IS NOT NULL AND v.anonymous_id = $2::uuid)
      WHERE r.id = $1
      AND (r.deleted_at IS NULL OR $3 = 'admin')
      AND (r.is_hidden = false OR r.anonymous_id = $2::uuid OR $3 = 'admin')
    `, [id, sanitizedId, req.user?.role || 'citizen']);

    if (reportResult.rows.length === 0) {
      throw new NotFoundError('Report not found');
    }

    const report = reportResult.rows[0];

    // ... (rest of logic)

    return res.validateJson(singleReportResponseSchema, {
      success: true,
      data: report
    });
  } catch (err) {
    next(err);
  }
});

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
  async (req, res, next) => {
    let client;
    let newReport;

    try {
      const anonymousId = req.anonymousId;
      logger.debug('Creating report (Enterprise Atomic Flow)', { anonymousId, title: req.body.title });

      // 1. PRE-TRANSACTION: Geolocation (Georef Argentina)
      // We do this outside the transaction to avoid holding DB connections during external API wait times.
      let province = null;
      let locality = null;
      let department = null;

      if (req.body.latitude && req.body.longitude) {
        try {
          const geoData = await reverseGeocode(
            parseFloat(req.body.latitude),
            parseFloat(req.body.longitude)
          );
          province = geoData.province || null;
          locality = geoData.locality || null;
          department = geoData.department || null;
        } catch (geoError) {
          logError(geoError, { context: 'georef.reverseGeocode_pre_transaction' });
        }
      }

      // 2. PRE-TRANSACTION: Business Logic & Sanitization
      const title = req.body.title.trim();
      const category = req.body.category;
      const zone = req.body.zone || null;
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

      // Sanitization
      const sanitizeContext = { anonymousId, ip: req.ip };
      const sanitizedTitle = sanitizeText(title, 'report.title', sanitizeContext);
      const sanitizedDescription = sanitizeContent(req.body.description, 'report.description', sanitizeContext);
      const sanitizedAddress = sanitizeText(req.body.address, 'report.address', sanitizeContext) || null;
      const sanitizedZone = sanitizeText(req.body.zone, 'report.zone', sanitizeContext) || null;

      let finalZone = sanitizedZone;
      if (!finalZone || finalZone.trim() === '' || finalZone === 'Sin zona') {
        finalZone = locality || department || sanitizedZone || '';
      }

      // Incident Date
      let incidentDate = new Date().toISOString();
      if (req.body.incident_date) {
        const parsedDate = new Date(req.body.incident_date);
        if (isNaN(parsedDate.getTime())) {
          throw new ValidationError('incident_date must be a valid ISO 8601 date string');
        }
        incidentDate = parsedDate.toISOString();
      }

      // Visibility (Shadow Ban)
      let isHidden = false;
      try {
        const visibility = await checkContentVisibility(anonymousId);
        if (visibility.isHidden) isHidden = true;
      } catch (err) {
        logError(err, { context: 'visibility_check_pre_transaction' });
      }

      // Client-generated ID support
      const reportId = (req.body.id && isValidUuid(req.body.id)) ? req.body.id : crypto.randomUUID();

      // 3. ATOMIC TRANSACTION WITH RLS
      const data = await transactionWithRLS(anonymousId, async (client, sse) => {
        // 3.1 Idempotent user ensure
        await ensureAnonymousUser(anonymousId);

        // 3.2 Duplicate check within transaction
        const duplicateResult = await client.query(`
          SELECT id FROM reports
          WHERE anonymous_id = $1 AND category = $2 AND zone = $3 AND title = $4 AND created_at >= $5
          LIMIT 1
        `, [anonymousId, category, zone, title, tenMinutesAgo]);

        if (duplicateResult.rows.length > 0) {
          throw new AppError('Ya existe un reporte similar reciente', 409, ErrorCodes.DUPLICATE_ENTRY, true);
        }

        // 3.3 Strict SSOT Insert
        const columns = [
          'id', 'anonymous_id', 'title', 'description', 'category', 'zone', 'address',
          'latitude', 'longitude', 'status', 'incident_date', 'is_hidden',
          'province', 'locality', 'department'
        ];
        const values = [
          reportId, anonymousId, sanitizedTitle, sanitizedDescription, category,
          finalZone, sanitizedAddress, req.body.latitude || null, req.body.longitude || null,
          normalizeStatus(req.body.status) || 'abierto', incidentDate, isHidden, province, locality, department
        ];

        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

        // INSERT
        await client.query(`INSERT INTO reports (${columns.join(', ')}) VALUES (${placeholders})`, values);

        // RETRIEVE WITH JOIN (Deduplicated Contract)
        const retrieveResult = await client.query(`
          SELECT 
            r.id, r.anonymous_id, r.title, r.description, r.category, r.zone, r.address,
            r.latitude, r.longitude, r.status, r.incident_date, r.created_at, r.is_hidden,
            r.province, r.locality, r.department,
            u.alias, u.avatar_url
          FROM reports r
          LEFT JOIN anonymous_users u ON r.anonymous_id = u.anonymous_id
          WHERE r.id = $1
        `, [reportId]);

        newReport = retrieveResult.rows[0];

        // 3.4 Governance M12: executeUserAction (In same transaction)
        await executeUserAction({
          actorId: anonymousId,
          targetType: 'report',
          targetId: reportId,
          actionType: 'USER_REPORT_CREATE'
        }, client);

        return newReport;
      });

      logSuccess('Report created (Atomic)', { id: reportId, anonymousId });

      // 4. POST-COMMIT SIDE EFFECTS (Non-blocking, Protected)
      // These MUST NOT break the HTTP response if they fail.

      const fireAndForget = async () => {
        // SSE
        try {
          await realtimeEvents.emitNewReport(data, req.headers['x-client-id']);
        } catch (e) { logError(e, { context: 'SSE_emitNewReport' }); }

        // External Notifications (Telegram)
        try {
          await NotificationService.sendEvent('NEW_REPORT', {
            reportId: data.id,
            title: data.title,
            category: data.category,
            zone: data.zone,
            timestamp: new Date().toISOString()
          });
        } catch (e) { logError(e, { context: 'Telegram_NewReport' }); }

        // Gamification
        try {
          const gamification = await syncGamification(anonymousId);
          if (gamification?.profile?.newlyAwarded) {
            for (const badge of gamification.profile.newlyAwarded) {
              await AppNotificationService.notifyBadgeEarned(anonymousId, badge).catch(() => { });
            }
          }
        } catch (e) { logError(e, { context: 'Gamification_Sync' }); }

        // In-App & Push
        try {
          await AppNotificationService.notifyNearbyNewReport(data);
          await AppNotificationService.notifySimilarReports(data);
          const pushModule = await import('./push.js');
          await pushModule.notifyNearbyUsers(data);
        } catch (e) { logError(e, { context: 'Notifications_Push' }); }
      };

      // Set and forget (background execution)
      fireAndForget();

      // 5. CLEAN SSOT RESPONSE
      return res.status(201).json({
        success: true,
        data,
        message: 'Report created successfully'
      });

    } catch (error) {
      logError(error, req);

      if (error instanceof AppError) {
        return res.status(error.statusCode).json({
          error: error.code,
          message: error.message,
          details: error.details
        });
      }

      res.status(500).json({
        error: ErrorCodes.INTERNAL_ERROR,
        message: 'Failed to create report',
        details: error.message
      });
    } finally {
      if (client) client.release();
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

    const { category, latitude, longitude, zone, locality, province } = referenceResult.rows[0];

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
      console.log(`[RELATED] No related reports found for Report ${id} (Locality: ${locality}, Zone: ${zone})`);
    } else {
      console.log(`[RELATED] Found ${result.rows.length} related reports for Report ${id} (Locality: ${locality})`);
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
      SELECT anonymous_id, status FROM reports WHERE id = $1
    `, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Report not found'
      });
    }

    const report = checkResult.rows[0];
    const prevStatus = report.status;

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
      if (process.env.ENABLE_STRICT_REPORT_LIFECYCLE === 'true') {
        return res.status(400).json({
          error: 'Semantics Enforcement: Direct status update is forbidden. Use semantic endpoints (resolve, reject, close).'
        });
      }
      updates.push(`status = $${paramIndex}`);
      // FIX: Serialize legacy status to new enum values
      params.push(normalizeStatus(req.body.status));
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
    // CTE: Update and Retrieve enriched data in one go
    // ⚠️ CONTRACT ENFORCEMENT: Explicit projection to exclude legacy fields (likes_count)
    const CANONICAL_REPORT_FIELDS = `
      r.id, r.anonymous_id, r.title, r.description, r.category, r.zone, r.address,
      r.latitude, r.longitude, r.status, r.upvotes_count, r.comments_count,
      r.created_at, r.updated_at, r.last_edited_at, r.incident_date, r.image_urls,
      r.province, r.locality, r.department, r.threads_count, r.is_hidden, r.deleted_at
    `;

    const updateResult = await queryWithRLS(anonymousId, `
      WITH updated_report AS (
        UPDATE reports SET ${updates.join(', ')}
        WHERE id = $1 AND anonymous_id = $2
        RETURNING *
      )
      SELECT 
        ${CANONICAL_REPORT_FIELDS},
        u.alias,
        u.avatar_url
      FROM updated_report r
      LEFT JOIN anonymous_users u ON r.anonymous_id = u.anonymous_id
    `, params);

    if (updateResult.rows.length === 0) {
      return res.status(403).json({
        error: 'Forbidden: You can only update your own reports'
      });
    }

    const updatedReport = updateResult.rows[0];

    // 🔍 AUDIT LOG: Confirmar datos antes de emitir SSE
    console.log('[AUDIT PATCH REPORT] Updated data from DB:', {
      id: updatedReport.id,
      title: updatedReport.title,
      description: updatedReport.description?.substring(0, 50),
      updated_at: updatedReport.updated_at,
      timestamp: Date.now()
    });

    // REALTIME: Broadcast report update using local enriched data (CTE)
    try {
      realtimeEvents.emitReportUpdate(updatedReport);

      // If status changed and we have prevStatus available from scope, handled here or client side.
      // For now, emit Update covers the data change.
    } catch (err) {
      logError(err, { context: 'realtimeEvents.emitReportUpdate', reportId: id });
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
 * POST /api/reports/:id/like
 * Add a like to a report
 * Requires: X-Anonymous-Id header
 */
router.post('/:id/like', favoriteLimiter, requireAnonymousId, async (req, res) => {
  try {
    const { id } = req.params;
    const anonymousId = req.anonymousId;

    // Verify report exists
    const reportResult = await queryWithRLS(anonymousId, `
      SELECT id, category, status FROM reports WHERE id = $1
    `, [id]);

    if (reportResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Report not found'
      });
    }
    const report = reportResult.rows[0];

    // Atomic Like with SSOT (DB trigger handles counter)
    await executeUserAction({
      actorId: anonymousId,
      targetType: 'report',
      targetId: id,
      actionType: 'LIKE_REPORT',
      updateQuery: `
        INSERT INTO votes (anonymous_id, target_type, target_id)
        VALUES ($1::uuid, 'report'::vote_target_type, $2)
        ON CONFLICT (anonymous_id, target_type, target_id) DO NOTHING;
      `,
      updateParams: [anonymousId, id]
    });

    // Get updated count from SSOT
    const countResult = await queryWithRLS('', 'SELECT upvotes_count FROM reports WHERE id = $1', [id]);
    const upvotesCount = countResult.rows[0]?.upvotes_count || 0;

    // Realtime broadcast
    realtimeEvents.emitLikeUpdate(id, upvotesCount, report.category, report.status, req.headers['x-client-id']);

    res.json({
      success: true,
      data: {
        is_liked: true,
        upvotes_count: upvotesCount
      },
      message: 'Like added'
    });
  } catch (error) {
    // Handle unique constraint manually if needed, though DO NOTHING handles it
    logError(error, req);
    res.status(500).json({ error: 'Failed to like report' });
  }
});

/**
 * DELETE /api/reports/:id/like
 * Remove a like from a report
 */
router.delete('/:id/like', favoriteLimiter, requireAnonymousId, async (req, res) => {
  try {
    const { id } = req.params;
    const anonymousId = req.anonymousId;

    const reportResult = await queryWithRLS(anonymousId, `
      SELECT id, category, status FROM reports WHERE id = $1
    `, [id]);

    if (reportResult.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }
    const report = reportResult.rows[0];

    await executeUserAction({
      actorId: anonymousId,
      targetType: 'report',
      targetId: id,
      actionType: 'UNLIKE_REPORT',
      updateQuery: `
        DELETE FROM votes 
        WHERE anonymous_id = $1::uuid AND target_type = 'report' AND target_id = $2;
      `,
      updateParams: [anonymousId, id]
    });

    const countResult = await queryWithRLS('', 'SELECT upvotes_count FROM reports WHERE id = $1', [id]);
    const upvotesCount = countResult.rows[0]?.upvotes_count || 0;

    realtimeEvents.emitLikeUpdate(id, upvotesCount, report.category, report.status, req.headers['x-client-id']);

    res.json({
      success: true,
      data: {
        is_liked: false,
        upvotes_count: upvotesCount
      },
      message: 'Like removed'
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({ error: 'Failed to unlike report' });
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

    const comment = req.body.comment ? sanitizeText(req.body.comment, 'flag_comment', { anonymousId }) : null;

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
      INSERT INTO report_flags (anonymous_id, report_id, reason, comment)
      VALUES ($1, $2, $3, $4)
      RETURNING id, report_id, reason
    `, [anonymousId, id, reason, comment]);

    if (insertResult.rows.length === 0) {
      logError(new Error('Insert returned no data'), req);
      return res.status(500).json({
        error: 'Failed to flag report',
        message: 'Insert operation returned no data'
      });
    }

    const newFlag = insertResult.rows[0];

    // SYSTEMIC FIX: Check for Auto-Hide (Realtime Consistency)
    // If threshold met, trigger will set is_hidden = true. We must notify SSE clients.
    const statusCheck = await queryWithRLS(anonymousId, `
      SELECT is_hidden, category, status FROM reports WHERE id = $1
    `, [id]);

    if (statusCheck.rows.length > 0 && statusCheck.rows[0].is_hidden) {
      const r = statusCheck.rows[0];
      realtimeEvents.emitReportDelete(id, r.category, r.status);
      console.log(`[Moderation] 🛡️ Auto-hide triggered by flags for report ${id}. Event broadcasted.`);
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

    // [M12 REFINEMENT] Use executeUserAction for Willpower Audit + Mutation
    const result = await executeUserAction({
      actorId: anonymousId,
      targetType: 'report',
      targetId: id,
      actionType: 'USER_DELETE_SELF_REPORT',
      updateQuery: `UPDATE reports SET deleted_at = NOW() WHERE id = $1 AND anonymous_id = $2 AND deleted_at IS NULL`,
      updateParams: [id, anonymousId]
    });

    if (result.rowCount === 0) {
      // If snapshot existed but UPDATE affected 0 rows, it's either already deleted or ownership mismatch
      // executeUserAction throws 'Target not found' if it doesn't exist at all, so here it's definitely mismatch or already deleted.
      return res.status(403).json({
        error: 'Forbidden',
        message: 'No tienes permiso para eliminar este reporte o ya fue eliminado'
      });
    }

    const currentItem = result.snapshot;
    logSuccess('Report deleted with Willpower Audit', { id, anonymousId });

    // REALTIME: Broadcast soft delete
    realtimeEvents.emitReportDelete(
      id,
      currentItem.category,
      currentItem.status,
      req.headers['x-client-id']
    );

    res.json({
      success: true,
      message: 'Report deleted successfully'
    });
  } catch (error) {
    logError(error, req);

    // M12 Governance Errors
    if (error.message === 'Target not found') {
      return res.status(404).json({
        error: 'Report not found',
        message: 'El reporte no existe o ya fue eliminado'
      });
    }

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
 * Rate limited: 5 per minute, 20 per hour
 */

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

