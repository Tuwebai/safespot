import { queryWithRLS } from '../utils/rls.js';
import { geoQuerySchema } from '../utils/schemas.js';
import { reportsListResponseSchema } from '../schemas/responses.js';
import { encodeCursor, decodeCursor } from '../utils/cursor.js';
import { isValidUuid, sanitizeUuidParam } from '../utils/validation.js';
import logger from '../utils/logger.js';

export { getReportById } from './reports.reads.detail.js';
export { getRelatedReports } from './reports.reads.related.js';

function resolveRequestAnonymousId(req) {
    if (req.anonymousId && isValidUuid(req.anonymousId)) {
        return req.anonymousId;
    }
    if (req.user?.anonymous_id && isValidUuid(req.user.anonymous_id)) {
        return req.user.anonymous_id;
    }
    const headerId = req.headers['x-anonymous-id'];
    if (typeof headerId === 'string' && isValidUuid(headerId)) {
        return headerId;
    }
    return null;
}

function parseReportsLimit(limit) {
  return Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
}

function buildGeoFilters({
  startIdx,
  ownerIdIdx = null,
  roleIdx = null,
  search,
  category,
  zone,
  status,
  favoritesOnly,
  anonymousId
}) {
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
    conds.push(`r.zone ILIKE $${idx}`);
    vals.push(zone.trim());
    idx++;
  }

  if (status && status !== 'all') {
    conds.push(`r.status = $${idx}`);
    vals.push(status.trim());
    idx++;
  }

  if (favoritesOnly) {
    if (anonymousId && isValidUuid(anonymousId)) {
      conds.push(`EXISTS (SELECT 1 FROM favorites fav WHERE fav.report_id = r.id AND fav.anonymous_id = $${idx}::uuid)`);
      vals.push(anonymousId);
      idx++;
    } else {
      conds.push(`1 = 0`);
    }
  }

  return { conds, vals, nextIdx: idx };
}

function buildChronologicalFilters({
  startIndex,
  ownerIdIdx = null,
  roleIdx = null,
  search,
  category,
  zone,
  province,
  status,
  startDate,
  endDate,
  followedOnly,
  favoritesOnly,
  anonymousId
}) {
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
    searchIdx = idx;
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

  if (startDate && typeof startDate === 'string') {
    if (!isNaN(Date.parse(startDate))) {
      conds.push(`r.created_at >= $${idx}`);
      vals.push(startDate);
      idx++;
    }
  }

  if (endDate && typeof endDate === 'string') {
    if (!isNaN(Date.parse(endDate))) {
      conds.push(`r.created_at <= ($${idx}::timestamp + INTERVAL '1 day' - INTERVAL '1 second')`);
      vals.push(endDate);
      idx++;
    }
  }

  if (followedOnly && anonymousId) {
    conds.push(`r.anonymous_id IN (SELECT following_id FROM followers WHERE follower_id = $${idx}::uuid)`);
    vals.push(anonymousId);
    idx++;
  }

  if (favoritesOnly) {
    if (anonymousId && isValidUuid(anonymousId)) {
      conds.push(`EXISTS (SELECT 1 FROM favorites fav WHERE fav.report_id = r.id AND fav.anonymous_id = $${idx}::uuid)`);
      vals.push(anonymousId);
      idx++;
    } else {
      conds.push(`1 = 0`);
    }
  }

  return { conds, vals, nextIdx: idx, searchIdx };
}

function getOrderByClause(sortBy, searchIdx) {
  if (searchIdx) {
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
      return `ORDER BY ((COALESCE(r.upvotes_count, 0) * 5) + (r.comments_count * 2)) DESC, r.created_at DESC`;
    case 'oldest':
      return `ORDER BY r.created_at ASC, r.id ASC`;
    case 'recent':
    default:
      return `ORDER BY r.created_at DESC, r.id DESC`;
  }
}

function normalizeReportRow(report) {
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
}

/**
 * GET /api/reports
 * List all reports with optional filters and pagination
 * Uses Cursor-based pagination (created_at DESC, id DESC) for infinite scroll performance
 * Query params: search, category, zone, status, limit, cursor
 *
 * Contrato y comportamiento preservados (extraccion literal desde reports.reads.js)
 */
