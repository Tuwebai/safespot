
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-change-this';

/**
 * strictAdminGateway
 * Enterprise-grade Access Control for /api/admin
 * 
 * Logic:
 * 1. Missing Token -> 401 Unauthorized
 * 2. Invalid Token -> 401 Unauthorized
 * 3. Valid Token BUT not Admin -> 403 Forbidden
 * 4. Log all attempts (Success/Failure) in admin_access_logs
 */
export const strictAdminGateway = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    // ✅ ENTERPRISE: Support token via Header, Query 't' (boot) or Cookie (modules/assets)
    const token = (authHeader && authHeader.startsWith('Bearer '))
        ? authHeader.split(' ')[1]
        : (req.query.t || req.cookies?.admin_jwt);


    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const ua = req.headers['user-agent'] || 'unknown';

    // 1. Check Token Presence
    if (!token) {
        // Only log if it's explicitly an admin route to avoid noise
        await logAccessAttempt(null, 'Missing Authorization (Header or Query)', ip, ua, false);
        return res.status(401).json({ error: 'Authentication Required' });
    }


    try {
        // 2. JWT Verification
        const decoded = jwt.verify(token, JWT_SECRET);

        // 3. Role Authorization
        const allowedRoles = ['admin', 'super_admin'];
        if (!allowedRoles.includes(decoded.role)) {
            await logAccessAttempt(decoded.id, 'Insufficient Permissions (Forbidden Access)', ip, ua, false);
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Admin authority required for this sector.'
            });
        }

        // 4. Attach Identity to Request
        req.adminUser = decoded;

        // Note: Success logging is handled by the Login flow. 
        // We avoid logging EVERY single API call here to prevent DB bloat, 
        // but it could be enabled for critical endpoints.

        next();
    } catch (err) {
        console.error('[SECURITY] Admin Gateway rejection:', err.message);
        await logAccessAttempt(null, `Invalid Token: ${err.message}`, ip, ua, false);
        return res.status(401).json({ error: 'Session Expired or Invalid' });
    }
};

/**
 * Internal helper to log access attempts to the DB
 */
async function logAccessAttempt(adminId, reason, ip, ua, success) {
    try {
        await supabaseAdmin.from('admin_access_logs').insert({
            admin_id: adminId,
            attempt_email: 'GATEWAY_INTERCEPTION',
            ip_address: ip,
            user_agent: ua,
            success: success,
            failure_reason: reason,
            auth_context: 'GATEWAY'
        });
    } catch (logErr) {
        console.error('Failed to log security access attempt:', logErr.message);
    }
}
