import express from 'express';
import { requireAnonymousId } from '../utils/validation.js';
import { validate } from '../utils/validateMiddleware.js';
import { voteSchema } from '../utils/schemas.js';
import { logError, logSuccess } from '../utils/logger.js';
import { ensureAnonymousUser } from '../utils/anonymousUser.js';
import { syncGamification } from '../utils/gamificationCore.js';
import { queryWithRLS } from '../utils/rls.js';
import { checkContentVisibility } from '../utils/trustScore.js';
import supabase from '../config/supabase.js';
import { voteLimiter } from '../utils/rateLimiter.js';
import { realtimeEvents } from '../utils/eventEmitter.js';
import { executeUserAction } from '../utils/governance.js';
import { NotificationService } from '../utils/appNotificationService.js';

const router = express.Router();

/**
 * POST /api/votes
 * Create a vote (upvote) on a report or comment
 * Requires: X-Anonymous-Id header
 * Body: { report_id: UUID } OR { comment_id: UUID }
 * Rate limited: 30 per minute, 200 per hour
 */
router.post('/', requireAnonymousId, validate(voteSchema), voteLimiter, async (req, res) => {
  try {
    const anonymousId = req.anonymousId;
    const { report_id, comment_id, target_type, target_id } = req.body;

    // Normalizar a polimórfico
    const targetType = target_type || (report_id ? 'report' : 'comment');
    const targetId = target_id || (report_id || comment_id);

    logSuccess('Creating vote', { anonymousId, targetType, targetId });

    // Ensure anonymous user exists in anonymous_users table (idempotent)
    try {
      await ensureAnonymousUser(anonymousId);
    } catch (error) {
      logError(error, req);
      return res.status(500).json({
        error: 'Failed to ensure anonymous user'
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

    // Check if vote already exists (prevent duplicates) using queryWithRLS
    logSuccess('Checking for existing vote', { anonymousId, targetType, targetId });

    const checkQuery = `
      SELECT id FROM votes 
      WHERE anonymous_id = $1 
      AND target_type = $2::vote_target_type 
      AND target_id = $3
    `;
    const checkParams = [anonymousId, targetType, targetId];

    const existingVoteResult = await queryWithRLS(anonymousId, checkQuery, checkParams);

    if (existingVoteResult.rows.length > 0) {
      logSuccess('Duplicate vote prevented', { anonymousId });
      return res.status(409).json({
        error: 'You have already voted on this item',
        code: 'DUPLICATE_VOTE'
      });
    }

    // Check if vote already exists (same block)
    // ...

    // NEW: Check Trust Score & Shadow Ban Status
    let isHidden = false;
    try {
      const visibility = await checkContentVisibility(anonymousId);
      if (visibility.isHidden) {
        isHidden = true;
        logSuccess('Shadow ban applied to vote', { anonymousId, action: visibility.moderationAction });
      }
    } catch (checkError) {
      logError(checkError, req);
      // Fail open
    }

    // Governance Note: Injected via executeUserAction below

    // Trigger gamification sync asynchronously (non-blocking)
    syncGamification(anonymousId).catch(err => {
      logError(err, { context: 'syncGamification.vote', anonymousId });
    });

    // Get the owner of the report/comment that received the vote
    let ownerId = null;
    if (report_id) {
      const { data: report } = await supabase
        .from('reports')
        .select('anonymous_id')
        .eq('id', report_id)
        .single();

      if (report && report.anonymous_id) {
        ownerId = report.anonymous_id;
      }
    } else if (comment_id) {
      const { data: comment } = await supabase
        .from('comments')
        .select('anonymous_id')
        .eq('id', comment_id)
        .single();

      if (comment && comment.anonymous_id) {
        ownerId = comment.anonymous_id;
      }
    }

    // Evaluate badges for the recipient (ownerId)
    if (ownerId && ownerId !== anonymousId) {
      syncGamification(ownerId).catch(err => {
        logError(err, req);
      });

      // Notify Owner of Like/Vote
      const targetType = report_id ? 'report' : 'comment';
      const targetId = report_id || comment_id;

      try {
        NotificationService.notifyLike(targetType, targetId, anonymousId).catch(err => {
          logError(err, { context: 'notifyLike.vote', targetId });
        });
      } catch (notiError) {
        console.error('[Votes] notifyLike triggered exception:', notiError.message);
      }
    }

    // 4. ATOMIC MUTATION (SSOT: DB Trigger handles counters)
    // ============================================
    const actionType = targetType === 'report' ? 'USER_VOTE_REPORT' : 'USER_VOTE_COMMENT';

    // Build the atomic mutation query. NO manual SET here.
    const mutationQuery = `
        INSERT INTO votes (anonymous_id, target_type, target_id, is_hidden)
        VALUES ($1, $2::vote_target_type, $3, $4)
        RETURNING *;
    `;

    try {
      await executeUserAction({
        actorId: anonymousId,
        targetType,
        targetId,
        actionType,
        updateQuery: mutationQuery,
        updateParams: [anonymousId, targetType, targetId, isHidden]
      });
    } catch (err) {
      // Handle unique constraint violation (duplicate vote) - Idempotency
      if (err.code === '23505') {
        return res.status(200).json({
          success: true,
          status: 'already_exists',
          message: 'Already voted'
        });
      }
      throw err;
    }

    try {
      // Fetch updated count after trigger
      const updatedCountResult = await queryWithRLS('', `SELECT upvotes_count FROM ${targetType}s WHERE id = $1`, [targetId]);
      const updatedCount = updatedCountResult.rows[0]?.upvotes_count || 0;

      res.status(201).json({
        success: true,
        data: {
          is_liked: report_id ? true : undefined, // For reports
          upvotes_count: updatedCount
        },
        message: 'Vote created successfully'
      });

      // REALTIME: Broadcast updated count
      const clientId = req.headers['x-client-id'];
      if (report_id) {
        const { data: report } = await supabase.from('reports').select('category, status').eq('id', report_id).single();
        realtimeEvents.emitLikeUpdate(report_id, updatedCount, report?.category, report?.status, clientId);
      } else {
        realtimeEvents.emitVoteUpdate('comment', comment_id, { upvotes_count: updatedCount }, clientId);
      }
    } catch (err) {
      logError(err, { context: 'postVote.response' });
      res.status(201).json({ success: true, message: 'Vote created' });
    }
  } catch (error) {
    logError(error, req);

    // Handle unique constraint violation (duplicate vote)
    // Return 200 OK instead of 409 - this is expected behavior for idempotent operations
    if (error.code === '23505') {
      return res.status(200).json({
        success: true,
        data: {
          // Vote already exists, return minimal data
          anonymous_id: anonymousId,
          report_id: report_id || null,
          comment_id: comment_id || null
        },
        status: 'already_exists',
        message: 'Already voted'
      });
    }

    res.status(500).json({
      error: 'Failed to create vote'
    });
  }
});

/**
 * DELETE /api/votes
 * Remove a vote (unvote) from a report or comment
 * Requires: X-Anonymous-Id header
 * Body: { report_id: UUID } OR { comment_id: UUID }
 * Rate limited: 30 per minute, 200 per hour
 */
router.delete('/', voteLimiter, requireAnonymousId, async (req, res) => {
  try {
    const anonymousId = req.anonymousId;
    const { report_id, comment_id, target_type, target_id } = req.body;

    const targetType = target_type || (report_id ? 'report' : 'comment');
    const targetId = target_id || (report_id || comment_id);

    if (!targetId) {
      return res.status(400).json({
        error: 'Either report_id or comment_id is required'
      });
    }

    // 4. ATOMIC MUTATION & GOVERNANCE (M12)
    // ============================================
    const actionType = targetType === 'report' ? 'USER_UNVOTE_REPORT' : 'USER_UNVOTE_COMMENT';

    const mutationQuery = `
        DELETE FROM votes 
        WHERE anonymous_id = $1 
        AND target_type = $2::vote_target_type 
        AND target_id = $3
        RETURNING id;
    `;

    try {
      await executeUserAction({
        actorId: anonymousId,
        targetType,
        targetId,
        actionType,
        updateQuery: mutationQuery,
        updateParams: [anonymousId, targetType, targetId]
      });
    } catch (err) {
      if (err.message === 'Target not found') {
        return res.status(404).json({ error: 'Vote not found' });
      }
      throw err;
    }

    logSuccess('Vote removed', {
      anonymousId,
      target: report_id || comment_id
    });

    try {
      // Fetch updated count after trigger (SSOT Authority)
      const updatedCountResult = await queryWithRLS('', `SELECT upvotes_count FROM ${targetType}s WHERE id = $1`, [targetId]);
      const updatedCount = updatedCountResult.rows[0]?.upvotes_count || 0;

      res.status(200).json({
        success: true,
        data: {
          is_liked: report_id ? false : undefined,
          upvotes_count: updatedCount
        },
        message: 'Vote removed successfully'
      });

      // REALTIME: Broadcast updated count
      const clientId = req.headers['x-client-id'];
      if (report_id) {
        const { data: report } = await supabase.from('reports').select('category, status').eq('id', report_id).single();
        realtimeEvents.emitLikeUpdate(report_id, updatedCount, report?.category, report?.status, clientId);
      } else {
        realtimeEvents.emitVoteUpdate('comment', comment_id, { upvotes_count: updatedCount }, clientId);
      }
    } catch (err) {
      logError(err, { context: 'deleteVote.response' });
      res.status(200).json({ success: true, message: 'Vote removed' });
    }
  } catch (error) {
    logError(error, req);
    res.status(500).json({
      success: false,
      error: 'Failed to remove vote',
      details: error.message
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
    const { report_id, comment_id, target_type, target_id } = req.query;

    const targetType = target_type || (report_id ? 'report' : 'comment');
    const targetId = target_id || (report_id || comment_id);

    if (!targetId) {
      return res.status(400).json({
        error: 'Either report_id or comment_id is required'
      });
    }

    // Check vote status using queryWithRLS for RLS enforcement
    const checkQuery = `
      SELECT id FROM votes 
      WHERE anonymous_id = $1 
      AND target_type = $2::vote_target_type 
      AND target_id = $3
    `;
    const checkParams = [anonymousId, targetType, targetId];

    const result = await queryWithRLS(anonymousId, checkQuery, checkParams);

    res.json({
      success: true,
      voted: result.rows.length > 0
    });
  } catch (err) {
    res.status(500).json({
      error: 'Unexpected server error'
    });
  }
});

export default router;

