import { ensureAnonymousUser } from '../utils/anonymousUser.js';
import { queryWithRLS, transactionWithRLS } from '../utils/rls.js';
import { logError } from '../utils/logger.js';
import { NotFoundError } from '../utils/AppError.js';
import { validateFlagReason, isValidUuid } from '../utils/validation.js';
import { sanitizeText, sanitizeContent } from '../utils/sanitize.js';
import { normalizeStatus } from '../utils/legacyShim.js';
import logger, { logSuccess } from '../utils/logger.js';
import { AppError, ValidationError } from '../utils/AppError.js';
import { auditLog, AuditAction, ActorType } from '../services/auditService.js';
import { executeUserAction } from '../utils/governance.js';
import { realtimeEvents } from '../utils/eventEmitter.js';
import { checkContentVisibility } from '../utils/trustScore.js';
import { reverseGeocode } from '../utils/georef.js';
import pool from '../config/database.js';
import { NotificationService as AppNotificationService } from '../utils/appNotificationService.js';
import { NotificationService } from '../utils/notificationService.js';
import { ErrorCodes } from '../utils/errorCodes.js';
import { syncGamification } from '../utils/gamificationCore.js';

export async function createReport(req, res, _next) {
  let client;
  let newReport;

  try {
    const anonymousId = req.anonymousId;
    logger.debug('Creating report (Enterprise Atomic Flow)', { anonymousId, title: req.body.title });

    // 1. PRE-TRANSACTION: Geolocation (Georef Argentina)
    // We do this outside the transaction to avoid holding DB connections during external API wait times.
    let province = null;
    let locality = null;
    let department = null;

    if (req.body.latitude && req.body.longitude) {
      try {
        const geoData = await reverseGeocode(
          parseFloat(req.body.latitude),
          parseFloat(req.body.longitude)
        );
        province = geoData.province || null;
        locality = geoData.locality || null;
        department = geoData.department || null;
      } catch (geoError) {
        logError(geoError, { context: 'georef.reverseGeocode_pre_transaction' });
      }
    }

    // 2. PRE-TRANSACTION: Business Logic & Sanitization
    const title = req.body.title.trim();
    const category = req.body.category;
    const zone = req.body.zone || null;
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    // Sanitization
    const sanitizeContext = { anonymousId, ip: req.ip };
    const sanitizedTitle = sanitizeText(title, 'report.title', sanitizeContext);
    const sanitizedDescription = sanitizeContent(req.body.description, 'report.description', sanitizeContext);
    const sanitizedAddress = sanitizeText(req.body.address, 'report.address', sanitizeContext) || null;
    const sanitizedZone = sanitizeText(req.body.zone, 'report.zone', sanitizeContext) || null;

    let finalZone = sanitizedZone;
    if (!finalZone || finalZone.trim() === '' || finalZone === 'Sin zona') {
      finalZone = locality || department || sanitizedZone || '';
    }

    // Incident Date
    let incidentDate = new Date().toISOString();
    if (req.body.incident_date) {
      const parsedDate = new Date(req.body.incident_date);
      if (isNaN(parsedDate.getTime())) {
        throw new ValidationError('incident_date must be a valid ISO 8601 date string');
      }
      incidentDate = parsedDate.toISOString();
    }

    // Visibility (Shadow Ban)
    let isHidden = false;
    try {
      const visibility = await checkContentVisibility(anonymousId);
      if (visibility.isHidden) { isHidden = true; }
    } catch (err) {
      logError(err, { context: 'visibility_check_pre_transaction' });
    }

    // Client-generated ID support
    const reportId = (req.body.id && isValidUuid(req.body.id)) ? req.body.id : crypto.randomUUID();

    // Idempotency Key: Prevent duplicate creation on retry/double-click
    const idempotencyKey = req.body.idempotency_key || null;
    let existingReport = null;
    
    if (idempotencyKey && typeof idempotencyKey === 'string' && idempotencyKey.length > 0) {
      // Check if this idempotency key was already used (within last 60 minutes)
      const idempotencyCheck = await pool.query(`
        SELECT id, title, created_at FROM reports 
        WHERE idempotency_key = $1 AND anonymous_id = $2 
        AND created_at >= NOW() - INTERVAL '60 minutes'
        LIMIT 1
      `, [idempotencyKey, anonymousId]);
      
      if (idempotencyCheck.rows.length > 0) {
        // Return existing report instead of creating duplicate
        existingReport = idempotencyCheck.rows[0];
        logger.info('Idempotent report returned', { idempotencyKey, reportId: existingReport.id });
      }
    }

    // If idempotent report exists, return it
    if (existingReport) {
      // Fetch full report details
      const fullReport = await queryWithRLS(anonymousId, `
        SELECT r.*, u.alias, u.avatar_url 
        FROM reports r 
        LEFT JOIN anonymous_users u ON r.anonymous_id = u.anonymous_id 
        WHERE r.id = $1
      `, [existingReport.id]);
      
      return res.status(200).json({
        success: true,
        data: fullReport.rows[0],
        idempotent: true
      });
    }

    // 3. ATOMIC TRANSACTION WITH RLS
    const data = await transactionWithRLS(anonymousId, async (client, _sse) => {
      // 3.1 Idempotent user ensure
      await ensureAnonymousUser(anonymousId);

      // 3.2 Duplicate check within transaction
      const duplicateResult = await client.query(`
        SELECT id FROM reports
        WHERE anonymous_id = $1 AND category = $2 AND zone = $3 AND title = $4 AND created_at >= $5
        LIMIT 1
      `, [anonymousId, category, zone, title, tenMinutesAgo]);

      if (duplicateResult.rows.length > 0) {
        throw new AppError('Ya existe un reporte similar reciente', 409, ErrorCodes.DUPLICATE_ENTRY, true);
      }

      // 3.3 Strict SSOT Insert
      const columns = [
        'id', 'anonymous_id', 'title', 'description', 'category', 'zone', 'address',
        'latitude', 'longitude', 'status', 'incident_date', 'is_hidden',
        'province', 'locality', 'department', 'idempotency_key'
      ];
      const values = [
        reportId, anonymousId, sanitizedTitle, sanitizedDescription, category,
        finalZone, sanitizedAddress, req.body.latitude || null, req.body.longitude || null,
        normalizeStatus(req.body.status) || 'abierto', incidentDate, isHidden, province, locality, department,
        idempotencyKey
      ];

      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

      // INSERT
      await client.query(`INSERT INTO reports (${columns.join(', ')}) VALUES (${placeholders})`, values);

      // RETRIEVE WITH JOIN (Deduplicated Contract)
      const retrieveResult = await client.query(`
        SELECT 
          r.id, r.anonymous_id, r.title, r.description, r.category, r.zone, r.address,
          r.latitude, r.longitude, r.status, r.incident_date, r.created_at, r.is_hidden,
          r.province, r.locality, r.department,
          u.alias, u.avatar_url
        FROM reports r
        LEFT JOIN anonymous_users u ON r.anonymous_id = u.anonymous_id
        WHERE r.id = $1
      `, [reportId]);

      newReport = retrieveResult.rows[0];

      // 3.4 Governance M12: executeUserAction (In same transaction)
      await executeUserAction({
        actorId: anonymousId,
        targetType: 'report',
        targetId: reportId,
        actionType: 'USER_REPORT_CREATE'
      }, client);

      return newReport;
    });

    logSuccess('Report created (Atomic)', { id: reportId, anonymousId });

    // 4. POST-COMMIT SIDE EFFECTS (Non-blocking, Protected)
    // These MUST NOT break the HTTP response if they fail.

    const fireAndForget = async () => {
      // SSE
      try {
        await realtimeEvents.emitNewReport(data, req.headers['x-client-id']);
      } catch (e) { logError(e, { context: 'SSE_emitNewReport' }); }

      // External Notifications (Telegram)
      try {
        await NotificationService.sendEvent('NEW_REPORT', {
          reportId: data.id,
          title: data.title,
          category: data.category,
          zone: data.zone,
          timestamp: new Date().toISOString()
        });
      } catch (e) { logError(e, { context: 'Telegram_NewReport' }); }

      // Gamification
      try {
        const gamification = await syncGamification(anonymousId);
        if (gamification?.profile?.newlyAwarded) {
          for (const badge of gamification.profile.newlyAwarded) {
            await AppNotificationService.notifyBadgeEarned(anonymousId, badge).catch(() => { });
          }
        }
      } catch (e) { logError(e, { context: 'Gamification_Sync' }); }

      // In-App & Push
      try {
        await AppNotificationService.notifyNearbyNewReport(data);
        await AppNotificationService.notifySimilarReports(data);
        const pushModule = await import('./push.js');
        await pushModule.notifyNearbyUsers(data);
      } catch (e) { logError(e, { context: 'Notifications_Push' }); }
    };

    // Set and forget (background execution)
    fireAndForget();

    // 5. AUDIT LOG (Non-blocking)
    auditLog({
      action: AuditAction.REPORT_CREATE,
      actorType: ActorType.ANONYMOUS,
      actorId: anonymousId,
      req,
      targetType: 'report',
      targetId: data.id,
      newValues: {
        title: data.title,
        category: data.category,
        zone: data.zone,
        status: data.status
      },
      metadata: { imageCount: req.files?.length || 0 },
      success: true
    }).catch(() => { });

    // 6. CLEAN SSOT RESPONSE
    return res.status(201).json({
      success: true,
      data,
      message: 'Report created successfully'
    });

  } catch (error) {
    logError(error, req);

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        error: error.code,
        message: error.message,
        details: error.details
      });
    }

    res.status(500).json({
      error: ErrorCodes.INTERNAL_ERROR,
      message: 'Failed to create report',
      details: error.message
    });
  } finally {
    if (client) { client.release(); }
  }
}

