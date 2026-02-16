import express from 'express';
import { requireAnonymousId } from '../utils/validation.js';
import { validate } from '../utils/validateMiddleware.js';
import { commentSchema, commentUpdateSchema } from '../utils/schemas.js';
import { logError } from '../utils/logger.js';
import { likeLimiter, createCommentLimiter } from '../utils/rateLimiter.js';
import { queryWithRLS } from '../utils/rls.js';
import supabase from '../config/supabase.js';
import { verifyUserStatus } from '../middleware/moderation.js';
import { isValidUuid } from '../utils/validation.js';
import { NotFoundError } from '../utils/AppError.js';
import { createComment, updateComment, deleteComment, likeComment, unlikeComment, flagComment, pinComment, unpinComment } from './comments.mutations.js';

const router = express.Router();

/**
 * GET /api/comments/id/:id
 * Get a single comment by ID (Canonical Detail Fetch)
 * Used by useComment queryFn to restore CMT-001 Invariant
 */
router.get('/id/:id', requireAnonymousId, async (req, res, next) => {
  try {
    const { id } = req.params;
    const anonymousId = req.anonymousId;

    const result = await queryWithRLS(
      anonymousId,
      `SELECT 
         c.id, c.report_id, c.anonymous_id, c.content, c.upvotes_count, c.created_at, c.updated_at, c.last_edited_at, c.parent_id, c.is_thread, c.is_pinned,
         u.avatar_url, u.alias,
         (c.anonymous_id = r.anonymous_id) as is_author
       FROM comments c
       LEFT JOIN anonymous_users u ON c.anonymous_id = u.anonymous_id
       INNER JOIN reports r ON c.report_id = r.id
       WHERE c.id = $1 AND c.deleted_at IS NULL AND r.deleted_at IS NULL`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Comment not found');
    }

    const comment = result.rows[0];

    // Check likes/flags if anonymousId provided
    let liked = false;
    let flagged = false;

    if (anonymousId) {
      const voteCheck = await queryWithRLS(
        anonymousId,
        `SELECT type FROM votes WHERE target_id = $1 AND anonymous_id = $2 AND target_type = 'comment'`,
        [id, anonymousId]
      );
      liked = voteCheck.rows.some(v => v.type === 'upvote');

      const flagCheck = await queryWithRLS(
        anonymousId,
        `SELECT id FROM flags WHERE target_id = $1 AND anonymous_id = $2 AND target_type = 'comment'`,
        [id, anonymousId]
      );
      flagged = flagCheck.rows.length > 0;
    }

    res.json({
      success: true,
      data: {
        ...comment,
        liked_by_me: liked,
        is_flagged: flagged
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/comments/:reportId
 * Get all comments for a report with likes information and pagination
 * Query params: page, limit
 * Optional: anonymous_id header to check if user liked each comment
 */
router.get('/:reportId', async (req, res, next) => {
  try {
    const { reportId } = req.params;
    // 🔒 SECURITY FIX: Use verified identity from JWT if available, null otherwise
    const anonymousId = req.user?.anonymous_id || null;
    const { page, limit } = req.query;

    // Graceful handling for temp IDs (Optimistic UI)
    if (reportId.startsWith('temp-') || !isValidUuid(reportId)) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        pagination: {
          page: 1,
          limit: Math.min(50, parseInt(limit, 10) || 20),
          totalItems: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false
        }
      });
    }

    // Parse pagination parameters with defaults and validation
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20)); // Max 50, default 20
    const offset = (pageNum - 1) * limitNum;

    // Execute queries in parallel using raw SQL for better control and JOIN support
    const countPromise = queryWithRLS(
      anonymousId || '', // Use empty string if no ID provided for RLS context
      `SELECT COUNT(*) as count 
       FROM comments c
       JOIN reports r ON c.report_id = r.id
       WHERE c.report_id = $1 
       AND c.deleted_at IS NULL
       AND r.deleted_at IS NULL`,
       [reportId]
    );

    const dataPromise = queryWithRLS(
      anonymousId || '',
      `SELECT 
         c.id, c.report_id, c.anonymous_id, c.content, c.upvotes_count, c.created_at, c.updated_at, c.last_edited_at, c.parent_id, c.is_thread, c.is_pinned,
         u.avatar_url, u.alias,
         -- Highlight logic: Must have >= 2 likes and equal the maximum likes in this result set
         (c.upvotes_count >= 2 AND c.upvotes_count = MAX(c.upvotes_count) OVER()) as is_highlighted,
         -- Context Badges Logic
         (c.anonymous_id = r.anonymous_id) as is_author,
         (
           EXISTS (
             SELECT 1 FROM reports r2 
             WHERE r2.anonymous_id = c.anonymous_id 
             AND r2.deleted_at IS NULL
             AND (
               (r2.locality = r.locality AND r.locality IS NOT NULL) OR 
               (r2.zone = r.zone AND r.zone IS NOT NULL)
             )
           )
           OR
           EXISTS (
             SELECT 1 FROM user_zones uz
             WHERE uz.anonymous_id = c.anonymous_id
             AND r.longitude IS NOT NULL AND r.latitude IS NOT NULL
             AND ST_DWithin(
                ST_SetSRID(ST_MakePoint(uz.lng, uz.lat), 4326)::geography,
                ST_SetSRID(ST_MakePoint(r.longitude, r.latitude), 4326)::geography,
               COALESCE(uz.radius_meters, 1000)
             )
           )
         ) as is_local
       FROM comments c
       LEFT JOIN anonymous_users u ON c.anonymous_id = u.anonymous_id
       INNER JOIN reports r ON c.report_id = r.id
       WHERE c.report_id = $1 
       AND c.deleted_at IS NULL
       AND r.deleted_at IS NULL
       ORDER BY 
         c.is_pinned DESC NULLS LAST,
         CASE WHEN c.is_pinned THEN c.updated_at END DESC,
         c.created_at DESC
       LIMIT $2 OFFSET $3`,
      [reportId, limitNum, offset]
    );

    const [countResult, dataResult] = await Promise.all([countPromise, dataPromise]);

    const totalItems = parseInt(countResult.rows[0].count, 10);
    const comments = dataResult.rows;

    // Calculate pagination metadata
    const totalPages = Math.ceil((totalItems || 0) / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    if (!comments || comments.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0,
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

    // If anonymous_id is provided, check which comments the user has liked and flagged using queryWithRLS
    let likedCommentIds = new Set();
    let flaggedCommentIds = new Set();

    if (anonymousId) {
      const commentIds = comments.map(c => c.id);

      // Check likes using queryWithRLS for RLS enforcement
      const likesResult = await queryWithRLS(
        anonymousId,
        `SELECT target_id as comment_id FROM votes 
         WHERE anonymous_id = $1 AND target_type = 'comment' AND target_id = ANY($2)`,
        [anonymousId, commentIds]
      );

      if (likesResult.rows.length > 0) {
        likedCommentIds = new Set(likesResult.rows.map(l => l.comment_id));
      }

      // Check flags using queryWithRLS for RLS enforcement
      const flagsResult = await queryWithRLS(
        anonymousId,
        `SELECT comment_id FROM comment_flags 
         WHERE anonymous_id = $1 AND comment_id = ANY($2)`,
        [anonymousId, commentIds]
      );

      if (flagsResult.rows.length > 0) {
        flaggedCommentIds = new Set(flagsResult.rows.map(f => f.comment_id));
      }
    }

    // Enrich comments with liked_by_me and is_flagged flags
    const enrichedComments = comments.map(comment => ({
      ...comment,
      liked_by_me: anonymousId ? likedCommentIds.has(comment.id) : false,
      is_flagged: anonymousId ? flaggedCommentIds.has(comment.id) : false
    }));

    res.json({
      success: true,
      data: enrichedComments,
      count: enrichedComments.length,
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
    // try-catch removed as it was empty and causing lint error

    next(err);
  }
});

/**
 * POST /api/comments
 * Create a new comment
 * Requires: X-Anonymous-Id header
 */
router.post('/', requireAnonymousId, verifyUserStatus, createCommentLimiter, validate(commentSchema), createComment);

/**
 * PATCH /api/comments/:id
 * Update a comment (only by creator)
 * Requires: X-Anonymous-Id header
 * Body: { content: string }
 */
router.patch('/:id', requireAnonymousId, validate(commentUpdateSchema), updateComment);

router.delete('/:id', requireAnonymousId, deleteComment);

/**
 * POST /api/comments/:id/like
 * Like a comment
 * Requires: X-Anonymous-Id header
 * Rate limited: 30 per minute, 200 per hour
 */
router.post('/:id/like', requireAnonymousId, verifyUserStatus, likeLimiter, likeComment);

/**
 * DELETE /api/comments/:id/like
 * Unlike a comment
 * Requires: X-Anonymous-Id header
 * Rate limited: 30 per minute, 200 per hour
 */
router.delete('/:id/like', requireAnonymousId, likeLimiter, unlikeComment);

/**
 * POST /api/comments/:id/flag
 * Flag a comment as inappropriate
 * Requires: X-Anonymous-Id header
 * Rate limited: 5 flags per minute per anonymous ID
 */
router.post('/:id/flag', requireAnonymousId, flagComment);

/**
 * POST /api/comments/:id/pin
 * Pin a comment (Only by Report Owner)
 */
router.post('/:id/pin', requireAnonymousId, pinComment);

/**
 * DELETE /api/comments/:id/pin
 * Unpin a comment
 */
router.delete('/:id/pin', requireAnonymousId, unpinComment);

export default router;



