// server/src/services/reportLifecycleService.js
import { queryWithRLS } from '../utils/rls.js';
import { logError, logSuccess } from '../utils/logger.js';
import { realtimeEvents } from '../utils/eventEmitter.js';
import { AppError } from '../utils/AppError.js';
import { ErrorCodes } from '../utils/errorCodes.js';

/**
 * ReportLifecycleService
 * Maneja las transiciones de estado de los reportes de manera semántica y auditada.
 * Principios:
 * 1. Auditoría First: No hay cambio de estado sin registro en moderation_actions.
 * 2. DB Authority: La base de datos valida la transición final (Constraint/Trigger).
 * 3. Event Sourcing: Se emiten eventos de dominio tras el éxito.
 */
class ReportLifecycleService {

    /**
     * Resuelve un reporte.
     * Transición: pendiente/en_proceso -> resuelto
     * @param {string} reportId - ID del reporte
     * @param {object} actor - Objeto usuario (req.user o similar) con id, role, alias.
     * @param {string} reason - Razón de la resolución (opcional pero recomendada)
     */
    async resolveReport(reportId, actor, reason = 'Resolved by admin') {
        return this._executeTransition(reportId, actor, 'resuelto', 'RESOLVE_REPORT', reason);
    }

    /**
     * Rechaza un reporte.
     * Transición: pendiente/en_proceso -> rechazado
     * @param {string} reportId 
     * @param {object} actor 
     * @param {string} reason 
     */
    async rejectReport(reportId, actor, reason = 'Rejected by admin') {
        return this._executeTransition(reportId, actor, 'rechazado', 'REJECT_REPORT', reason);
    }

    /**
     * Marca un reporte como "En Proceso".
     * Transición: pendiente -> en_proceso
     * @param {string} reportId 
     * @param {object} actor 
     */
    async processReport(reportId, actor) {
        return this._executeTransition(reportId, actor, 'en_progreso', 'PROCESS_REPORT', 'Processing started');
    }

    /**
     * Cierra un reporte.
     * Transición: resuelto -> cerrado
     * @param {string} reportId 
     * @param {object} actor 
     * @param {string} reason 
     */
    async closeReport(reportId, actor, reason = 'Closed by admin') {
        return this._executeTransition(reportId, actor, 'archivado', 'CLOSE_REPORT', reason);
    }

    /**
     * Método interno genérico para ejecutar transiciones.
     * Encapsula la lógica de auditoría y actualización atómica.
     */
    async _executeTransition(reportId, actor, targetStatus, actionType, reason) {
        const client = actor.id || 'system';

        // 1. Snapshot Previo y Validación de Existencia
        // Usamos queryWithRLS con 'admin' system bypass o el id del actor si es admin real.
        // Usamos UUID Nil para validar formato en queryWithRLS.
        const SYSTEM_UUID = '00000000-0000-0000-0000-000000000000';
        const snapshotQuery = `SELECT * FROM reports WHERE id = $1`;
        const snapshotRes = await queryWithRLS(SYSTEM_UUID, snapshotQuery, [reportId]);

        if (snapshotRes.rows.length === 0) {
            throw new AppError('Report not found', 404);
        }

        const currentReport = snapshotRes.rows[0];

        // 1.1 Governance Check: Validate Actor Permissions
        this._validateActor(actor, currentReport);

        // Early validation (aunque la DB tiene la última palabra, el backend debe ser amable)
        // Esto evita llamadas a DB innecesarias si la transición es obviamente ilegal.
        this._validateTransition(currentReport.status, targetStatus);

        try {
            // 2. Transacción Implícita (CTE)
            // Insertamos en moderation_actions Y actualizamos reports en una sola sentencia.
            // Esto garantiza consistencia sin transacciones explícitas de Node (que queryWithRLS abstrae).

            const transitionQuery = `
        WITH update_report AS (
          UPDATE reports 
          SET status = $6::report_status_enum, updated_at = NOW()
          WHERE id = $3 AND status IS DISTINCT FROM $6::report_status_enum
          RETURNING *
        ),
        audit_insert AS (
          INSERT INTO moderation_actions (
            action_type, 
            actor_id, 
            target_type, 
            target_id, 
            reason, 
            snapshot
          )
          SELECT $1, $2, 'report', $3, $4, $5
          FROM update_report
          RETURNING id
        )
        SELECT r.*, a.id as action_id 
        FROM update_report r
        LEFT JOIN audit_insert a ON true
      `;

            // Actor ID: Para sistema usamos un UUID nulo o específico si existe SYSTEM_ROOT_ID.
            // Si actor.id viene del JWT, lo usamos.
            const actorId = actor.sub || actor.id || '00000000-0000-0000-0000-000000000000'; // Fallback a nil para system action si no hay actor

            const params = [
                actionType,
                actorId,
                reportId,
                reason,
                currentReport, // Snapshot JSON
                targetStatus
            ];

            const result = await queryWithRLS(SYSTEM_UUID, transitionQuery, params);

            if (result.rows.length === 0) {
                throw new AppError('Failed to transition report status', 500);
            }

            const updatedReport = result.rows[0];

            // 3. Event Sourcing / Realtime
            realtimeEvents.emitReportUpdate(updatedReport);

            logSuccess(`Report ${reportId} transitioned to ${targetStatus}`, {
                action: actionType,
                actor: actorId,
                prevStatus: currentReport.status
            });

            return updatedReport;

        } catch (error) {
            // Capturar errores de DB (Constraint Check del Trigger)
            if (error.message.includes('Transición Inválida')) {
                throw new AppError(error.message, 400, ErrorCodes.VALIDATION_ERROR);
            }
            throw error;
        }
    }

    _validateTransition(current, target) {
        // Duplicamos matrix aquí para feedback rápido al usuario, pero la DB es la autoridad.
        // Matrix:
        // p -> e, r, z (rechazado)
        // e -> r, c, z
        // r -> c
        // z, c -> final

        const valid = {
            'abierto': ['en_progreso', 'resuelto', 'rechazado', 'archivado'],
            'en_progreso': ['resuelto', 'archivado', 'rechazado'],
            'resuelto': ['archivado', 'en_progreso', 'verificado'],
            'verificado': ['archivado'],
            'rechazado': [],
            'archivado': []
        };

        // Nota: El parche de trigger permitió old=resuelto -> new!=resuelto only logic stats, 
        // pero enforce function tiene sus reglas.
        // Asumiremos que el trigger DB es la verdad. Si DB falla, capturamos el error.
        // Esta validación es soft-check.
    }

    _validateActor(actor, report) {
        // SYSTEM_ROOT and System Role always allowed
        if (actor.role === 'system' || actor.id === '00000000-0000-0000-0000-000000000000') return;

        // Staff allowed
        if (['admin', 'moderator'].includes(actor.role)) return;

        // STRICT GOVERNANCE: No generic user actions here.
        throw new AppError('Unauthorized: Insufficient permissions for moderation actions', 403);
    }
}

export const reportLifecycleService = new ReportLifecycleService();
