import express from 'express';
import { requireAnonymousId, validateFlagReason } from '../utils/validation.js';
import { validate } from '../utils/validateMiddleware.js';
import { commentSchema, commentUpdateSchema } from '../utils/schemas.js';
import { logError, logSuccess } from '../utils/logger.js';
import { ensureAnonymousUser } from '../utils/anonymousUser.js';
import { flagRateLimiter, likeLimiter, createCommentLimiter } from '../utils/rateLimiter.js';
import { syncGamification } from '../utils/gamificationCore.js';
import { queryWithRLS } from '../utils/rls.js';
import { checkContentVisibility } from '../utils/trustScore.js';
import supabase from '../config/supabase.js';
import { sanitizeContent, sanitizeText, sanitizeCommentContent } from '../utils/sanitize.js';
import { NotificationService } from '../utils/notificationService.js';
import { realtimeEvents } from '../utils/eventEmitter.js';
import { extractMentions } from '../utils/mentions.js';
import { verifyUserStatus } from '../middleware/moderation.js';
import { isValidUuid } from '../utils/validation.js';
import { AppError, ValidationError, NotFoundError, ForbiddenError } from '../utils/AppError.js';
import { ErrorCodes } from '../utils/errorCodes.js';

const router = express.Router();

/**
 * GET /api/comments/:reportId
 * Get all comments for a report with likes information and pagination
 * Query params: page, limit
 * Optional: anonymous_id header to check if user liked each comment
 */
router.get('/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    const anonymousId = req.headers['x-anonymous-id'];
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
      `SELECT COUNT(*) as count FROM comments WHERE report_id = $1 AND deleted_at IS NULL`,
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
       WHERE c.report_id = $1 AND c.deleted_at IS NULL
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
        `SELECT comment_id FROM comment_likes 
         WHERE anonymous_id = $1 AND comment_id = ANY($2)`,
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
    try {
      const fs = await import('fs');
      const debugInfo = {
        message: err.message,
        stack: err.stack,
        reportId: req.params.reportId,
        query: req.query,
        timestamp: new Date().toISOString()
      };
      // Keep debug log in development (optional, but safe to keep local debug file if needed)
      // fs.writeFileSync... (Commented out to clean up codebase, or rely on structured logs)
    } catch (e) { }

    next(err);
  }
});

/**
 * POST /api/comments
 * Create a new comment
 * Requires: X-Anonymous-Id header
 */
