import express from 'express';
import { requireAnonymousId, validateComment, validateCommentUpdate, validateFlagReason } from '../utils/validation.js';
import { logError, logSuccess } from '../utils/logger.js';
import { ensureAnonymousUser } from '../utils/anonymousUser.js';
import { flagRateLimiter, createCommentLimiter, likeLimiter } from '../utils/rateLimiter.js';
import { syncGamification } from '../utils/gamificationCore.js';
import { queryWithRLS } from '../utils/rls.js';
import { checkContentVisibility } from '../utils/trustScore.js';
import supabase from '../config/supabase.js';
import { sanitizeContent, sanitizeText } from '../utils/sanitize.js';

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

    // Parse pagination parameters with defaults and validation
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20)); // Max 50, default 20
    const offset = (pageNum - 1) * limitNum;

    // Build base query for counting total comments (without pagination)
    const countQuery = supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('report_id', reportId);

    // Build query for fetching comments (with pagination)
    let dataQuery = supabase
      .from('comments')
      .select('*')
      .eq('report_id', reportId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limitNum - 1);

    // Execute both queries in parallel
    const [{ count: totalItems, error: countError }, { data: comments, error: commentsError }] = await Promise.all([
      countQuery,
      dataQuery
    ]);

    if (countError) {
      logError(countError, req);
      return res.status(500).json({
        error: 'Failed to fetch comments'
      });
    }

    if (commentsError) {
      logError(commentsError, req);
      return res.status(500).json({
        error: 'Failed to fetch comments'
      });
    }

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
    logError(err, req);
    res.status(500).json({
      error: 'Unexpected server error'
    });
  }
});

/**
 * POST /api/comments
 * Create a new comment
 * Requires: X-Anonymous-Id header
 */