export async function toggleFavorite(req, res) {
  try {
    const { id } = req.params;
    const anonymousId = req.anonymousId;

    // Ensure anonymous user exists
    try {
      await ensureAnonymousUser(anonymousId);
    } catch (error) {
      logError(error, req);
      return res.status(500).json({
        error: 'Failed to ensure anonymous user'
      });
    }

    const result = await transactionWithRLS(anonymousId, async (client) => {
      const reportResult = await client.query(
        'SELECT id FROM reports WHERE id = $1',
        [id]
      );
      if (reportResult.rows.length === 0) {
        throw new NotFoundError('Report not found');
      }

      const checkResult = await client.query(
        'SELECT id FROM favorites WHERE anonymous_id = $1 AND report_id = $2',
        [anonymousId, id]
      );

      if (checkResult.rows.length > 0) {
        await client.query(
          'DELETE FROM favorites WHERE id = $1 AND anonymous_id = $2',
          [checkResult.rows[0].id, anonymousId]
        );
        return { isFavorite: false, status: 'removed' };
      }

      try {
        await client.query(
          'INSERT INTO favorites (anonymous_id, report_id) VALUES ($1, $2)',
          [anonymousId, id]
        );
        return { isFavorite: true, status: 'added' };
      } catch (insertError) {
        // Idempotencia por carrera de concurrencia (unique).
        if (insertError.code === '23505' || insertError.message?.includes('unique') || insertError.message?.includes('duplicate')) {
          return { isFavorite: true, status: 'already_exists' };
        }
        throw insertError;
      }
    });

    if (result.status === 'removed') {
      return res.json({
        success: true,
        data: {
          is_favorite: false
        },
        message: 'Favorite removed successfully'
      });
    }

    if (result.status === 'already_exists') {
      return res.status(200).json({
        success: true,
        data: {
          is_favorite: true
        },
        status: 'already_exists',
        message: 'Already favorited'
      });
    }

    return res.json({
      success: true,
      data: {
        is_favorite: true
      },
      message: 'Favorite added successfully'
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        error: 'Report not found'
      });
    }
    logError(error, req);
    res.status(500).json({
      error: 'Failed to toggle favorite'
    });
  }
}

