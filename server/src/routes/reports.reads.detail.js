import { queryWithRLS } from '../utils/rls.js';
import { singleReportResponseSchema } from '../schemas/responses.js';
import { isValidUuid, sanitizeUuidParam } from '../utils/validation.js';
import { NotFoundError } from '../utils/AppError.js';

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

/**
 * GET /api/reports/:id
 * Get a single report by ID
 * Optional: includes is_favorite and is_flagged if X-Anonymous-Id header is present
 *
 * Contrato y comportamiento preservados (extraccion literal desde reports.reads.js)
 */
export async function getReportById(req, res, next) {
    try {
        const { id } = req.params;
        // 🔒 IDENTITY SSOT: Prioritize req.anonymousId (same identity path as like/unlike)
        const anonymousId = resolveRequestAnonymousId(req);
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
}
