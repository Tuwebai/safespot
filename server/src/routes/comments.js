import express from 'express';
import { requireAnonymousId, validateComment, validateCommentUpdate, validateFlagReason } from '../utils/validation.js';
import { logError, logSuccess } from '../utils/logger.js';
import { ensureAnonymousUser } from '../utils/anonymousUser.js';
import { flagRateLimiter } from '../utils/rateLimiter.js';
import supabase from '../config/supabase.js';

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
        error: 'Failed to fetch comments',
        message: countError.message
      });
    }

    if (commentsError) {
      logError(commentsError, req);
      return res.status(500).json({
        error: 'Failed to fetch comments',
        message: commentsError.message
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

    // If anonymous_id is provided, check which comments the user has liked and flagged
    let likedCommentIds = new Set();
    let flaggedCommentIds = new Set();
    
    if (anonymousId) {
      const commentIds = comments.map(c => c.id);
      
      // Check likes
      const { data: likes, error: likesError } = await supabase
        .from('comment_likes')
        .select('comment_id')
        .eq('anonymous_id', anonymousId)
        .in('comment_id', commentIds);
      
      if (!likesError && likes) {
        likedCommentIds = new Set(likes.map(l => l.comment_id));
      }
      
      // Check flags
      const { data: flags, error: flagsError } = await supabase
        .from('comment_flags')
        .select('comment_id')
        .eq('anonymous_id', anonymousId)
        .in('comment_id', commentIds);
      
      if (!flagsError && flags) {
        flaggedCommentIds = new Set(flags.map(f => f.comment_id));
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
      error: 'Unexpected server error',
      message: err.message
    });
  }
});

/**
 * POST /api/comments
 * Create a new comment
 * Requires: X-Anonymous-Id header
 */
router.post('/', requireAnonymousId, async (req, res) => {
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
        error: 'Failed to ensure anonymous user',
        message: error.message
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
        error: 'Failed to verify report',
        message: reportError.message
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
          error: 'Failed to verify parent comment',
          message: parentError.message
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
    
    const insertData = {
      report_id: req.body.report_id,
      anonymous_id: anonymousId,
      content: content,
      is_thread: isThread || false
    };
    
    // Add parent_id if provided (for replies) - but not for threads
    if (hasParentId && !isThread) {
      insertData.parent_id = req.body.parent_id;
    }
    
    const { data, error: insertError } = await supabase
      .from('comments')
      .insert(insertData)
      .select()
      .single();
    
    if (insertError) {
      logError(insertError, req);
      return res.status(500).json({
        error: 'Failed to create comment',
        message: insertError.message
      });
    }
    
    res.status(201).json({
      success: true,
      data: data,
      message: 'Comment created successfully'
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
      error: 'Failed to create comment',
      message: error.message
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
    
    // Check if comment exists and belongs to user
    const { data: comment, error: checkError } = await supabase
      .from('comments')
      .select('id, anonymous_id, content')
      .eq('id', id)
      .eq('anonymous_id', anonymousId)
      .maybeSingle();
    
    if (checkError) {
      logError(checkError, req);
      return res.status(500).json({
        error: 'Failed to check comment',
        message: checkError.message
      });
    }
    
    if (!comment) {
      return res.status(404).json({
        error: 'Comment not found or you do not have permission to edit it'
      });
    }
    
    // Prepare content (preserve JSON structure if valid, otherwise trim)
    let content = req.body.content;
    try {
      JSON.parse(content);
      // Es JSON válido, no hacer trim
    } catch {
      // No es JSON, hacer trim
      content = content.trim();
    }
    
    // Update comment
    const { data: updatedComment, error: updateError } = await supabase
      .from('comments')
      .update({ 
        content: content,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('anonymous_id', anonymousId)
      .select()
      .single();
    
    if (updateError) {
      logError(updateError, req);
      return res.status(500).json({
        error: 'Failed to update comment',
        message: updateError.message
      });
    }
    
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
      error: 'Failed to update comment',
      message: error.message
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
    
    // Check if comment exists and belongs to user
    const { data: comment, error: checkError } = await supabase
      .from('comments')
      .select('anonymous_id')
      .eq('id', id)
      .eq('anonymous_id', anonymousId)
      .maybeSingle();
    
    if (checkError) {
      logError(checkError, req);
      return res.status(500).json({
        error: 'Failed to check comment',
        message: checkError.message
      });
    }
    
    if (!comment) {
      return res.status(404).json({
        error: 'Comment not found or you do not have permission to delete it'
      });
    }
    
    // Delete comment
    const { error: deleteError } = await supabase
      .from('comments')
      .delete()
      .eq('id', id)
      .eq('anonymous_id', anonymousId);
    
    if (deleteError) {
      logError(deleteError, req);
      return res.status(500).json({
        error: 'Failed to delete comment',
        message: deleteError.message
      });
    }
    
    res.json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({
      error: 'Failed to delete comment',
      message: error.message
    });
  }
});

/**
 * POST /api/comments/:id/like
 * Like a comment
 * Requires: X-Anonymous-Id header
 */
router.post('/:id/like', requireAnonymousId, async (req, res) => {
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
        error: 'Failed to verify comment',
        message: commentError.message
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
        error: 'Failed to ensure anonymous user',
        message: error.message
      });
    }
    
    // Try to insert like (will fail if already exists due to UNIQUE constraint)
    const { data: like, error: likeError } = await supabase
      .from('comment_likes')
      .insert({
        comment_id: id,
        anonymous_id: anonymousId
      })
      .select()
      .single();
    
    if (likeError) {
      // Check if it's a unique constraint violation (already liked)
      if (likeError.code === '23505' || likeError.message.includes('unique')) {
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
            upvotes_count: updatedComment?.upvotes_count || comment.upvotes_count
          },
          message: 'Comment already liked'
        });
      }
      
      logError(likeError, req);
      return res.status(500).json({
        error: 'Failed to like comment',
        message: likeError.message
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
        liked: true,
        upvotes_count: updatedComment?.upvotes_count || comment.upvotes_count + 1
      },
      message: 'Comment liked successfully'
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({
      error: 'Failed to like comment',
      message: error.message
    });
  }
});

