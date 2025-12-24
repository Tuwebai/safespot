import express from 'express';
import { requireAnonymousId, validateComment } from '../utils/validation.js';
import { logError, logSuccess } from '../utils/logger.js';
import { ensureAnonymousUser } from '../utils/anonymousUser.js';
import supabase from '../config/supabase.js';

const router = express.Router();

/**
 * GET /api/comments/:reportId
 * Get all comments for a report with likes information
 * Optional query param: anonymous_id to check if user liked each comment
 */
router.get('/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    const anonymousId = req.headers['x-anonymous-id'];
    
    // Get all comments for the report
    const { data: comments, error: commentsError } = await supabase
      .from('comments')
      .select('*')
      .eq('report_id', reportId)
      .order('created_at', { ascending: true });
    
    if (commentsError) {
      logError(commentsError, req);
      return res.status(500).json({
        error: 'Failed to fetch comments',
        message: commentsError.message
      });
    }

    if (!comments || comments.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0
      });
    }

    // If anonymous_id is provided, check which comments the user has liked
    let likedCommentIds = new Set();
    if (anonymousId) {
      const commentIds = comments.map(c => c.id);
      const { data: likes, error: likesError } = await supabase
        .from('comment_likes')
        .select('comment_id')
        .eq('anonymous_id', anonymousId)
        .in('comment_id', commentIds);
      
      if (!likesError && likes) {
        likedCommentIds = new Set(likes.map(l => l.comment_id));
      }
    }

    // Enrich comments with liked_by_me flag
    const enrichedComments = comments.map(comment => ({
      ...comment,
      liked_by_me: anonymousId ? likedCommentIds.has(comment.id) : false
    }));

    res.json({
      success: true,
      data: enrichedComments,
      count: enrichedComments.length
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
    
    // If parent_id is provided, verify it exists and belongs to the same report
    if (req.body.parent_id) {
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
      content: content
    };
    
    // Add parent_id if provided (for replies)
    if (req.body.parent_id) {
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

export default router;

