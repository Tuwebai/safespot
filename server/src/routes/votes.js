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
import { NotificationService } from '../utils/notificationService.js';

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
    const { report_id, comment_id } = req.body;

    logSuccess('Creating vote', { anonymousId, reportId: report_id, commentId: comment_id });

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
    logSuccess('Checking for existing vote', { anonymousId });

    let checkQuery;
    let checkParams;

    if (report_id) {
      checkQuery = `
        SELECT id FROM votes 
        WHERE anonymous_id = $1 
        AND report_id = $2 
        AND comment_id IS NULL
      `;
      checkParams = [anonymousId, report_id];
    } else {
      checkQuery = `
        SELECT id FROM votes 
        WHERE anonymous_id = $1 
        AND comment_id = $2 
        AND report_id IS NULL
      `;
      checkParams = [anonymousId, comment_id];
    }

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

      NotificationService.notifyLike(targetType, targetId, anonymousId).catch(err => {
        logError(err, { context: 'notifyLike.vote', targetId });
      });
    }

    // 4. ATOMIC MUTATION & GOVERNANCE (M12)
    // ============================================
    const targetType = report_id ? 'report' : 'comment';
    const targetId = report_id || comment_id;
    const actionType = report_id ? 'USER_VOTE_REPORT' : 'USER_VOTE_COMMENT';

    // Build the atomic mutation query using CTE
    const mutationQuery = `
      WITH inserted_vote AS (
        INSERT INTO votes (anonymous_id, report_id, comment_id, is_hidden)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      )
      UPDATE ${targetType}s 
      SET upvotes_count = upvotes_count + 1 
      WHERE id = $2 AND $4 = false;
    `;

    try {
      await executeUserAction({
        actorId: anonymousId,
        targetType,
        targetId,
        actionType,
        updateQuery: mutationQuery,
        updateParams: [anonymousId, report_id || null, comment_id || null, isHidden]
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

    res.status(201).json({
      success: true,
      message: 'Vote created successfully'
    });

    // REALTIME: Broadcast updated count
    const clientId = req.headers['x-client-id'];
    (async () => {
      try {
        if (report_id) {
          const { count } = await supabase.from('votes').select('*', { count: 'exact', head: true }).eq('report_id', report_id);
          realtimeEvents.emitVoteUpdate('report', report_id, { upvotes_count: count }, clientId);
        } else if (comment_id) {
          const { count } = await supabase.from('votes').select('*', { count: 'exact', head: true }).eq('comment_id', comment_id);
          realtimeEvents.emitVoteUpdate('comment', comment_id, { upvotes_count: count }, clientId);
        }
      } catch (err) {
        logError(err, { context: 'realtimeParam.vote' });
      }
    })();
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
    const { report_id, comment_id } = req.body;

    if (!report_id && !comment_id) {
      return res.status(400).json({
        error: 'Either report_id or comment_id is required'
      });
    }

    // 4. ATOMIC MUTATION & GOVERNANCE (M12)
    // ============================================
    const targetType = report_id ? 'report' : 'comment';
    const targetId = report_id || comment_id;
    const actionType = report_id ? 'USER_UNVOTE_REPORT' : 'USER_UNVOTE_COMMENT';

    const mutationQuery = `
      WITH deleted_vote AS (
        DELETE FROM votes 
        WHERE anonymous_id = $1 
        AND ${report_id ? 'report_id = $2 AND comment_id IS NULL' : 'comment_id = $2 AND report_id IS NULL'}
        RETURNING id
      )
      UPDATE ${targetType}s 
      SET upvotes_count = GREATEST(0, upvotes_count - 1) 
      WHERE id = $2 AND (SELECT count(*) FROM deleted_vote) > 0;
    `;

    try {
      await executeUserAction({
        actorId: anonymousId,
        targetType,
        targetId,
        actionType,
        updateQuery: mutationQuery,
        updateParams: [anonymousId, report_id || comment_id]
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

    res.json({
      success: true,
      message: 'Vote removed successfully'
    });

    // REALTIME: Fetch updated count and broadcast
    (async () => {
      try {
        if (report_id) {
          const { count } = await supabase.from('votes').select('*', { count: 'exact', head: true }).eq('report_id', report_id);
          realtimeEvents.emitVoteUpdate('report', report_id, { upvotes_count: count });
        } else if (comment_id) {
          const { count } = await supabase.from('votes').select('*', { count: 'exact', head: true }).eq('comment_id', comment_id);
          realtimeEvents.emitVoteUpdate('comment', comment_id, { upvotes_count: count });
        }
      } catch (err) {
        logError(err, { context: 'realtimeParam.unvote' });
      }
    })();
  } catch (error) {
    logError(error, req);
    res.status(500).json({
      error: 'Failed to remove vote'
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

    // Check vote status using queryWithRLS for RLS enforcement
    let checkQuery;
    let checkParams;

    if (report_id) {
      checkQuery = `
        SELECT id FROM votes 
        WHERE anonymous_id = $1 
        AND report_id = $2
      `;
      checkParams = [anonymousId, report_id];
    } else {
      checkQuery = `
        SELECT id FROM votes 
        WHERE anonymous_id = $1 
        AND comment_id = $2
      `;
      checkParams = [anonymousId, comment_id];
    }

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

