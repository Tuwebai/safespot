import { logError, logSuccess } from '../utils/logger.js';
import { queryWithRLS, transactionWithRLS } from '../utils/rls.js';
import { ensureAnonymousUser } from '../utils/anonymousUser.js';
import { checkContentVisibility } from '../utils/trustScore.js';
import { syncGamification } from '../utils/gamificationCore.js';
import { NotificationService } from '../utils/appNotificationService.js';
import { isValidUuid } from '../utils/validation.js';
import { sanitizeCommentContent } from '../utils/sanitize.js';
import { auditLog, AuditAction, ActorType } from '../services/auditService.js';
import { extractMentions } from '../utils/mentions.js';
import { AppError, ValidationError, NotFoundError } from '../utils/AppError.js';
import { ErrorCodes } from '../utils/errorCodes.js';

/**
 * POST /api/comments
 * Create a new comment
 * Requires: X-Anonymous-Id header
 */
export async function createComment(req, res, next) {
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
                queryWithRLS(
                    anonymousId,
                    'SELECT id FROM reports WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
                    [req.body.report_id]
                )
            ];

            if (hasParentId) {
                verificationPromises.push(
                    queryWithRLS(
                        anonymousId,
                        'SELECT id, report_id FROM comments WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
                        [req.body.parent_id]
                    )
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
            if (reportResult.rows.length === 0) {
                return res.status(404).json({ error: 'Report not found' });
            }

            // Handle Parent Check Result
            if (hasParentId) {
                if (parentResult.rows.length === 0) {
                    throw new NotFoundError('Parent comment not found');
                }
                if (parentResult.rows[0].report_id !== req.body.report_id) {
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

        const data = await transactionWithRLS(anonymousId, async (client, sse) => {
            // a. Insert Comment
            const insertResult = await client.query(insertQuery, insertParams);
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

            return comment;
        });

        const transactionDuration = Date.now() - transactionStartTime;
        logSuccess(`Comment created: ${data.id}`, { transactionDuration });

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
}