export async function likeReport(req, res) {
  try {
    const { id } = req.params;
    const anonymousId = req.anonymousId;
    const clientId = req.headers['x-client-id'];

    const { upvotesCount } = await transactionWithRLS(anonymousId, async (client, sse) => {
      const reportResult = await client.query(
        `SELECT id, category, status 
         FROM reports 
         WHERE id = $1`,
        [id]
      );

      if (reportResult.rows.length === 0) {
        throw new NotFoundError('Report not found');
      }

      const report = reportResult.rows[0];

      // Idempotente por unique constraint (ON CONFLICT DO NOTHING).
      await client.query(
        `INSERT INTO votes (anonymous_id, target_type, target_id)
         VALUES ($1::uuid, 'report'::vote_target_type, $2)
         ON CONFLICT (anonymous_id, target_type, target_id) DO NOTHING`,
        [anonymousId, id]
      );

      const countResult = await client.query(
        'SELECT upvotes_count FROM reports WHERE id = $1',
        [id]
      );
      const count = countResult.rows[0]?.upvotes_count || 0;

      // Realtime estrictamente post-commit via cola transaccional.
      sse.emit('emitLikeUpdate', id, count, report.category, report.status, clientId);

      return { upvotesCount: count };
    });

    res.json({
      success: true,
      data: {
        is_liked: true,
        upvotes_count: upvotesCount
      },
      message: 'Like added'
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: 'Report not found' });
    }
    logError(error, req);
    res.status(500).json({ error: 'Failed to like report' });
  }
}

