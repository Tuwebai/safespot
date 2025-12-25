import express from 'express';
import { requireAnonymousId } from '../utils/validation.js';
import { logError, logSuccess } from '../utils/logger.js';
import { ensureAnonymousUser } from '../utils/anonymousUser.js';
import { evaluateBadges } from '../utils/badgeEvaluation.js';
import { validate as uuidValidate } from 'uuid';
import supabase from '../config/supabase.js';

const router = express.Router();

/**
 * POST /api/votes
 * Create a vote (upvote) on a report or comment
 * Requires: X-Anonymous-Id header
 * Body: { report_id: UUID } OR { comment_id: UUID }
 */
router.post('/', requireAnonymousId, async (req, res) => {
  try {
    const anonymousId = req.anonymousId;
    const { report_id, comment_id } = req.body;
    
    logSuccess('Creating vote', { anonymousId, reportId: report_id, commentId: comment_id });
    
    // Validate that exactly one target is provided
    if (!report_id && !comment_id) {
      return res.status(400).json({
        error: 'Either report_id or comment_id is required'
      });
    }
    
    if (report_id && comment_id) {
      return res.status(400).json({
        error: 'Cannot vote on both report and comment at the same time'
      });
    }
    
    // Validate UUID format
    if (report_id && !uuidValidate(report_id)) {
      return res.status(400).json({
        error: 'report_id must be a valid UUID'
      });
    }
    
    if (comment_id && !uuidValidate(comment_id)) {
      return res.status(400).json({
        error: 'comment_id must be a valid UUID'
      });
    }
    
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
    
    // Verify target exists using Supabase
    if (report_id) {
      logSuccess('Verifying report exists', { reportId: report_id });
      const { data: reportCheck, error: reportError } = await supabase
        .from('reports')
        .select('id')
        .eq('id', report_id)
        .maybeSingle();
      
      if (reportError) {
        logError(reportError, req);
        return res.status(500).json({
          error: 'Failed to verify report',
          message: reportError.message
        });
      }
      
      if (!reportCheck) {
        return res.status(404).json({
          error: 'Report not found'
        });
      }
    }
    
    if (comment_id) {
      logSuccess('Verifying comment exists', { commentId: comment_id });
      const { data: commentCheck, error: commentError } = await supabase
        .from('comments')
        .select('id')
        .eq('id', comment_id)
        .maybeSingle();
      
      if (commentError) {
        logError(commentError, req);
        return res.status(500).json({
          error: 'Failed to verify comment',
          message: commentError.message
        });
      }
      
      if (!commentCheck) {
        return res.status(404).json({
          error: 'Comment not found'
        });
      }
    }
    
    // Check if vote already exists (prevent duplicates)
    logSuccess('Checking for existing vote', { anonymousId });
    let existingVoteQuery = supabase
      .from('votes')
      .select('id')
      .eq('anonymous_id', anonymousId);
    
    if (report_id) {
      existingVoteQuery = existingVoteQuery.eq('report_id', report_id).is('comment_id', null);
    } else {
      existingVoteQuery = existingVoteQuery.eq('comment_id', comment_id).is('report_id', null);
    }
    
    const { data: existingVote, error: checkError } = await existingVoteQuery.maybeSingle();
    
    if (checkError) {
      logError(checkError, req);
      return res.status(500).json({
        error: 'Failed to check for existing vote',
        message: checkError.message
      });
    }
    
    if (existingVote) {
      logSuccess('Duplicate vote prevented', { anonymousId });
      return res.status(409).json({
        error: 'You have already voted on this item',
        code: 'DUPLICATE_VOTE'
      });
    }
    
    // Insert vote using Supabase client
    logSuccess('Inserting vote', { anonymousId });
    const { data, error: insertError } = await supabase
      .from('votes')
      .insert({
        anonymous_id: anonymousId,
        report_id: report_id || null,
        comment_id: comment_id || null
      })
      .select()
      .single();
    
    if (insertError) {
      // Handle unique constraint violation (duplicate vote)
      if (insertError.code === '23505') {
        return res.status(409).json({
          error: 'You have already voted on this item',
          code: 'DUPLICATE_VOTE'
        });
      }
      
      logError(insertError, req);
      return res.status(500).json({
        error: 'Failed to create vote',
        message: insertError.message
      });
    }
    
    logSuccess('Vote created', { 
      id: data.id,
      anonymousId,
      target: report_id || comment_id
    });
    
    // Evaluate badges for the user who received the like (not the voter)
    // Get the owner of the report/comment that received the vote
    if (report_id) {
      const { data: report } = await supabase
        .from('reports')
        .select('anonymous_id')
        .eq('id', report_id)
        .single();
      
      if (report && report.anonymous_id) {
        evaluateBadges(report.anonymous_id).catch(err => {
          logError(err, req);
        });
      }
    } else if (comment_id) {
      const { data: comment } = await supabase
        .from('comments')
        .select('anonymous_id')
        .eq('id', comment_id)
        .single();
      
      if (comment && comment.anonymous_id) {
        evaluateBadges(comment.anonymous_id).catch(err => {
          logError(err, req);
        });
      }
    }
    
    res.status(201).json({
      success: true,
      data: data,
      message: 'Vote created successfully'
    });
  } catch (error) {
    logError(error, req);
    
    // Handle unique constraint violation (duplicate vote)
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'You have already voted on this item',
        code: 'DUPLICATE_VOTE'
      });
    }
    
    res.status(500).json({
      error: 'Failed to create vote',
      message: error.message
    });
  }
});

