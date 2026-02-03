// server/src/routes/reportLifecycle.js
import express from 'express';
import { reportLifecycleService } from '../services/reportLifecycleService.js';

import { logError } from '../utils/logger.js';
import { AppError } from '../utils/AppError.js';
import { ErrorCodes } from '../utils/errorCodes.js';

const router = express.Router();

// Middleware para asegurar que solo usuarios autorizados (staff/admin) pueden moderar.
// Por ahora usamos un check simple, suponiendo que solo Admin/Moderator tocan esto.
// Si "ciudadanos" pueden resolver sus propios reportes, ajustaremos.
// User Prompt: "resolveReport(reportId, actor, reason)" implies actor context.

const getActorFromReq = (req) => {
    // Unificar estructura de actor
    return {
        id: req.user?.id || req.headers['x-anonymous-id'], // Fallback a anonymous owner
        role: req.user?.role || 'citizen',
        sub: req.user?.sub
    };
};

/**
 * POST /api/reports/:id/resolve
 * Marca un reporte como resuelto.
 */
router.post('/:id/resolve', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const actor = getActorFromReq(req);

        const result = await reportLifecycleService.resolveReport(id, actor, reason);

        res.json({
            success: true,
            data: result,
            message: 'Report resolved successfully'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/reports/:id/reject
 * Rechaza un reporte (Spam, inválido, etc).
 */
router.post('/:id/reject', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const actor = getActorFromReq(req);

        const result = await reportLifecycleService.rejectReport(id, actor, reason);

        res.json({
            success: true,
            data: result,
            message: 'Report rejected successfully'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/reports/:id/process
 * Marca un reporte como "En Proceso" (Aceptado para gestión).
 */
router.post('/:id/process', async (req, res, next) => {
    try {
        const { id } = req.params;
        const actor = getActorFromReq(req);

        const result = await reportLifecycleService.processReport(id, actor);

        res.json({
            success: true,
            data: result,
            message: 'Report marked as in-process'
        });
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/reports/:id/close
 * Cierra un reporte (Estado final tras resolución o archivado).
 */
router.post('/:id/close', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const actor = getActorFromReq(req);

        const result = await reportLifecycleService.closeReport(id, actor, reason);

        res.json({
            success: true,
            data: result,
            message: 'Report closed'
        });
    } catch (error) {
        next(error);
    }
});

export default router;