export async function unlikeReport(req, res) {
  try {
    const { id } = req.params;
    const anonymousId = req.anonymousId;
    const clientId = req.headers['x-client-id'];

    const { upvotesCount } = await transactionWithRLS(anonymousId, async (client, sse) => {
      const reportResult = await client.query(
        `SELECT id, category, status 
         FROM reports 
         WHERE id = $1`,
        [id]
      );

      if (reportResult.rows.length === 0) {
        throw new NotFoundError('Report not found');
      }

      const report = reportResult.rows[0];

      await client.query(
        `DELETE FROM votes 
         WHERE anonymous_id = $1::uuid 
           AND target_type = 'report'
           AND target_id = $2`,
        [anonymousId, id]
      );

      const countResult = await client.query(
        'SELECT upvotes_count FROM reports WHERE id = $1',
        [id]
      );
      const count = countResult.rows[0]?.upvotes_count || 0;

      // Realtime estrictamente post-commit via cola transaccional.
      sse.emit('emitLikeUpdate', id, count, report.category, report.status, clientId);

      return { upvotesCount: count };
    });

    res.json({
      success: true,
      data: {
        is_liked: false,
        upvotes_count: upvotesCount
      },
      message: 'Like removed'
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: 'Report not found' });
    }
    logError(error, req);
    res.status(500).json({ error: 'Failed to unlike report' });
  }
}

