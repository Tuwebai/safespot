import express from 'express';
import crypto from 'crypto';
import { requireAnonymousId, validateFlagReason } from '../utils/validation.js';
import { validate } from '../utils/validateMiddleware.js';
import { commentSchema, commentUpdateSchema } from '../utils/schemas.js';
import { logError, logSuccess, logInfo } from '../utils/logger.js';
import { ensureAnonymousUser } from '../utils/anonymousUser.js';
import { likeLimiter, createCommentLimiter } from '../utils/rateLimiter.js';
import { syncGamification } from '../utils/gamificationCore.js';
import { queryWithRLS, transactionWithRLS } from '../utils/rls.js';
import { checkContentVisibility } from '../utils/trustScore.js';
import { sanitizeText, sanitizeCommentContent } from '../utils/sanitize.js';
import { NotificationService } from '../utils/appNotificationService.js';
import { realtimeEvents } from '../utils/eventEmitter.js';
import { extractMentions } from '../utils/mentions.js';
import { verifyUserStatus } from '../middleware/moderation.js';
import { isValidUuid } from '../utils/validation.js';
import { AppError, ValidationError, NotFoundError, ForbiddenError } from '../utils/AppError.js';
import { ErrorCodes } from '../utils/errorCodes.js';
import { executeUserAction } from '../utils/governance.js';
import { auditLog, AuditAction, ActorType } from '../services/auditService.js';

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
router.post('/', requireAnonymousId, verifyUserStatus, createCommentLimiter, validate(commentSchema), async (req, res, next) => {
  try {
    const anonymousId = req.anonymousId;
    let isHidden = false; // Shadow ban status
    let moderationAction = null;

    // Ensure anonymous user exists in anonymous_users table (idempotent)
    const isThread = req.body.is_thread === true;
    const hasParentId = req.body.parent_id !== undefined && req.body.parent_id !== null;

    try {
      await ensureAnonymousUser(anonymousId);
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
    const content = sanitizeCommentContent(req.body.content, sanitizeContext);

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
    // FIXED: Explicit column selection to match GET /comments contract exactly
    // Added: liked_by_me, is_flagged, is_highlighted (defaults)
    // ENTERPRISE FIX: Accept client-generated UUID for 0ms optimistic updates

    // 🔬 DIAGNOSTIC LOGS: Trace ID transmission wire
    // console.log('[CREATE COMMENT] 🔍 DIAGNOSTIC: req.body.id:', req.body.id);
    // console.log('[CREATE COMMENT] 🔍 DIAGNOSTIC: typeof req.body.id:', typeof req.body.id);
    // console.log('[CREATE COMMENT] 🔍 DIAGNOSTIC: isValidUuid result:', isValidUuid(req.body.id));

    // Ensure ID is valid if provided, otherwise let DB generate it
    const clientGeneratedId = isValidUuid(req.body.id) ? req.body.id : null;

    const insertQuery = `
      WITH inserted AS (
        INSERT INTO comments (id, report_id, anonymous_id, content, is_thread, parent_id, is_hidden)
        VALUES (COALESCE($1, uuid_generate_v4()), $2, $3, $4, $5, $6, $7)
        RETURNING *
      )
      SELECT 
        i.id, i.report_id, i.anonymous_id, i.content, i.upvotes_count, 
        i.created_at, i.updated_at, i.last_edited_at, i.parent_id, i.is_thread, i.is_pinned,
        u.avatar_url, u.alias,
        false as is_highlighted,
        false as liked_by_me,
        false as is_flagged,
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
      clientGeneratedId,     // $1 - Optimistic ID (if valid)
      req.body.report_id,    // $2
      anonymousId,           // $3
      content,               // $4 - Already sanitized above
      isThread || false,     // $5
      parentId,              // $6
      isHidden               // $7
    ];

    // Development mode: log params for debugging
    if (process.env.NODE_ENV === 'development') {
      // console.log('[CREATE COMMENT] Params:', insertParams);
    }

    // 4. EXECUTE MUTATION (Atomic Transaction)
    // ============================================
    const transactionStartTime = Date.now();
    // console.log(`[CREATE COMMENT] 🔵 TRANSACTION START: ${clientGeneratedId || 'DB-generated'} at ${new Date().toISOString()}`);

    const txResult = await transactionWithRLS(anonymousId, async (client, sse) => {
      // 4.a PRECHECKS dentro de la misma transacción/cliente
      const reportResult = await client.query(
        `SELECT id
         FROM reports
         WHERE id = $1 AND deleted_at IS NULL`,
        [req.body.report_id]
      );

      if (reportResult.rows.length === 0) {
        return { status: 'report_not_found' };
      }

      if (hasParentId) {
        const parentResult = await client.query(
          `SELECT id, report_id
           FROM comments
           WHERE id = $1 AND deleted_at IS NULL`,
          [req.body.parent_id]
        );

        if (parentResult.rows.length === 0) {
          return { status: 'parent_not_found' };
        }

        if (parentResult.rows[0].report_id !== req.body.report_id) {
          return { status: 'parent_mismatch' };
        }
      }

      // 4.b VISIBILIDAD dentro del mismo cliente/tx (sin driver drift)
      const trustResult = await client.query(
        `SELECT trust_score, moderation_status
         FROM anonymous_trust_scores
         WHERE anonymous_id = $1`,
        [anonymousId]
      );

      const trustScore = trustResult.rows[0]?.trust_score;
      const trustStatus = trustResult.rows[0]?.moderation_status;
      const computedIsHidden =
        trustStatus === 'shadow_banned' ||
        trustStatus === 'banned' ||
        (trustScore !== undefined && trustScore !== null && Number(trustScore) < 30);
      const computedModerationAction =
        trustStatus === 'shadow_banned' || trustStatus === 'banned'
          ? 'shadow_ban_status'
          : (trustScore !== undefined && trustScore !== null && Number(trustScore) < 30)
            ? 'shadow_ban_low_score'
            : null;

      // a. Insert Comment
      const transactionalInsertParams = [...insertParams];
      transactionalInsertParams[6] = computedIsHidden;
      const insertResult = await client.query(insertQuery, transactionalInsertParams);
      if (insertResult.rows.length === 0) {
        throw new AppError('Insert operation returned no data', 500, ErrorCodes.INSERT_FAILED);
      }
      const comment = insertResult.rows[0];

      // b. Update Report Counter (Atomic Persistence)
      // REMOVED: Duplicated logic. Trigger `trigger_update_report_comments` handles this.
      // See Audit: Step 631
      // await client.query(
      //   `UPDATE reports SET comments_count = comments_count + 1 WHERE id = $1`,
      //   [req.body.report_id]
      // );

      // c. Queue Realtime Events (SSE)
      // These will ONLY flush if transaction COMMITs
      const clientId = req.headers['x-client-id'];
      sse.emit('emitNewComment', req.body.report_id, comment, clientId);

      return {
        status: 'created',
        comment,
        isHidden: computedIsHidden,
        moderationAction: computedModerationAction
      };
    });

    if (txResult.status === 'report_not_found') {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (txResult.status === 'parent_not_found') {
      return res.status(404).json({ error: 'Parent comment not found' });
    }

    if (txResult.status === 'parent_mismatch') {
      return res.status(400).json({ error: 'Parent comment must belong to the same report' });
    }

    const data = txResult.comment;
    isHidden = txResult.isHidden;
    moderationAction = txResult.moderationAction;

    const transactionDuration = Date.now() - transactionStartTime;
    logSuccess(`Comment created: ${data.id}`, { transactionDuration });
    if (isHidden) {
      logSuccess('Shadow ban applied to comment', { anonymousId, action: moderationAction });
    }

    // 5. SIDE EFFECTS (Post-Commit)PROCESSING (Non-blocking)
    // ============================================
    let mentionedIds = [];
    try {
      // Trigger gamification sync asynchronously (non-blocking)
      syncGamification(anonymousId).catch(err => {
        logError(err, { context: 'syncGamification.comment', anonymousId });
      });

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
      mentionedIds = extractMentions(req.body.content);
      if (mentionedIds.length > 0) {
        mentionedIds.forEach(targetId => {
          if (targetId !== anonymousId) {
            NotificationService.notifyMention(targetId, data.id, anonymousId, req.body.report_id).catch(err => {
              logError(err, { context: 'notifyMention', targetId });
            });
          }
        });
      }
    } catch (err) {
      // Ignore notification errors
    }

    // AUDIT LOG
    auditLog({
      action: isThread ? AuditAction.COMMENT_CREATE : AuditAction.COMMENT_CREATE,
      actorType: ActorType.ANONYMOUS,
      actorId: anonymousId,
      req,
      targetType: 'comment',
      targetId: data.id,
      newValues: {
        content: data.content?.substring(0, 100),
        reportId: req.body.report_id,
        parentId: parentId || null,
        isThread
      },
      metadata: { isHidden, hasMentions: mentionedIds?.length > 0 },
      success: true
    }).catch(() => { });

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
router.patch('/:id', requireAnonymousId, validate(commentUpdateSchema), async (req, res, next) => {
  const patchStartTime = Date.now();
  const { id } = req.params;
  // console.log(`[PATCH COMMENT] PATCH RECEIVED: ${id} at ${new Date().toISOString()}`);

  try {
    const anonymousId = req.anonymousId;
    const content = req.body.content;
    const clientId = req.headers['x-client-id'];

    const txResult = await transactionWithRLS(anonymousId, async (client, sse) => {
      const checkResult = await client.query(
        `SELECT id, anonymous_id
         FROM comments
         WHERE id = $1 AND deleted_at IS NULL`,
        [id]
      );

      if (checkResult.rows.length === 0) {
        return { status: 'not_found' };
      }

      if (checkResult.rows[0].anonymous_id !== anonymousId) {
        return {
          status: 'forbidden',
          ownerId: checkResult.rows[0].anonymous_id
        };
      }

      const updateResult = await client.query(
        `WITH updated AS (
           UPDATE comments
           SET content = $1, last_edited_at = NOW()
           WHERE id = $2 AND anonymous_id = $3
           RETURNING *
         )
         SELECT
           c.id, c.report_id, c.anonymous_id, c.content, c.upvotes_count,
           c.created_at, c.updated_at, c.last_edited_at, c.parent_id, c.is_thread, c.is_pinned,
           u.alias,
           u.avatar_url
         FROM updated c
         LEFT JOIN anonymous_users u ON c.anonymous_id = u.anonymous_id`,
        [content, id, anonymousId]
      );

      const updatedComment = updateResult.rows[0];
      sse.emit('emitCommentUpdate', updatedComment.report_id, updatedComment, clientId);

      return {
        status: 'ok',
        updatedComment
      };
    });

    if (txResult.status === 'not_found') {
      logInfo('Comment PATCH failed: Not Found', { commentId: id, actorId: anonymousId });
      throw new NotFoundError('Comment not found');
    }

    if (txResult.status === 'forbidden') {
      logInfo('Comment PATCH failed: Forbidden (Ownership Mismatch)', {
        commentId: id,
        actorId: anonymousId,
        ownerId: txResult.ownerId
      });
      throw new ForbiddenError('You do not have permission to edit this comment');
    }

    const updatedComment = txResult.updatedComment;

    const patchDuration = Date.now() - patchStartTime;
    logSuccess(`Comment patched: ${id}`, { patchDuration });

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
router.delete('/:id', requireAnonymousId, async (req, res, next) => {
  try {
    const { id } = req.params;
    const anonymousId = req.anonymousId;

    // [M12 REFINEMENT] Use executeUserAction for Willpower Audit + Mutation
    const result = await executeUserAction({
      actorId: anonymousId,
      targetType: 'comment',
      targetId: id,
      actionType: 'USER_DELETE_SELF_COMMENT',
      updateQuery: `UPDATE comments SET deleted_at = NOW() WHERE id = $1 AND anonymous_id = $2 AND deleted_at IS NULL`,
      updateParams: [id, anonymousId]
    });

    const currentItem = result.snapshot;
    const reportId = currentItem.report_id;

    // REALTIME: Broadcast deletion
    try {
      const clientId = req.headers['x-client-id'];
      const eventId = crypto.randomUUID(); // Single ID for all broadcasts related to this action

      realtimeEvents.emitCommentDelete(reportId, id, clientId, eventId);

    } catch (err) {
      logError(err, { context: 'realtimeEvents.emitCommentDelete', reportId });
    }

    // CRITICAL Manual decrement removed - Handled by DB Trigger
    /*
    if (reportId) {
      try {
        await pool.query(
          `UPDATE reports SET comments_count = GREATEST(0, comments_count - 1) WHERE id = $1`,
          [reportId]
        );
      } catch (err) {
        console.error('[DELETE_COMMENT] Failed to decrement report count:', err);
      }
    }
    */

    // AUDIT LOG
    auditLog({
      action: AuditAction.COMMENT_DELETE,
      actorType: ActorType.ANONYMOUS,
      actorId: anonymousId,
      req,
      targetType: 'comment',
      targetId: id,
      oldValues: {
        content: currentItem.content?.substring(0, 100),
        reportId: currentItem.report_id
      },
      success: true
    }).catch(() => { });

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
    const clientId = req.headers['x-client-id'];

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

    // Write + readback unificados en una sola transacción RLS.
    let txResult;
    try {
      txResult = await transactionWithRLS(anonymousId, async (client, sse) => {
        const commentResult = await client.query(
          `SELECT id, upvotes_count, report_id
           FROM comments
           WHERE id = $1 AND deleted_at IS NULL`,
          [id]
        );

        if (commentResult.rows.length === 0) {
          return { notFound: true };
        }

        const comment = commentResult.rows[0];

        try {
          await client.query(
            `INSERT INTO votes (target_type, target_id, anonymous_id, is_hidden)
             VALUES ('comment', $1, $2, $3)
             RETURNING id`,
            [id, anonymousId, isHidden]
          );
        } catch (likeError) {
          if (likeError.code === '23505' || likeError.message?.includes('unique')) {
            const readback = await client.query(
              'SELECT upvotes_count FROM comments WHERE id = $1',
              [id]
            );
            return {
              notFound: false,
              alreadyLiked: true,
              upvotes_count: readback.rows[0]?.upvotes_count ?? comment.upvotes_count
            };
          }
          throw likeError;
        }

        const readback = await client.query(
          'SELECT upvotes_count FROM comments WHERE id = $1',
          [id]
        );
        const finalCount = readback.rows[0]?.upvotes_count ?? (comment.upvotes_count + 1);

        // SSE solo post-commit (cola transaccional).
        sse.emit('emitCommentLike', comment.report_id, id, 1, clientId);
        sse.emit('emitVoteUpdate', 'comment', id, { upvotes_count: finalCount }, clientId, comment.report_id);

        return {
          notFound: false,
          alreadyLiked: false,
          report_id: comment.report_id,
          upvotes_count: finalCount
        };
      });
    } catch (likeError) {
      logError(likeError, req);
      return res.status(500).json({
        error: 'Failed to like comment'
      });
    }

    if (txResult.notFound) {
      return res.status(404).json({
        error: 'Comment not found'
      });
    }

    if (txResult.alreadyLiked) {
      return res.json({
        success: true,
        data: {
          liked: true,
          upvotes_count: txResult.upvotes_count,
          newBadges: []
        },
        message: 'Comment already liked'
      });
    }

    // Efectos no transaccionales solo después de commit.
    let newBadges = [];
    try {
      const gamification = await syncGamification(anonymousId);
      if (gamification && gamification.profile && gamification.profile.newlyAwarded) {
        newBadges = gamification.profile.newlyAwarded;
      }
    } catch (err) {
      logError(err, req);
    }

    NotificationService.notifyLike('comment', id, anonymousId).catch(err => {
      logError(err, { context: 'notifyLike.comment', commentId: id });
    });

    return res.json({
      success: true,
      data: {
        liked: true,
        upvotes_count: txResult.upvotes_count,
        newBadges
      },
      message: 'Comment liked successfully'
    });
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
    const clientId = req.headers['x-client-id'];

    const txResult = await transactionWithRLS(anonymousId, async (client, sse) => {
      const commentResult = await client.query(
        `SELECT id, upvotes_count, report_id
         FROM comments
         WHERE id = $1 AND deleted_at IS NULL`,
        [id]
      );

      if (commentResult.rows.length === 0) {
        return { notFound: true };
      }

      const comment = commentResult.rows[0];

      const deleteResult = await client.query(
        `DELETE FROM votes
         WHERE target_type = 'comment' AND target_id = $1 AND anonymous_id = $2`,
        [id, anonymousId]
      );

      const readback = await client.query(
        'SELECT upvotes_count FROM comments WHERE id = $1',
        [id]
      );
      const finalCount = readback.rows[0]?.upvotes_count ?? Math.max(0, comment.upvotes_count - 1);

      if (deleteResult.rowCount === 0) {
        return {
          notFound: false,
          notLiked: true,
          upvotes_count: finalCount
        };
      }

      // SSE solo post-commit.
      sse.emit('emitCommentLike', comment.report_id, id, -1, clientId);
      sse.emit('emitVoteUpdate', 'comment', id, { upvotes_count: finalCount }, clientId, comment.report_id);

      return {
        notFound: false,
        notLiked: false,
        upvotes_count: finalCount
      };
    });

    if (txResult.notFound) {
      return res.status(404).json({
        error: 'Comment not found'
      });
    }

    if (txResult.notLiked) {
      return res.json({
        success: true,
        data: {
          liked: false,
          upvotes_count: txResult.upvotes_count
        },
        message: 'Like not found'
      });
    }

    res.json({
      success: true,
      data: {
        liked: false,
        upvotes_count: txResult.upvotes_count
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

    // Ensure anonymous user exists
    try {
      await ensureAnonymousUser(anonymousId);
    } catch (error) {
      logError(error, req);
      return res.status(500).json({
        error: 'Failed to ensure anonymous user'
      });
    }

    const flagComment = req.body.comment ? sanitizeText(req.body.comment, 'flag_comment', { anonymousId }) : null;

    const txResult = await transactionWithRLS(anonymousId, async (client) => {
      const commentResult = await client.query(
        `SELECT id, anonymous_id
         FROM comments
         WHERE id = $1 AND deleted_at IS NULL`,
        [id]
      );

      if (commentResult.rows.length === 0) {
        return { status: 'not_found' };
      }

      const comment = commentResult.rows[0];
      if (comment.anonymous_id === anonymousId) {
        return { status: 'own_comment' };
      }

      const checkResult = await client.query(
        `SELECT id FROM comment_flags
         WHERE anonymous_id = $1 AND comment_id = $2`,
        [anonymousId, id]
      );

      if (checkResult.rows.length > 0) {
        return { status: 'already_flagged' };
      }

      const insertResult = await client.query(
        `INSERT INTO comment_flags (anonymous_id, comment_id, reason, comment)
         VALUES ($1, $2, $3, $4)
         RETURNING id, anonymous_id, comment_id, reason, created_at`,
        [anonymousId, id, reason, flagComment]
      );

      if (insertResult.rows.length === 0) {
        throw new Error('Insert flag returned no rows');
      }

      return {
        status: 'created',
        newFlag: insertResult.rows[0],
        commentOwnerId: comment.anonymous_id
      };
    });

    if (txResult.status === 'not_found') {
      return res.status(404).json({
        error: 'Comment not found'
      });
    }

    if (txResult.status === 'own_comment') {
      return res.status(403).json({
        error: 'You cannot flag your own comment'
      });
    }

    if (txResult.status === 'already_flagged') {
      return res.status(409).json({
        error: 'Comment already flagged by this user',
        message: 'You have already flagged this comment'
      });
    }

    const newFlag = txResult.newFlag;

    logSuccess(`Comment ${id} flagged by ${anonymousId}`, req);

    // AUDIT LOG post-commit
    auditLog({
      action: AuditAction.COMMENT_FLAG,
      actorType: ActorType.ANONYMOUS,
      actorId: anonymousId,
      req,
      targetType: 'comment',
      targetId: id,
      targetOwnerId: txResult.commentOwnerId,
      metadata: { reason, flagId: newFlag.id },
      success: true
    }).catch(() => { });

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
    const clientId = req.headers['x-client-id'];

    const txResult = await transactionWithRLS(anonymousId, async (client, sse) => {
      const commentResult = await client.query(
        `SELECT id, report_id
         FROM comments
         WHERE id = $1 AND deleted_at IS NULL`,
        [id]
      );

      if (commentResult.rows.length === 0) {
        return { status: 'comment_not_found' };
      }

      const comment = commentResult.rows[0];

      const reportResult = await client.query(
        `SELECT id, anonymous_id
         FROM reports
         WHERE id = $1 AND deleted_at IS NULL`,
        [comment.report_id]
      );

      if (reportResult.rows.length === 0) {
        return { status: 'report_not_found' };
      }

      const report = reportResult.rows[0];

      if (report.anonymous_id !== anonymousId) {
        return { status: 'forbidden' };
      }

      const pinResult = await client.query(
        `UPDATE comments
         SET is_pinned = true, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id]
      );

      if (pinResult.rows.length === 0) {
        return { status: 'comment_not_found' };
      }

      // Emitir sólo post-commit
      sse.emit('emitCommentUpdate', comment.report_id, pinResult.rows[0], clientId);

      return { status: 'ok' };
    });

    if (txResult.status === 'comment_not_found') {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (txResult.status === 'report_not_found') {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (txResult.status === 'forbidden') {
      return res.status(403).json({ error: 'Only the report owner can pin comments' });
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
    const clientId = req.headers['x-client-id'];

    const txResult = await transactionWithRLS(anonymousId, async (client, sse) => {
      const commentResult = await client.query(
        `SELECT id, report_id
         FROM comments
         WHERE id = $1 AND deleted_at IS NULL`,
        [id]
      );

      if (commentResult.rows.length === 0) {
        return { status: 'comment_not_found' };
      }

      const comment = commentResult.rows[0];

      const reportResult = await client.query(
        `SELECT id, anonymous_id
         FROM reports
         WHERE id = $1 AND deleted_at IS NULL`,
        [comment.report_id]
      );

      if (reportResult.rows.length === 0) {
        return { status: 'report_not_found' };
      }

      const report = reportResult.rows[0];

      if (report.anonymous_id !== anonymousId) {
        return { status: 'forbidden' };
      }

      const unpinResult = await client.query(
        `UPDATE comments
         SET is_pinned = false
         WHERE id = $1
         RETURNING *`,
        [id]
      );

      if (unpinResult.rows.length > 0) {
        // Emitir sólo post-commit
        sse.emit('emitCommentUpdate', comment.report_id, unpinResult.rows[0], clientId);
      }

      return { status: 'ok' };
    });

    if (txResult.status === 'comment_not_found') {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (txResult.status === 'report_not_found') {
      return res.status(404).json({ error: 'Report not found' });
    }

    if (txResult.status === 'forbidden') {
      return res.status(403).json({ error: 'Only the report owner can unpin comments' });
    }

    res.json({ success: true, message: 'Comment unpinned' });
  } catch (err) {
    logError(err, req);
    res.status(500).json({ error: 'Failed to unpin comment' });
  }
});

export default router;

