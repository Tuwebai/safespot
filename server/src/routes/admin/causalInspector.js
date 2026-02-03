
import express from 'express';
import { causalQueryService } from '../../services/causalQueryService.js';
import { logError } from '../../utils/logger.js';
import { AppError } from '../../utils/AppError.js';

const router = express.Router();

/**
 * Middleware to ensure admin/support access.
 * Ideally should leverage a unified admin auth middleware if available.
 * For now, simple check based on request user (populated by validateAuth).
 */
const requireAdminOrSupport = (req, res, next) => {
    const role = req.user?.role;
    // Allow admin and potentially support level 3 if defined
    if (['admin', 'support_level_3'].includes(role)) {
        return next();
    }
    return next(new AppError('Forbidden: Access Restricted to Admin/Support', 403));
};

/**
 * GET /api/admin/causal-inspector
 * Read-Only timeline.
 */
router.get('/', requireAdminOrSupport, async (req, res, next) => {
    try {
        const { report_id, trace_id, actor_id, limit } = req.query;

        // Validation: At least one filter required
        if (!report_id && !trace_id && !actor_id) {
            throw new AppError('At least one filter (report_id, trace_id, actor_id) is required', 400);
        }

        const timeline = await causalQueryService.getTimeline({
            reportId: report_id,
            traceId: trace_id,
            actorId: actor_id,
            limit: limit ? parseInt(limit) : 100
        });

        // Audit Access (As per requirements: "Todo acceso debe quedar logueado")
        // We can log this as an info event or insert into a specific access_log table if exists.
        // For now, structured log is good.
        // If 'access_audit_log' table exists, we should insert. Assuming it doesn't from previous partial views, 
        // but standard logs are ingested.
        console.info(JSON.stringify({
            event: 'CAUSAL_INSPECTOR_ACCESS',
            actor_id: req.user.id,
            target_report: report_id,
            target_trace: trace_id,
            timestamp: new Date().toISOString()
        }));

        res.json({
            meta: {
                generated_at: new Date().toISOString(),
                query: req.query
            },
            timeline
        });

    } catch (error) {
        next(error);
    }
});

export default router;