export async function getReportsList(req, res, next) {
  try {
    // ðŸ”’ IDENTITY SSOT: Prioritize req.anonymousId (same identity path as like/unlike)
    const anonymousId = resolveRequestAnonymousId(req);
    const userRole = req.user?.role || 'citizen';
    const { search, category, zone, status, lat, lng, radius, limit, cursor, province } = req.query;
    const limitNum = parseReportsLimit(limit);
    const { bounds } = req.query;

    // ============================================
    // BOUNDS FEED: "Buscar en esta zona"
    // ============================================
    if (bounds) {
      const parts = bounds.split(',').map(Number);
      if (parts.length !== 4 || parts.some(isNaN)) {
        return res.status(400).json({
          error: 'Bounds invÃ¡lidos',
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
    // GEOGRAPHIC FEED: "Cerca de MÃ­"
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

      const favoritesOnly = req.query.favorites_only === 'true';

      let dataQuery = '';
      let dataParams = [];

      const isSocialV2Enabled = process.env.ENABLE_SOCIAL_FEED_V2 !== 'false';

      if (anonymousId && isSocialV2Enabled && isValidUuid(anonymousId)) {
        // Authenticated flow with favorites/flags
        const sanitizedId = sanitizeUuidParam(anonymousId);
        const f = buildGeoFilters({
          startIdx: 10,
          ownerIdIdx: 8,
          roleIdx: 9,
          search,
          category,
          zone,
          status,
          favoritesOnly,
          anonymousId
        }); // $1-$7 reserved, $8 is anonymousId, $9 is role
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
            CASE WHEN v.id IS NOT NULL THEN true ELSE false END AS is_liked,
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
        const f = buildGeoFilters({
          startIdx: 9,
          ownerIdIdx: null,
          roleIdx: 8,
          search,
          category,
          zone,
          status,
          favoritesOnly,
          anonymousId
        }); // $1-$7 reserved, $8 is role
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

    const followedOnly = req.query.followed_only === 'true';
    const favoritesOnly = req.query.favorites_only === 'true';

    // Calculate total count (Optional/Legacy compatibility)
    const totalItems = 0;
    // We skip exact total count for complex filters if performance is an issue, but for now we keep it.

    // ----------- 2. FETCH DATA WITH CURSOR -----------

    const fetchLimit = limitNum + 1;

    let dataQuery = '';
    let dataParams = [];

    const isSocialV2Enabled = process.env.ENABLE_SOCIAL_FEED_V2 !== 'false'; // Enabled by default in this phase

    if (anonymousId && isSocialV2Enabled && isValidUuid(anonymousId)) {
      // Authenticated flow: Includes personal signals (is_liked, is_favorite, etc.)
      const sanitizedId = sanitizeUuidParam(anonymousId);
      const f = buildChronologicalFilters({
        startIndex: 3,
        ownerIdIdx: 1,
        roleIdx: 2,
        search,
        category,
        zone,
        province,
        status,
        startDate,
        endDate,
        followedOnly,
        favoritesOnly,
        anonymousId
      }); // $1 is anonymousId, $2 is role, start from $3
      const whereConds = [...f.conds];
      const queryParams = [sanitizedId, userRole, ...f.vals];
      let pIdx = f.nextIdx;

      const orderByClause = getOrderByClause(sortBy, f.searchIdx);
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
      const f = buildChronologicalFilters({
        startIndex: 2,
        ownerIdIdx: null,
        roleIdx: 1,
        search,
        category,
        zone,
        province,
        status,
        startDate,
        endDate,
        followedOnly,
        favoritesOnly,
        anonymousId
      }); // $1 is role
      const whereConds = [...f.conds];
      const queryParams = [userRole, ...f.vals];
      let pIdx = f.nextIdx;

      const orderByClause = getOrderByClause(sortBy, f.searchIdx);
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

    const processedReports = reports.map((report) => normalizeReportRow(report));

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
}