/**
 * DELETE /api/votes
 * Remove a vote (unvote) from a report or comment
 * Requires: X-Anonymous-Id header
 * Body: { report_id: UUID } OR { comment_id: UUID }
 */
router.delete('/', requireAnonymousId, async (req, res) => {
  try {
    const anonymousId = req.anonymousId;
    const { report_id, comment_id } = req.body;
    
    if (!report_id && !comment_id) {
      return res.status(400).json({
        error: 'Either report_id or comment_id is required'
      });
    }
    
    // Find and delete vote
    let deleteQuery = supabase
      .from('votes')
      .delete()
      .eq('anonymous_id', anonymousId)
      .select();
    
    if (report_id) {
      deleteQuery = deleteQuery.eq('report_id', report_id).is('comment_id', null);
    } else {
      deleteQuery = deleteQuery.eq('comment_id', comment_id).is('report_id', null);
    }
    
    const { data, error: deleteError } = await deleteQuery;
    
    if (deleteError) {
      logError(deleteError, req);
      return res.status(500).json({
        error: 'Failed to remove vote',
        message: deleteError.message
      });
    }
    
    if (!data || data.length === 0) {
      return res.status(404).json({
        error: 'Vote not found'
      });
    }
    
    logSuccess('Vote removed', { 
      anonymousId,
      target: report_id || comment_id
    });
    
    res.json({
      success: true,
      message: 'Vote removed successfully'
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({
      error: 'Failed to remove vote',
      message: error.message
    });
  }
});

/**
 * GET /api/votes/check
 * Check if user has voted on a report or comment
 * Requires: X-Anonymous-Id header
 * Query: ?report_id=UUID or ?comment_id=UUID
 */
router.get('/check', requireAnonymousId, async (req, res) => {
  try {
    const anonymousId = req.anonymousId;
    const { report_id, comment_id } = req.query;
    
    if (!report_id && !comment_id) {
      return res.status(400).json({
        error: 'Either report_id or comment_id is required'
      });
    }
    
    let query = supabase
      .from('votes')
      .select('id')
      .eq('anonymous_id', anonymousId);
    
    if (report_id) {
      query = query.eq('report_id', report_id);
    }
    
    if (comment_id) {
      query = query.eq('comment_id', comment_id);
    }
    
    const { data, error } = await query.maybeSingle();
    
    if (error) {
      return res.status(500).json({
        error: 'Failed to check vote',
        message: error.message
      });
    }

    res.json({
      success: true,
      voted: data !== null
    });
  } catch (err) {
    res.status(500).json({
      error: 'Unexpected server error',
      message: err.message
    });
  }
});

export default router;