router.post('/', requireAnonymousId, verifyUserStatus, createCommentLimiter, validate(commentSchema), async (req, res) => {
  try {
    const anonymousId = req.anonymousId;
    let isHidden = false; // Shadow ban status

    // Ensure anonymous user exists in anonymous_users table (idempotent)
    // 0. Parallel Verification: Run all initial checks at once to save round-trips
    const isThread = req.body.is_thread === true;
    const hasParentId = req.body.parent_id !== undefined && req.body.parent_id !== null;

    try {
      const verificationPromises = [
        ensureAnonymousUser(anonymousId),
        supabase.from('reports').select('id').eq('id', req.body.report_id).maybeSingle()
      ];

      if (hasParentId) {
        verificationPromises.push(
          supabase.from('comments').select('id, report_id').eq('id', req.body.parent_id).maybeSingle()
        );
      }

      // Add Trust Score check to the parallel batch (since we moved it from being a separate await later)
      verificationPromises.push(checkContentVisibility(anonymousId));

      const results = await Promise.all(verificationPromises);

      // Extract results based on position
      const reportResult = results[1];
      const parentResult = hasParentId ? results[2] : null;
      const visibilityResult = hasParentId ? results[3] : results[2];

      // Handle Report Check Result
      if (reportResult.error) throw reportResult.error;
      if (!reportResult.data) {
        return res.status(404).json({ error: 'Report not found' });
      }

      // Handle Parent Check Result
      if (hasParentId) {
        if (parentResult.error) throw parentResult.error;
        if (!parentResult.data) {
          throw new NotFoundError('Parent comment not found');
        }
        if (parentResult.data.report_id !== req.body.report_id) {
          throw new AppError('Parent comment must belong to the same report', 400, ErrorCodes.BAD_REQUEST, true);
        }
      }

      // Handle Visibility (Shadow Ban) Result
      if (visibilityResult.isHidden) {
        isHidden = true;
        logSuccess('Shadow ban applied to comment', { anonymousId, action: visibilityResult.moderationAction });
      }

    } catch (error) {
      logError(error, req);
      return res.status(500).json({
        error: 'Failed to verify comment dependencies',
        details: error.message
      });
    }

    // Validate thread rules
    if (isThread && hasParentId) {
      return res.status(400).json({
        error: 'Threads cannot have a parent_id (threads must be top-level)'
      });
    }

    // Context for logging suspicious content
    const sanitizeContext = { anonymousId, ip: req.ip };

    // SECURITY: Sanitize content BEFORE database insert
    // This handles both plain text and JSON-structured comments (automatically detects JSON)
    let content = sanitizeCommentContent(req.body.content, sanitizeContext);

    // CRITICAL: Validate required fields before INSERT
    if (!req.body.report_id || !anonymousId || !content) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: {
          report_id: !!req.body.report_id,
          anonymous_id: !!anonymousId,
          content: !!content
        }
      });
    }

    // CRITICAL: Normalize parent_id - must be explicit null, never undefined
    const parentId = (hasParentId && !isThread) ? req.body.parent_id : null;

    // normal lifecycle continues...

    // Insert comment using queryWithRLS for RLS enforcement
    const insertQuery = `
      WITH inserted AS (
        INSERT INTO comments (report_id, anonymous_id, content, is_thread, parent_id, is_hidden)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      )
      SELECT 
        i.*,
        u.avatar_url, u.alias,
        (i.anonymous_id = r.anonymous_id) as is_author,
        (
          EXISTS (
            SELECT 1 FROM reports r2 
            WHERE r2.anonymous_id = i.anonymous_id 
            AND r2.deleted_at IS NULL
            AND (
              (r2.locality = r.locality AND r.locality IS NOT NULL) OR 
              (r2.zone = r.zone AND r.zone IS NOT NULL)
            )
          )
          OR
          EXISTS (
            SELECT 1 FROM user_zones uz
            WHERE uz.anonymous_id = i.anonymous_id
            AND r.longitude IS NOT NULL AND r.latitude IS NOT NULL
            AND ST_DWithin(
                ST_SetSRID(ST_MakePoint(uz.lng, uz.lat), 4326)::geography,
                ST_SetSRID(ST_MakePoint(r.longitude, r.latitude), 4326)::geography,
              COALESCE(uz.radius_meters, 1000)
            )
          )
        ) as is_local
      FROM inserted i
      LEFT JOIN anonymous_users u ON i.anonymous_id = u.anonymous_id
      INNER JOIN reports r ON i.report_id = r.id
    `;

    // CRITICAL: Ensure all params are defined (no undefined values)
    const insertParams = [
      req.body.report_id,    // $1
      anonymousId,           // $2
      content,               // $3 - Already sanitized above
      isThread || false,     // $4
      parentId,              // $5
      isHidden               // $6
    ];

    // Development mode: log params for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('[CREATE COMMENT] Params:', insertParams);
    }

    const insertResult = await queryWithRLS(
      anonymousId,
      insertQuery,
      insertParams
    );

    if (insertResult.rows.length === 0) {
      logError(new Error('Insert returned no rows'), req);
      return res.status(500).json({
        error: 'Failed to create comment'
      });
    }

    const data = insertResult.rows[0];

    // Trigger gamification sync asynchronously (non-blocking)
    syncGamification(anonymousId).catch(err => {
      logError(err, { context: 'syncGamification.comment', anonymousId });
    });

    // NOTIFICATIONS: Notify report owner (Async)
    try {
      const isSighting = content.includes('"type":"sighting"');
      const activityType = isSighting ? 'sighting' : 'comment';

      // 1. Notify Report Owner
      NotificationService.notifyActivity(req.body.report_id, activityType, data.id, anonymousId).catch(err => {
        logError(err, { context: 'notifyActivity.comment', reportId: req.body.report_id });
      });

      // 2. Notify Parent Comment Author (if reply)
      if (parentId) {
        NotificationService.notifyCommentReply(parentId, data.id, anonymousId).catch(err => {
          logError(err, { context: 'notifyCommentReply', parentId });
        });
      }

      // 3. Notify Mentioned Users
      // Parsing content to find mentions
      try {
        console.log('[DEBUG-MENTIONS] Content to parse:', req.body.content.substring(0, 100)); // Log first 100 chars
        const mentionedIds = extractMentions(req.body.content);
        console.log('[DEBUG-MENTIONS] Extracted IDs:', mentionedIds);

        if (mentionedIds.length > 0) {
          console.log(`[Notify] Found mentions for comment ${data.id}:`, mentionedIds);
          // Notify each unique mentioned user (except self)
          mentionedIds.forEach(targetId => {
            if (targetId !== anonymousId) {
              console.log(`[DEBUG-MENTIONS] Sending notification to ${targetId}`);
              NotificationService.notifyMention(targetId, data.id, anonymousId, req.body.report_id).catch(err => {
                console.error('[Notify] Failed to notify mention:', err);
              });
            } else {
              console.log('[DEBUG-MENTIONS] Skipping self-mention');
            }
          });
        } else {
          console.log('[DEBUG-MENTIONS] No mentions found in content');
        }
      } catch (mentionErr) {
        console.error('[Notify] Error processing mentions:', mentionErr);
      }

    } catch (err) {
      // Ignore notification errors to not break comment creation
    }

    // REALTIME: Broadcast new comment to all connected clients
    const clientId = req.headers['x-client-id'] || req.headers['x-request-id'];
    try {
      realtimeEvents.emitNewComment(req.body.report_id, data, clientId);

      // CRITICAL: Explicitly broadcast report-update to synchronize counters at 0ms globally
      // This prevents User B from seeing "0 comments" while User A just added one.
      realtimeEvents.emitVoteUpdate('report', req.body.report_id, {
        comments_count_delta: 1
      }, clientId);

    } catch (err) {
      // Ignore realtime errors to not break comment creation
      logError(err, { context: 'realtimeEvents.emitNewComment', reportId: req.body.report_id });
    }

    // ... (rest of logic)

    res.status(201).json({
      success: true,
      data,
      message: 'Comment created successfully'
    });
  } catch (error) {
    // Manual Validation Errors
    if (error.message.startsWith('VALIDATION_ERROR')) {
      return next(new ValidationError(error.message));
    }

    next(error);
  }
});

