
import pool from '../config/database.js';
import { logError } from '../utils/logger.js';
import crypto from 'crypto';

/**
 * EventStore Service (M9/11)
 * Autoridad de persistencia para Event-Sourcing
 */
class EventStore {
    async append(params) {
        if (process.env.EVENT_SOURCED_CATCHUP_ENABLED !== 'true') return null;

        const {
            aggregate_type,
            aggregate_id,
            event_type,
            payload,
            metadata = {}
        } = params;

        // Guardrail 2: Ephemeral signals NO van al EventStore
        const ephemeralTypes = ['typing', 'presence', 'ui-hint'];
        if (ephemeralTypes.includes(event_type)) return null;

        const event_id = payload.eventId || crypto.randomUUID();

        try {
            const query = `
                INSERT INTO domain_events_log (
                    event_id, aggregate_type, aggregate_id, 
                    event_type, payload, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING sequence_id
            `;
            const values = [
                event_id,
                aggregate_type,
                aggregate_id,
                event_type,
                payload,
                metadata
            ];

            const res = await pool.query(query, values);
            return res.rows[0].sequence_id;

        } catch (err) {
            // [CRITICAL] Guardrail 1: Si falla el insert, logeamos pero el sistema decide si abortar
            logError(err, { context: 'EVENT_STORE_APPEND_FAIL', params });
            // Devolvemos el error para que el emitter pueda decidir si continuar (fire-and-forget degradado) 
            // o abortar la mutación según la severidad.
            throw err;
        }
    }

    /**
     * Obtener eventos perdidos para un cliente
     * @param {number} sinceId - El último sequence_id procesado por el cliente
     * @param {number} limit - Límite de seguridad
     */
    async getCatchup(sinceId, limit = 100) {
        try {
            const query = `
                SELECT * FROM domain_events_log
                WHERE sequence_id > $1
                ORDER BY sequence_id ASC
                LIMIT $2
            `;
            const res = await pool.query(query, [sinceId, limit]);

            // Post-processing: Filter PII/Privacy for general catchup if needed
            // currently whitelist handles this.

            return res.rows;
        } catch (err) {
            logError(err, { context: 'EVENT_STORE_GET_CATCHUP', sinceId });
            return [];
        }
    }
}

export const eventStore = new EventStore();
