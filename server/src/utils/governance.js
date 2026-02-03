
import pool from '../config/database.js';
import { logError } from './logger.js';

const SYSTEM_ROOT_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

/**
 * executeModeration
 * Atomic Moderation Action (M12 Governance Engine)
 * 
 * Ensures: BEGIN -> Context Guard -> Snapshot -> Audit -> Mutate -> COMMIT
 */
export async function executeModeration(params) {
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

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

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
        await client.query(updateQuery, updateParams);

        await client.query('COMMIT');

        return {
            success: true,
            auditId: actionRecordId,
            snapshot
        };

    } catch (err) {
        await client.query('ROLLBACK');
        logError(err, { context: 'M12_GOVERNANCE_EXECUTE', params });
        throw err;
    } finally {
        client.release();
    }
}

/**
 * executeUserAction
 * Logs User Intent (Willpower) into user_actions ledger
 * Separate from Moderation (Coercion)
 */
export async function executeUserAction(params) {
    const {
        actorId, // Anonymous User ID
        targetType,
        targetId,
        actionType, // Semántico: 'USER_DELETE_SELF_REPORT', etc.
        updateQuery,
        updateParams
    } = params;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Snapshot
        const table = targetType === 'report' ? 'reports' : 'comments';
        const snapshotRes = await client.query(`SELECT * FROM ${table} WHERE id = $1 FOR UPDATE`, [targetId]);
        if (snapshotRes.rowCount === 0) throw new Error('Target not found');
        const snapshot = snapshotRes.rows[0];

        // 2. Log Willpower
        await client.query(`
            INSERT INTO user_actions (actor_id, action_type, target_type, target_id, snapshot)
            VALUES ($1, $2, $3, $4, $5)
        `, [actorId, actionType, targetType, targetId, snapshot]);

        // 3. Mutate
        if (updateQuery) {
            await client.query(updateQuery, updateParams);
        }

        await client.query('COMMIT');
        return { success: true, snapshot };

    } catch (err) {
        await client.query('ROLLBACK');
        logError(err, { context: 'M12_USER_ACTION_EXECUTE', params });
        throw err;
    } finally {
        client.release();
    }
}