/**
 * PATCH /api/comments/:id
 * Update a comment (only by creator)
 * Requires: X-Anonymous-Id header
 * Body: { content: string }
 */
router.patch('/:id', requireAnonymousId, validate(commentUpdateSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const anonymousId = req.anonymousId;

    // Check if comment exists and belongs to user using queryWithRLS
    const checkResult = await queryWithRLS(
      anonymousId,
      `SELECT id, anonymous_id, content FROM comments 
       WHERE id = $1 AND anonymous_id = $2`,
      [id, anonymousId]
    );

    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Comment not found or you do not have permission to edit it');
    }

    const comment = checkResult.rows[0];

    // ... (rest of logic)

    res.json({
      success: true,
      data: updatedComment,
      message: 'Comment updated successfully'
    });
  } catch (error) {
    if (error.message.startsWith('VALIDATION_ERROR')) {
      return next(new ValidationError(error.message));
    }
    next(error);
  }
});

/**
 * DELETE /api/comments/:id
 * Delete a comment (only by creator)
 * Requires: X-Anonymous-Id header
 */
router.delete('/:id', requireAnonymousId, async (req, res) => {
  try {
    const { id } = req.params;
    const anonymousId = req.anonymousId;

    // Check if comment exists and belongs to user using queryWithRLS
    const checkResult = await queryWithRLS(
      anonymousId,
      `SELECT anonymous_id FROM comments 
       WHERE id = $1 AND anonymous_id = $2`,
      [id, anonymousId]
    );

    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Comment not found or you do not have permission to delete it');
    }

    // Soft Delete comment using queryWithRLS for RLS enforcement
    const deleteResult = await queryWithRLS(
      anonymousId,
      `UPDATE comments 
       SET deleted_at = NOW() 
       WHERE id = $1 AND anonymous_id = $2
       AND deleted_at IS NULL`,
      [id, anonymousId]
    );

    if (deleteResult.rowCount === 0) {
      throw new ForbiddenError('Forbidden: You can only delete your own comments or comment is already deleted');
    }

    const deletedId = id;
    const reportId = checkResult.rows[0].report_id;

    // REALTIME: Broadcast deletion
    try {
      const clientId = req.headers['x-client-id'];
      realtimeEvents.emitCommentDelete(reportId, deletedId, clientId);
    } catch (err) {
      logError(err, { context: 'realtimeEvents.emitCommentDelete', reportId });
    }

    // CRITICAL FIX: Manually decrement report counter because DB trigger might not handle soft deletes
    try {
      await queryWithRLS(
        anonymousId,
        `UPDATE reports SET comments_count = GREATEST(0, comments_count - 1) WHERE id = $1`,
        [reportId]
      );
    } catch (err) {
      console.error('[DELETE_COMMENT] Failed to decrement report count:', err);
      // Don't fail the request, just log it
    }

    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/comments/:id/like
 * Like a comment
 * Requires: X-Anonymous-Id header
 * Rate limited: 30 per minute, 200 per hour
 */
router.post('/:id/like', requireAnonymousId, verifyUserStatus, likeLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const anonymousId = req.anonymousId;

    // Verify comment exists
    const { data: comment, error: commentError } = await supabase
      .from('comments')
      .select('id, upvotes_count, report_id')
      .eq('id', id)
      .maybeSingle();

    if (commentError) {
      logError(commentError, req);
      return res.status(500).json({
        error: 'Failed to verify comment'
      });
    }

    if (!comment) {
      return res.status(404).json({
        error: 'Comment not found'
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

    // NEW: Check Trust Score & Shadow Ban Status
    let isHidden = false;
    try {
      const visibility = await checkContentVisibility(anonymousId);
      if (visibility.isHidden) {
        isHidden = true;
        logSuccess('Shadow ban applied to comment like', { anonymousId, action: visibility.moderationAction });
      }
    } catch (checkError) {
      logError(checkError, req);
      // Fail open
    }

    // Try to insert like using queryWithRLS for RLS enforcement
    try {
      const insertResult = await queryWithRLS(
        anonymousId,
        `INSERT INTO comment_likes (comment_id, anonymous_id, is_hidden)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [id, anonymousId, isHidden]
      );

      // Evaluate badges (await to include in response for real-time notification)
      let newBadges = [];
      try {
        const gamification = await syncGamification(anonymousId);
        if (gamification && gamification.profile && gamification.profile.newlyAwarded) {
          newBadges = gamification.profile.newlyAwarded;
        }
      } catch (err) {
        logError(err, req);
      }

      // Get updated count (trigger should have updated it)
      const { data: updatedComment } = await supabase
        .from('comments')
        .select('upvotes_count')
        .eq('id', id)
        .single();

      // Trigger Notification for Like (Async)
      NotificationService.notifyLike('comment', id, anonymousId).catch(err => {
        logError(err, { context: 'notifyLike.comment', commentId: id });
      });

      // REALTIME: Broadcast comment like update (Atomic Delta)
      try {
        const clientId = req.headers['x-client-id'];
        realtimeEvents.emitCommentLike(comment.report_id, id, 1, clientId);

        // Backward compatibility for generic listeners
        realtimeEvents.emitVoteUpdate('comment', id, { upvotes_count: updatedComment?.upvotes_count || comment.upvotes_count + 1 }, clientId, comment.report_id);
      } catch (err) {
        logError(err, { context: 'realtimeEvents.emitCommentLike.commentLike', commentId: id });
      }

      return res.json({
        success: true,
        data: {
          liked: true,
          upvotes_count: updatedComment?.upvotes_count || comment.upvotes_count + 1,
          newBadges
        },
        message: 'Comment liked successfully'
      });
    } catch (likeError) {
      // Check if it's a unique constraint violation (already liked)
      if (likeError.code === '23505' || likeError.message?.includes('unique')) {
        // Already liked, return current count
        const { data: updatedComment } = await supabase
          .from('comments')
          .select('upvotes_count')
          .eq('id', id)
          .single();

        return res.json({
          success: true,
          data: {
            liked: true,
            upvotes_count: updatedComment?.upvotes_count || comment.upvotes_count,
            newBadges: []
          },
          message: 'Comment already liked'
        });
      }

      logError(likeError, req);
      return res.status(500).json({
        error: 'Failed to like comment'
      });
    }
  } catch (error) {
    logError(error, req);
    res.status(500).json({
      error: 'Failed to like comment'
    });
  }
});

/**
 * DELETE /api/comments/:id/like
 * Unlike a comment
 * Requires: X-Anonymous-Id header
 * Rate limited: 30 per minute, 200 per hour
 */
router.delete('/:id/like', requireAnonymousId, likeLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const anonymousId = req.anonymousId;

    // Verify comment exists
    const { data: comment, error: commentError } = await supabase
      .from('comments')
      .select('id, upvotes_count, report_id')
      .eq('id', id)
      .maybeSingle();

    if (commentError) {
      logError(commentError, req);
      return res.status(500).json({
        error: 'Failed to verify comment'
      });
    }

    if (!comment) {
      return res.status(404).json({
        error: 'Comment not found'
      });
    }

    // Delete the like using queryWithRLS for RLS enforcement
    const deleteResult = await queryWithRLS(
      anonymousId,
      `DELETE FROM comment_likes 
       WHERE comment_id = $1 AND anonymous_id = $2`,
      [id, anonymousId]
    );

    if (deleteResult.rowCount === 0) {
      // Like not found, but don't fail - just return current state
      const { data: updatedComment } = await supabase
        .from('comments')
        .select('upvotes_count')
        .eq('id', id)
        .single();

      return res.json({
        success: true,
        data: {
          liked: false,
          upvotes_count: updatedComment?.upvotes_count || comment.upvotes_count
        },
        message: 'Like not found'
      });
    }

    // Get updated count (trigger should have updated it)
    const { data: updatedComment } = await supabase
      .from('comments')
      .select('upvotes_count')
      .eq('id', id)
      .single();

    const finalCount = updatedComment?.upvotes_count || Math.max(0, comment.upvotes_count - 1);

    // REALTIME: Broadcast comment unlike update (Atomic Delta)
    try {
      const clientId = req.headers['x-client-id'];
      realtimeEvents.emitCommentLike(comment.report_id, id, -1, clientId);

      // Backward compatibility
      realtimeEvents.emitVoteUpdate('comment', id, { upvotes_count: finalCount }, clientId, comment.report_id);
    } catch (err) {
      logError(err, { context: 'realtimeEvents.emitCommentLike.commentUnlike', commentId: id });
    }

    res.json({
      success: true,
      data: {
        liked: false,
        upvotes_count: finalCount
      },
      message: 'Comment unliked successfully'
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({
      error: 'Failed to unlike comment'
    });
  }
});

/**
 * POST /api/comments/:id/flag
 * Flag a comment as inappropriate
 * Requires: X-Anonymous-Id header
 * Rate limited: 5 flags per minute per anonymous ID
 */
router.post('/:id/flag', requireAnonymousId, async (req, res) => {
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

    // Verify comment exists and get owner
    const { data: comment, error: commentError } = await supabase
      .from('comments')
      .select('id, anonymous_id')
      .eq('id', id)
      .maybeSingle();

    if (commentError) {
      logError(commentError, req);
      return res.status(500).json({
        error: 'Failed to verify comment'
      });
    }

    if (!comment) {
      return res.status(404).json({
        error: 'Comment not found'
      });
    }

    // Check if user is trying to flag their own comment
    if (comment.anonymous_id === anonymousId) {
      return res.status(403).json({
        error: 'You cannot flag your own comment'
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

    // Check if already flagged using queryWithRLS for RLS enforcement
    const checkResult = await queryWithRLS(
      anonymousId,
      `SELECT id FROM comment_flags 
       WHERE anonymous_id = $1 AND comment_id = $2`,
      [anonymousId, id]
    );

    if (checkResult.rows.length > 0) {
      return res.status(409).json({
        error: 'Comment already flagged by this user',
        message: 'You have already flagged this comment'
      });
    }

    // Create flag using queryWithRLS for RLS enforcement
    const insertResult = await queryWithRLS(
      anonymousId,
      `INSERT INTO comment_flags (anonymous_id, comment_id, reason)
       VALUES ($1, $2, $3)
       RETURNING id, anonymous_id, comment_id, reason, created_at`,
      [anonymousId, id, reason]
    );

    if (insertResult.rows.length === 0) {
      logError(new Error('Insert flag returned no rows'), req);
      return res.status(500).json({
        error: 'Failed to flag comment'
      });
    }

    const newFlag = insertResult.rows[0];

    logSuccess(`Comment ${id} flagged by ${anonymousId}`, req);

    res.status(201).json({
      success: true,
      data: {
        flagged: true,
        flag_id: newFlag.id
      },
      message: 'Comment flagged successfully'
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({
      error: 'Failed to flag comment'
    });
  }
});


/**
 * POST /api/comments/:id/pin
 * Pin a comment (Only by Report Owner)
 */
router.post('/:id/pin', requireAnonymousId, async (req, res) => {
  try {
    const { id } = req.params;
    const anonymousId = req.anonymousId;

    // 1. Get Comment & Report Info
    const { data: comment, error: commentError } = await supabase
      .from('comments')
      .select('id, report_id')
      .eq('id', id)
      .maybeSingle();

    if (commentError || !comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // 2. Verify Report Owner
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('anonymous_id')
      .eq('id', comment.report_id)
      .maybeSingle();

    if (reportError || !report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (report.anonymous_id !== anonymousId) {
      return res.status(403).json({ error: 'Only the report owner can pin comments' });
    }

    // 3. Pin the comment
    const pinResult = await queryWithRLS(
      anonymousId,
      `UPDATE comments SET is_pinned = true, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    // 4. Broadcast Realtime Update
    if (pinResult.rows.length > 0) {
      const clientId = req.headers['x-client-id'];
      realtimeEvents.emitCommentUpdate(comment.report_id, pinResult.rows[0], clientId);
    }

    res.json({ success: true, message: 'Comment pinned' });
  } catch (err) {
    logError(err, req);
    res.status(500).json({ error: 'Failed to pin comment' });
  }
});

/**
 * DELETE /api/comments/:id/pin
 * Unpin a comment
 */
router.delete('/:id/pin', requireAnonymousId, async (req, res) => {
  try {
    const { id } = req.params;
    const anonymousId = req.anonymousId;

    const { data: comment } = await supabase.from('comments').select('id, report_id').eq('id', id).maybeSingle();
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const { data: report } = await supabase.from('reports').select('anonymous_id').eq('id', comment.report_id).maybeSingle();
    if (report.anonymous_id !== anonymousId) {
      return res.status(403).json({ error: 'Only the report owner can unpin comments' });
    }

    const unpinResult = await queryWithRLS(anonymousId, `UPDATE comments SET is_pinned = false WHERE id = $1 RETURNING *`, [id]);

    // Broadcast Realtime Update
    if (unpinResult.rows.length > 0) {
      const clientId = req.headers['x-client-id'];
      realtimeEvents.emitCommentUpdate(report.id || comment.report_id, unpinResult.rows[0], clientId);
    }

    res.json({ success: true, message: 'Comment unpinned' });
  } catch (err) {
    logError(err, req);
    res.status(500).json({ error: 'Failed to unpin comment' });
  }
});

export default router;

