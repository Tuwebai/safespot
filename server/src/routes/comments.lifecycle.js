import { logError, logInfo, logSuccess } from '../utils/logger.js';
import { transactionWithRLS } from '../utils/rls.js';
import { auditLog, AuditAction, ActorType } from '../services/auditService.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/AppError.js';
import { executeUserAction } from '../utils/governance.js';
import { realtimeEvents } from '../utils/eventEmitter.js';
import crypto from 'crypto';

/**
 * PATCH /api/comments/:id
 * Update a comment (only by creator)
 * Requires: X-Anonymous-Id header
 * Body: { content: string }
 */
export async function updateComment(req, res, next) {
    const patchStartTime = Date.now();
    const { id } = req.params;
    // console.log(`[PATCH COMMENT] 🟡 PATCH RECEIVED: ${id} at ${new Date().toISOString()}`);

    try {
        const anonymousId = req.anonymousId;

        const content = req.body.content;

        const txResult = await transactionWithRLS(anonymousId, async (client) => {
            const checkResult = await client.query(
                `SELECT id, anonymous_id FROM comments 
         WHERE id = $1 AND deleted_at IS NULL`,
                [id]
            );

            if (checkResult.rows.length === 0) {
                return { notFound: true };
            }

            if (checkResult.rows[0].anonymous_id !== anonymousId) {
                return { forbidden: true, ownerId: checkResult.rows[0].anonymous_id };
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
           u.avatar_url,
           (c.anonymous_id = r.anonymous_id) as is_author
         FROM updated c
         LEFT JOIN anonymous_users u ON c.anonymous_id = u.anonymous_id
         LEFT JOIN reports r ON c.report_id = r.id`,
                [content, id, anonymousId]
            );

            return { updatedComment: updateResult.rows[0] };
        });

        if (txResult?.notFound) {
            logInfo('Comment PATCH failed: Not Found', { commentId: id, actorId: anonymousId });
            throw new NotFoundError('Comment not found');
        }

        if (txResult?.forbidden) {
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
}

/**
 * DELETE /api/comments/:id
 * Delete a comment (only by creator)
 */
export async function deleteComment(req, res, next) {
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
        const deletedNow = !result.idempotent && result.rowCount > 0;

        if (deletedNow) {
            // REALTIME: Broadcast deletion
            try {
                const clientId = req.headers['x-client-id'];
                const eventId = crypto.randomUUID(); // Single ID for all broadcasts related to this action

                realtimeEvents.emitCommentDelete(reportId, id, clientId, eventId);

            } catch (err) {
                logError(err, { context: 'realtimeEvents.emitCommentDelete', reportId });
            }
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

        if (deletedNow) {
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
        }

        res.json({
            success: true,
            message: 'Comment deleted successfully'
        });
    } catch (error) {
        next(error);
    }
}