router.post('/', createCommentLimiter, requireAnonymousId, async (req, res) => {
  try {
    const anonymousId = req.anonymousId;

    // Validate request body
    validateComment(req.body);

    // Ensure anonymous user exists in anonymous_users table (idempotent)
    try {
      await ensureAnonymousUser(anonymousId);
    } catch (error) {
      logError(error, req);
      return res.status(500).json({
        error: 'Failed to ensure anonymous user'
      });
    }

    // Verify report exists using Supabase
    const { data: reportCheck, error: reportError } = await supabase
      .from('reports')
      .select('id')
      .eq('id', req.body.report_id)
      .maybeSingle();

    if (reportError) {
      logError(reportError, req);
      return res.status(500).json({
        error: 'Failed to verify report'
      });
    }

    if (!reportCheck) {
      logError(new Error('Report not found'), req);
      return res.status(404).json({
        error: 'Report not found'
      });
    }

    // Validate thread rules: if is_thread is true, parent_id must be null
    const isThread = req.body.is_thread === true;
    const hasParentId = req.body.parent_id !== undefined && req.body.parent_id !== null;

    if (isThread && hasParentId) {
      return res.status(400).json({
        error: 'Threads cannot have a parent_id (threads must be top-level)'
      });
    }

    // If parent_id is provided, verify it exists and belongs to the same report
    if (hasParentId) {
      const { data: parentComment, error: parentError } = await supabase
        .from('comments')
        .select('id, report_id')
        .eq('id', req.body.parent_id)
        .maybeSingle();

      if (parentError) {
        logError(parentError, req);
        return res.status(500).json({
          error: 'Failed to verify parent comment'
        });
      }

      if (!parentComment) {
        return res.status(404).json({
          error: 'Parent comment not found'
        });
      }

      if (parentComment.report_id !== req.body.report_id) {
        return res.status(400).json({
          error: 'Parent comment must belong to the same report'
        });
      }
    }

    // Insert comment using Supabase client
    // Si el contenido es JSON válido, no hacer trim (preservar estructura)
    let content = req.body.content
    try {
      JSON.parse(content)
      // Es JSON válido, no hacer trim
    } catch {
      // No es JSON, hacer trim como antes (compatibilidad con contenido legacy)
      content = content.trim()
    }

    // Context for logging suspicious content
    const sanitizeContext = { anonymousId, ip: req.ip };

    // SECURITY: Sanitize content BEFORE database insert
    // This handles both plain text and JSON-structured comments
    content = sanitizeContent(content, 'comment.content', sanitizeContext);

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

    // ... other imports

    // CRITICAL: Normalize parent_id - must be explicit null, never undefined
    const parentId = (hasParentId && !isThread) ? req.body.parent_id : null;

    // NEW: Check Trust Score & Shadow Ban Status
    let isHidden = false;
    try {
      const visibility = await checkContentVisibility(anonymousId);
      if (visibility.isHidden) {
        isHidden = true;
        logSuccess('Shadow ban applied to comment', { anonymousId, action: visibility.moderationAction });
      }
    } catch (checkError) {
      logError(checkError, req);
      // Fail open
    }

    // Insert comment using queryWithRLS for RLS enforcement
    const insertQuery = `
      INSERT INTO comments (report_id, anonymous_id, content, is_thread, parent_id, is_hidden)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, report_id, anonymous_id, content, upvotes_count, created_at, updated_at, parent_id, is_thread
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

    res.status(201).json({
      success: true,
      data: {
        ...data,
        newBadges
      },
      message: 'Comment created successfully'
    });
  } catch (error) {
    logError(error, req);

    // Log SQL error details for debugging (PostgreSQL error codes)
    if (error.code) {
      console.error('[SQL Error] Code:', error.code);
      console.error('[SQL Error] Detail:', error.detail);
      console.error('[SQL Error] Hint:', error.hint);
      console.error('[SQL Error] Column:', error.column);
    }

    if (error.message.startsWith('VALIDATION_ERROR')) {
      return res.status(400).json({
        error: 'Validation failed',
        message: error.message
      });
    }

    // Return more specific error in development mode
    res.status(500).json({
      error: 'Failed to create comment',
      ...(process.env.NODE_ENV === 'development' && {
        details: error.message,
        code: error.code,
        hint: error.hint
      })
    });
  }
});

/**
 * PATCH /api/comments/:id
 * Update a comment (only by creator)
 * Requires: X-Anonymous-Id header
 * Body: { content: string }
 */
router.patch('/:id', requireAnonymousId, async (req, res) => {
  try {
    const { id } = req.params;
    const anonymousId = req.anonymousId;

    // Validate request body
    try {
      validateCommentUpdate(req.body);
    } catch (error) {
      if (error.message.startsWith('VALIDATION_ERROR')) {
        return res.status(400).json({
          error: 'Validation failed',
          message: error.message
        });
      }
      throw error;
    }

    // Check if comment exists and belongs to user using queryWithRLS
    const checkResult = await queryWithRLS(
      anonymousId,
      `SELECT id, anonymous_id, content FROM comments 
       WHERE id = $1 AND anonymous_id = $2`,
      [id, anonymousId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Comment not found or you do not have permission to edit it'
      });
    }

    const comment = checkResult.rows[0];

    // Prepare content (preserve JSON structure if valid, otherwise trim)
    let content = req.body.content;
    try {
      JSON.parse(content);
      // Es JSON válido, no hacer trim
    } catch {
      // No es JSON, hacer trim
      content = content.trim();
    }

    // Context for logging suspicious content
    const sanitizeContext = { anonymousId, ip: req.ip };

    // SECURITY: Sanitize content BEFORE database update
    content = sanitizeContent(content, 'comment.content', sanitizeContext);

    // Update comment using queryWithRLS for RLS enforcement
    const updateQuery = `
      UPDATE comments 
      SET content = $1, updated_at = $2 
      WHERE id = $3 AND anonymous_id = $4
      RETURNING id, report_id, anonymous_id, content, upvotes_count, created_at, updated_at, parent_id, is_thread
    `;

    const updateResult = await queryWithRLS(
      anonymousId,
      updateQuery,
      [content, new Date().toISOString(), id, anonymousId]  // content is sanitized
    );

    if (updateResult.rows.length === 0) {
      logError(new Error('Update returned no rows'), req);
      return res.status(500).json({
        error: 'Failed to update comment'
      });
    }

    const updatedComment = updateResult.rows[0];

    logSuccess(`Comment ${id} updated by ${anonymousId}`, req);

    res.json({
      success: true,
      data: updatedComment,
      message: 'Comment updated successfully'
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
      error: 'Failed to update comment'
    });
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
      return res.status(404).json({
        error: 'Comment not found or you do not have permission to delete it'
      });
    }

    // Delete comment using queryWithRLS for RLS enforcement
    const deleteResult = await queryWithRLS(
      anonymousId,
      `DELETE FROM comments WHERE id = $1 AND anonymous_id = $2`,
      [id, anonymousId]
    );

    if (deleteResult.rowCount === 0) {
      logError(new Error('Delete returned no rows'), req);
      return res.status(500).json({
        error: 'Failed to delete comment'
      });
    }

    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({
      error: 'Failed to delete comment'
    });
  }
});

/**
 * POST /api/comments/:id/like
 * Like a comment
 * Requires: X-Anonymous-Id header
 * Rate limited: 30 per minute, 200 per hour
 */
router.post('/:id/like', likeLimiter, requireAnonymousId, async (req, res) => {
  try {
    const { id } = req.params;
    const anonymousId = req.anonymousId;

    // Verify comment exists
    const { data: comment, error: commentError } = await supabase
      .from('comments')
      .select('id, upvotes_count')
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
router.delete('/:id/like', likeLimiter, requireAnonymousId, async (req, res) => {
  try {
    const { id } = req.params;
    const anonymousId = req.anonymousId;

    // Verify comment exists
    const { data: comment, error: commentError } = await supabase
      .from('comments')
      .select('id, upvotes_count')
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

    res.json({
      success: true,
      data: {
        liked: false,
        upvotes_count: updatedComment?.upvotes_count || Math.max(0, comment.upvotes_count - 1)
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

export default router;