/**
 * DELETE /api/comments/:id/like
 * Unlike a comment
 * Requires: X-Anonymous-Id header
 */
router.delete('/:id/like', requireAnonymousId, async (req, res) => {
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
        error: 'Failed to verify comment',
        message: commentError.message
      });
    }
    
    if (!comment) {
      return res.status(404).json({
        error: 'Comment not found'
      });
    }
    
    // Delete the like
    const { error: deleteError } = await supabase
      .from('comment_likes')
      .delete()
      .eq('comment_id', id)
      .eq('anonymous_id', anonymousId);
    
    if (deleteError) {
      logError(deleteError, req);
      return res.status(500).json({
        error: 'Failed to unlike comment',
        message: deleteError.message
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
      error: 'Failed to unlike comment',
      message: error.message
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
        error: 'Failed to verify comment',
        message: commentError.message
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
        error: 'Failed to ensure anonymous user',
        message: error.message
      });
    }
    
    // Check if already flagged
    const { data: existingFlag, error: checkError } = await supabase
      .from('comment_flags')
      .select('id')
      .eq('anonymous_id', anonymousId)
      .eq('comment_id', id)
      .maybeSingle();
    
    if (checkError) {
      logError(checkError, req);
      return res.status(500).json({
        error: 'Failed to check flag status',
        message: checkError.message
      });
    }
    
    if (existingFlag) {
      return res.status(409).json({
        error: 'Comment already flagged by this user',
        message: 'You have already flagged this comment'
      });
    }
    
    // Create flag
    const { data: newFlag, error: insertError } = await supabase
      .from('comment_flags')
      .insert({
        anonymous_id: anonymousId,
        comment_id: id,
        reason: reason
      })
      .select()
      .single();
    
    if (insertError) {
      logError(insertError, req);
      return res.status(500).json({
        error: 'Failed to flag comment',
        message: insertError.message
      });
    }
    
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
      error: 'Failed to flag comment',
      message: error.message
    });
  }
});

export default router;