export async function patchReport(req, res) {
  try {
    const { id } = req.params;
    const anonymousId = req.anonymousId;

    // Build update SET clause dynamically
    const updates = [];
    const params = [id, anonymousId];
    let paramIndex = 3;

    // Context for logging suspicious content
    const sanitizeContext = { anonymousId, ip: req.ip };

    if (req.body.title !== undefined) {
      updates.push(`title = $${paramIndex}`);
      // SECURITY: Sanitize before database update
      params.push(sanitizeText(req.body.title, 'report.title', sanitizeContext));
      paramIndex++;
    }

    if (req.body.description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      // SECURITY: Sanitize before database update
      params.push(sanitizeContent(req.body.description, 'report.description', sanitizeContext));
      paramIndex++;
    }

    if (req.body.status !== undefined) {
      if (process.env.ENABLE_STRICT_REPORT_LIFECYCLE === 'true') {
        return res.status(400).json({
          error: 'Semantics Enforcement: Direct status update is forbidden. Use semantic endpoints (resolve, reject, close).'
        });
      }
      updates.push(`status = $${paramIndex}`);
      // FIX: Serialize legacy status to new enum values
      params.push(normalizeStatus(req.body.status));
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No fields to update'
      });
    }

    // Add updated_at timestamp
    updates.push(`updated_at = $${paramIndex}`);
    params.push(new Date().toISOString());

    const updatedReport = await transactionWithRLS(anonymousId, async (client, sse) => {
      // Check if report exists and belongs to user (same tx/client)
      const checkResult = await client.query(
        'SELECT anonymous_id, status FROM reports WHERE id = $1',
        [id]
      );

      if (checkResult.rows.length === 0) {
        throw new NotFoundError('Report not found');
      }

      const report = checkResult.rows[0];
      if (report.anonymous_id !== anonymousId) {
        throw new AppError('Forbidden: You can only update your own reports', 403, 'FORBIDDEN', true);
      }

      // CTE: Update and Retrieve enriched data in one go
      // CONTRACT ENFORCEMENT: Explicit projection to exclude legacy fields (likes_count)
      const CANONICAL_REPORT_FIELDS = `
        r.id, r.anonymous_id, r.title, r.description, r.category, r.zone, r.address,
        r.latitude, r.longitude, r.status, r.upvotes_count, r.comments_count,
        r.created_at, r.updated_at, r.last_edited_at, r.incident_date, r.image_urls,
        r.province, r.locality, r.department, r.threads_count, r.is_hidden, r.deleted_at
      `;

      const updateResult = await client.query(`
        WITH updated_report AS (
          UPDATE reports SET ${updates.join(', ')}
          WHERE id = $1 AND anonymous_id = $2
          RETURNING *
        )
        SELECT 
          ${CANONICAL_REPORT_FIELDS},
          u.alias,
          u.avatar_url
        FROM updated_report r
        LEFT JOIN anonymous_users u ON r.anonymous_id = u.anonymous_id
      `, params);

      if (updateResult.rows.length === 0) {
        throw new AppError('Forbidden: You can only update your own reports', 403, 'FORBIDDEN', true);
      }

      const updated = updateResult.rows[0];

      logger.info('[AUDIT PATCH REPORT] Updated data from DB:', {
        id: updated.id,
        title: updated.title,
        description: updated.description?.substring(0, 50),
        updated_at: updated.updated_at,
        timestamp: Date.now()
      });

      // REALTIME: Broadcast only post-commit via transactional queue
      sse.emit('emitReportUpdate', updated);

      return updated;
    });

    logSuccess('Report updated', { id, anonymousId });

    res.json({
      success: true,
      data: updatedReport,
      message: 'Report updated successfully'
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        error: 'Report not found'
      });
    }
    if (error instanceof AppError && error.statusCode === 403) {
      return res.status(403).json({
        error: 'Forbidden: You can only update your own reports'
      });
    }
    logError(error, req);
    res.status(500).json({
      error: 'Failed to update report'
    });
  }
}

