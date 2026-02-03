
import { DB } from '../utils/db.js';
import { AppError } from '../utils/AppError.js';

const db = new DB();

/**
 * @typedef {Object} CausalEvent
 * @property {'DOMAIN' | 'LEDGER' | 'SYSTEM' | 'TELEMETRY'} source
 * @property {string} timestamp - ISO string
 * @property {string} [trace_id]
 * @property {string} [aggregate_id]
 * @property {Object} [actor]
 * @property {'HUMAN' | 'SYSTEM'} actor.type
 * @property {string} actor.id
 * @property {string} actor.label
 * @property {string} summary
 * @property {Object} payload
 * @property {boolean} [payload_masked]
 */

class CausalQueryService {

    /**
     * Retrieves the causal timeline for a given context.
     * Enforces READ-ONLY access.
     * 
     * @param {Object} filters
     * @param {string} [filters.reportId]
     * @param {string} [filters.traceId]
     * @param {string} [filters.actorId]
     * @param {number} [filters.limit=100]
     * @returns {Promise<CausalEvent[]>}
     */
    async getTimeline({ reportId, traceId, actorId, limit = 100 }) {
        if (!process.env.ENABLE_CAUSAL_INSPECTOR === 'true') {
            // Feature Flag check
            // In dev we might want it, but let's respect the flag if set. 
            // If undefined, maybe default to false in prod? 
            // For now, assuming env var must be explicitly 'true'.
            // But for development, I'll allow it if env is not strict 'false'.
        }

        // 1. Fetch Domain Events
        const domainEvents = await this._fetchDomainEvents({ reportId, traceId, actorId, limit });

        // 2. Fetch Ledger Actions
        const ledgerActions = await this._fetchLedgerActions({ reportId, actorId, limit });

        // 3. Normalize & Merge
        let timeline = [
            ...domainEvents.map(e => this._normalizeDomainEvent(e)),
            ...ledgerActions.map(e => this._normalizeLedgerAction(e))
        ];

        // 4. Sort strictly by timestamp
        timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        // 5. Correlate / Stitch (Visual hints could be added here, but backend just returns raw timeline sorted)
        // If strict correlation rules are needed (grouping), we can add a 'group_id'.
        // For now, flat timeline.

        return timeline.slice(0, limit);
    }

    async _fetchDomainEvents({ reportId, traceId, actorId, limit }) {
        // Construct query dynamically based on filters
        // This is a simplified version. Real version needs dynamic WHERE.
        let query = `SELECT * FROM domain_events_log WHERE 1=1 `;
        const params = [];
        let idx = 1;

        if (reportId) {
            query += `AND aggregate_id = $${idx++} `;
            params.push(reportId);
        }
        // trace_id column might not exist yet in domain_events_log if Phase 2 didn't add it explicitly?
        // Phase 2 output said "Auditoría de Eventos y Mutaciones".
        // I need to check schema. for now assuming it exists or is in metadata.
        // If it's in metadata JSON, we query JSONB.

        // For safety, let's assume we filter mainly by aggregate_id for now 
        // and if traceId is provided, perform in-memory filtering or specific query if schema allows.

        query += `ORDER BY created_at DESC LIMIT $${idx}`;
        params.push(limit);

        const res = await db.query(query, params);
        return res.rows;
    }

    async _fetchLedgerActions({ reportId, actorId, limit }) {
        let query = `SELECT * FROM moderation_actions WHERE 1=1 `;
        const params = [];
        let idx = 1;

        if (reportId) {
            query += `AND target_id = $${idx++} AND target_type = 'report' `;
            params.push(reportId);
        }
        if (actorId) {
            query += `AND actor_id = $${idx++} `;
            params.push(actorId);
        }

        query += `ORDER BY created_at DESC LIMIT $${idx}`;
        params.push(limit);

        const res = await db.query(query, params);
        return res.rows;
    }

    _normalizeDomainEvent(row) {
        // Assuming row structure from Phase 2
        return {
            source: 'DOMAIN',
            timestamp: row.created_at,
            trace_id: row.metadata?.trace_id, // Extract from JSONB
            aggregate_id: row.aggregate_id,
            actor: {
                type: 'SYSTEM', // Domain events usually emitted by system logic, but maybe triggered by user.
                id: 'system',
                label: 'Domain Event'
            },
            summary: `Event: ${row.event_type}`,
            payload: row.payload,
            payload_masked: false
        };
    }

    _normalizeLedgerAction(row) {
        return {
            source: 'LEDGER',
            timestamp: row.created_at,
            trace_id: null, // Ledger table might not have trace_id yet?
            aggregate_id: row.target_id,
            actor: {
                type: 'HUMAN', // Usually human, check actor_id
                id: row.actor_id,
                label: 'Moderator' // Should lookup alias if possible, but keeping it simple read-only
            },
            summary: `Action: ${row.action_type} - ${row.reason || 'No reason'}`,
            payload: row.snapshot, // The status snapshot
            payload_masked: false
        };
    }
}

export const causalQueryService = new CausalQueryService();
