import { logError, logSuccess } from '../utils/logger.js';
import { transactionWithRLS } from '../utils/rls.js';
import { ensureAnonymousUser } from '../utils/anonymousUser.js';
import { checkContentVisibility } from '../utils/trustScore.js';
import { syncGamification } from '../utils/gamificationCore.js';
import { NotificationService } from '../utils/appNotificationService.js';
import { validateFlagReason } from '../utils/validation.js';
import { sanitizeText } from '../utils/sanitize.js';
import { auditLog, AuditAction, ActorType } from '../services/auditService.js';

/**
 * POST /api/comments/:id/pin
 * Pin a comment (Only by Report Owner)
 */
export async function pinComment(req, res) {
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
}

/**
 * DELETE /api/comments/:id/pin
 * Unpin a comment
 */
export async function unpinComment(req, res) {
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
}

/**
 * POST /api/comments/:id/like
 * Like a comment
 */
export async function likeComment(req, res) {
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
}

/**
 * DELETE /api/comments/:id/like
 * Unlike a comment
 */
export async function unlikeComment(req, res) {
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
}

/**
 * POST /api/comments/:id/flag
 * Flag a comment as inappropriate
 */
export async function flagComment(req, res) {
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

        const flagCommentText = req.body.comment ? sanitizeText(req.body.comment, 'flag_comment', { anonymousId }) : null;

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
                [anonymousId, id, reason, flagCommentText]
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
}