export async function flagReport(req, res) {
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

    const comment = req.body.comment ? sanitizeText(req.body.comment, 'flag_comment', { anonymousId }) : null;

    const txResult = await transactionWithRLS(anonymousId, async (client, sse) => {
      // Verify report exists and get owner
      const reportResult = await client.query(
        'SELECT id, anonymous_id FROM reports WHERE id = $1',
        [id]
      );
      if (reportResult.rows.length === 0) {
        throw new NotFoundError('Report not found');
      }

      const report = reportResult.rows[0];

      // Check if user is trying to flag their own report
      if (report.anonymous_id === anonymousId) {
        throw new AppError('You cannot flag your own report', 403, 'FORBIDDEN', true);
      }

      // Return 200 OK instead of 409 - user's intent is satisfied (report is flagged)
      const checkResult = await client.query(
        'SELECT id FROM report_flags WHERE anonymous_id = $1 AND report_id = $2',
        [anonymousId, id]
      );

      if (checkResult.rows.length > 0) {
        return {
          status: 'already_exists',
          existingFlagId: checkResult.rows[0].id,
          targetOwnerId: report.anonymous_id
        };
      }

      const insertResult = await client.query(
        `INSERT INTO report_flags (anonymous_id, report_id, reason, comment)
         VALUES ($1, $2, $3, $4)
         RETURNING id, report_id, reason`,
        [anonymousId, id, reason, comment]
      );

      if (insertResult.rows.length === 0) {
        throw new Error('Insert returned no data');
      }

      const newFlag = insertResult.rows[0];

      // If threshold met, trigger sets is_hidden=true. Emit realtime only post-commit.
      const statusCheck = await client.query(
        'SELECT is_hidden, category, status FROM reports WHERE id = $1',
        [id]
      );

      const reportState = statusCheck.rows[0];
      if (reportState?.is_hidden) {
        sse.emit('emitReportDelete', id, reportState.category, reportState.status);
      }

      return {
        status: 'created',
        flagId: newFlag.id,
        targetOwnerId: report.anonymous_id,
        autoHidden: Boolean(reportState?.is_hidden)
      };
    });

    if (txResult.status === 'already_exists') {
      return res.status(200).json({
        success: true,
        data: {
          is_flagged: true,
          flag_id: txResult.existingFlagId
        },
        status: 'already_exists',
        message: 'Already flagged'
      });
    }

    if (txResult.autoHidden) {
      logger.info(`[Moderation] Auto-hide triggered by flags for report ${id}. Event queued post-commit.`);
    }

    // AUDIT LOG (post-commit, no bloqueante)
    auditLog({
      action: AuditAction.REPORT_FLAG,
      actorType: ActorType.ANONYMOUS,
      actorId: anonymousId,
      req,
      targetType: 'report',
      targetId: id,
      targetOwnerId: txResult.targetOwnerId,
      metadata: { reason, flagId: txResult.flagId },
      success: true
    }).catch(() => { });

    res.status(201).json({
      success: true,
      data: {
        is_flagged: true,
        flag_id: txResult.flagId
      },
      message: 'Report flagged successfully'
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({
        error: 'Report not found'
      });
    }

    if (error instanceof AppError && error.statusCode === 403) {
      return res.status(403).json({
        error: 'You cannot flag your own report'
      });
    }

    if (error?.message === 'Insert returned no data') {
      return res.status(500).json({
        error: 'Failed to flag report',
        message: 'Insert operation returned no data'
      });
    }

    logError(error, req);
    res.status(500).json({
      error: 'Failed to flag report'
    });
  }
}

export async function deleteReport(req, res) {
  try {
    const { id } = req.params;
    const anonymousId = req.anonymousId;

    // [M12 REFINEMENT] Use executeUserAction for Willpower Audit + Mutation
    const result = await executeUserAction({
      actorId: anonymousId,
      targetType: 'report',
      targetId: id,
      actionType: 'USER_DELETE_SELF_REPORT',
      updateQuery: `UPDATE reports SET deleted_at = NOW() WHERE id = $1 AND anonymous_id = $2 AND deleted_at IS NULL`,
      updateParams: [id, anonymousId]
    });

    if (result.rowCount === 0) {
      // If snapshot existed but UPDATE affected 0 rows, it's either already deleted or ownership mismatch
      // executeUserAction throws 'Target not found' if it doesn't exist at all, so here it's definitely mismatch or already deleted.
      return res.status(403).json({
        error: 'Forbidden',
        message: 'No tienes permiso para eliminar este reporte o ya fue eliminado'
      });
    }

    const currentItem = result.snapshot;
    logSuccess('Report deleted with Willpower Audit', { id, anonymousId });

    // REALTIME: Broadcast soft delete
    realtimeEvents.emitReportDelete(
      id,
      currentItem.category,
      currentItem.status,
      req.headers['x-client-id']
    );

    // AUDIT LOG
    auditLog({
      action: AuditAction.REPORT_DELETE,
      actorType: ActorType.ANONYMOUS,
      actorId: anonymousId,
      req,
      targetType: 'report',
      targetId: id,
      oldValues: {
        title: currentItem.title,
        category: currentItem.category,
        status: currentItem.status
      },
      success: true
    }).catch(() => { });

    res.json({
      success: true,
      message: 'Report deleted successfully'
    });
  } catch (error) {
    logError(error, req);

    // M12 Governance Errors
    if (error.message === 'Target not found') {
      return res.status(404).json({
        error: 'Report not found',
        message: 'El reporte no existe o ya fue eliminado'
      });
    }

    res.status(500).json({
      error: 'Failed to delete report',
      message: error.message
    });
  }
}
