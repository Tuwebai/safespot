import pool from '../config/database.js';
import { logError } from './logger.js';
import { NotFoundError, ForbiddenError } from './AppError.js';

const SYSTEM_ROOT_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

/**
 * executeModeration
 * Atomic Moderation Action (M12 Governance Engine)
 * 
 * Ensures: BEGIN -> Context Guard -> Snapshot -> Audit -> Mutate -> COMMIT
 */
export async function executeModeration(params, externalClient = null) {
    const {
        actorId,
        actorType = 'HUMAN', // 'HUMAN' | 'SYSTEM'
        impersonatedIdentity, // Ej: 'SafeSpot Oficial'
        targetType, // 'report', 'comment', 'user'
        targetId,
        actionType, // Semántico: 'ADMIN_HIDE', 'ADMIN_RESTORE', etc.
        updateQuery,
        updateParams,
        reason,
        internalNote,
        metadata = {}
    } = params;

    const client = externalClient || await pool.connect();
    const isInternalTransaction = !externalClient;

    try {
        if (isInternalTransaction) await client.query('BEGIN');

        // [M12 CRITICAL] Set Context Guard to prevent duplicate audit from triggers
        await client.query("SET LOCAL app.audit_skip = 'true'");

        // 1. Capture Snapshot
        const table = targetType === 'report' ? 'reports'
            : targetType === 'comment' ? 'comments'
                : targetType === 'user' ? 'anonymous_users'
                    : null;

        if (!table) throw new Error(`Invalid target type: ${targetType}`);

        const snapshotRes = await client.query(`SELECT * FROM ${table} WHERE id = $1 FOR UPDATE`, [targetId]);
        if (snapshotRes.rowCount === 0) {
            throw new Error(`Target ${targetType}:${targetId} not found`);
        }
        const snapshot = snapshotRes.rows[0];

        // 2. Insert into Ledger (moderation_actions)
        const auditQuery = `
            INSERT INTO moderation_actions (
                actor_id, actor_type, impersonated_identity,
                target_type, target_id, action_type, 
                reason, internal_note, snapshot, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id
        `;
        const auditParams = [
            actorId || SYSTEM_ROOT_ID,
            actorType,
            impersonatedIdentity,
            targetType,
            targetId,
            actionType,
            reason || 'Moderation Action',
            internalNote,
            snapshot,
            metadata
        ];

        const auditRes = await client.query(auditQuery, auditParams);
        const actionRecordId = auditRes.rows[0].id;

        // 3. Execute Mutation
        if (updateQuery) {
            await client.query(updateQuery, updateParams);
        }

        if (isInternalTransaction) await client.query('COMMIT');

        return {
            success: true,
            auditId: actionRecordId,
            snapshot
        };

    } catch (err) {
        if (isInternalTransaction) await client.query('ROLLBACK');
        logError(err, { context: 'M12_GOVERNANCE_EXECUTE', params });
        throw err;
    } finally {
        if (isInternalTransaction) client.release();
    }
}

/**
 * executeUserAction
 * Logs User Intent (Willpower) into user_actions ledger
 * Separate from Moderation (Coercion)
 */
export async function executeUserAction(params, externalClient = null) {
    const {
        actorId, // Anonymous User ID
        targetType,
        targetId,
        actionType, // Semántico: 'USER_DELETE_SELF_REPORT', etc.
        updateQuery,
        updateParams
    } = params;

    const client = externalClient || await pool.connect();
    const isInternalTransaction = !externalClient;

    try {
        if (isInternalTransaction) await client.query('BEGIN');

        // 1. Snapshot
        const table = targetType === 'report' ? 'reports' : 'comments';
        const snapshotRes = await client.query(`SELECT * FROM ${table} WHERE id = $1 FOR UPDATE`, [targetId]);

        // [AUDIT] Semántica HTTP CorrectA
        if (snapshotRes.rowCount === 0) throw new NotFoundError(`Target ${targetType} not found`);
        const snapshot = snapshotRes.rows[0];

        // 2. Ownership Validation (Guard Invariante)
        // El actorId proveído por el middleware debe coincidir con el dueño del recurso.
        if (snapshot.anonymous_id && snapshot.anonymous_id !== actorId) {
            throw new ForbiddenError(`You do not have permission to perform this action on this ${targetType}`);
        }

        // 3. Idempotency Check
        // Si la acción es un borrado y ya está borrado, devolvemos éxito sin re-ejecutar.
        if (actionType.includes('DELETE') && snapshot.deleted_at) {
            if (isInternalTransaction) await client.query('COMMIT');
            return { success: true, snapshot, rowCount: 0, idempotent: true };
        }

        // 4. Log Willpower
        await client.query(`
            INSERT INTO user_actions (actor_id, action_type, target_type, target_id, snapshot)
            VALUES ($1, $2, $3, $4, $5)
        `, [actorId, actionType, targetType, targetId, snapshot]);

        // 5. Mutate
        let rowCount = 0;
        if (updateQuery) {
            // Nota: El query ya tiene el filtro por anonymous_id por seguridad extra, 
            // pero governance ya lo validó arriba.
            const mutateRes = await client.query(updateQuery, updateParams);
            rowCount = mutateRes.rowCount;
        }

        if (isInternalTransaction) await client.query('COMMIT');
        return { success: true, snapshot, rowCount };

    } catch (err) {
        if (isInternalTransaction) await client.query('ROLLBACK');

        // Propagar errores operacionales (4xx) sin loguearlos como errores críticos de sistema
        if (err instanceof NotFoundError || err instanceof ForbiddenError) {
            throw err;
        }

        logError(err, { context: 'M12_USER_ACTION_EXECUTE', params });
        throw err;
    } finally {
        if (isInternalTransaction) client.release();
    }
}
