/**
 * 🔍 Admin Diagnostics Router
 * 
 * Endpoints para diagnóstico operativo del sistema de notificaciones.
 * ⚠️  DEV ONLY: En producción requieren autenticación de administrador
 */

import express from 'express';
import redis from '../config/redis.js';
import pool from '../config/database.js';
import { presenceTracker } from '../utils/presenceTracker.js';
import { NotificationQueue } from '../engine/NotificationQueue.js';
import { isPushConfigured } from '../utils/webPush.js';
import webpush from 'web-push';
import { strictAdminGateway } from '../utils/adminGateway.js';

const router = express.Router();

// 🔒 En producción, proteger todos los endpoints
if (process.env.NODE_ENV === 'production') {
    router.use(strictAdminGateway);
}

/**
 * GET /api/admin/push-health
 * Diagnóstico completo del sistema de push
 */
router.get('/push-health', async (req, res) => {
    const diagnostics = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        checks: {}
    };

    try {
        // 1. WebPush Config
        diagnostics.checks.webpush = {
            configured: isPushConfigured(),
            vapid_subject: process.env.VAPID_EMAIL || 'NOT SET',
            public_key_preview: process.env.VAPID_PUBLIC_KEY 
                ? `${process.env.VAPID_PUBLIC_KEY.substring(0, 20)}...` 
                : 'NOT SET'
        };

        // 2. Push Subscriptions
        const db = pool;
        const subsResult = await db.query(`
            SELECT 
                COUNT(*) FILTER (WHERE is_active = true) as active,
                COUNT(*) FILTER (WHERE is_active = false) as inactive,
                COUNT(DISTINCT anonymous_id) as unique_users,
                MAX(created_at) as newest_sub,
                MIN(created_at) as oldest_sub
            FROM push_subscriptions
        `);
        diagnostics.checks.subscriptions = subsResult.rows[0];

        // 3. Redis / Presence
        if (redis && redis.status === 'ready') {
            const onlineCount = await presenceTracker.getOnlineCount();
            diagnostics.checks.presence = {
                redis_status: 'ready',
                users_online_count: onlineCount,
                ttl_seconds: presenceTracker.TTL_SECONDS
            };

            // Listar usuarios online (solo en DEV, limitado)
            if (process.env.NODE_ENV !== 'production') {
                const onlineUsers = [];
                let cursor = '0';
                do {
                    const [newCursor, keys] = await redis.scan(
                        cursor, 
                        'MATCH', 
                        'presence:user:*', 
                        'COUNT', 
                        10
                    );
                    cursor = newCursor;
                    keys.forEach(key => {
                        const userId = key.replace('presence:user:', '');
                        onlineUsers.push(userId.substring(0, 8) + '...');
                    });
                } while (cursor !== '0' && onlineUsers.length < 10);
                diagnostics.checks.presence.online_users_sample = onlineUsers;
            }
        } else {
            diagnostics.checks.presence = {
                redis_status: redis ? redis.status : 'NOT CONNECTED',
                error: 'Redis no disponible - presence tracking fallará'
            };
        }

        // 4. BullMQ / Notification Queue
        try {
            const queue = NotificationQueue.getInternalQueue();
            const [waiting, active, completed, failed] = await Promise.all([
                queue.getWaitingCount(),
                queue.getActiveCount(),
                queue.getCompletedCount(),
                queue.getFailedCount()
            ]);
            
            diagnostics.checks.bullmq = {
                status: 'connected',
                jobs_waiting: waiting,
                jobs_active: active,
                jobs_completed: completed,
                jobs_failed: failed
            };

            // Últimos jobs fallidos (solo en DEV)
            if (failed > 0 && process.env.NODE_ENV !== 'production') {
                const failedJobs = await queue.getFailed(0, 5);
                diagnostics.checks.bullmq.recent_failures = failedJobs.map(j => ({
                    id: j.id,
                    type: j.data?.type,
                    traceId: j.data?.traceId,
                    failedReason: j.failedReason,
                    attemptsMade: j.attemptsMade,
                    timestamp: j.processedOn
                }));
            }
        } catch (queueErr) {
            diagnostics.checks.bullmq = {
                status: 'error',
                error: queueErr.message
            };
        }

        // 5. Notifications en DB (últimas 24h)
        const notifResult = await db.query(`
            SELECT 
                COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h,
                COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as last_1h,
                COUNT(*) FILTER (WHERE is_read = false) as total_unread
            FROM notifications
        `);
        diagnostics.checks.notifications = notifResult.rows[0];

        // 6. Decisiones de entrega recientes (lógica de negocio)
        // Esto es crítico: saber si el sistema está decidiendo SSE vs Push correctamente
        diagnostics.checks.delivery_logic = {
            explanation: 'Cuando presenceTracker.isOnline() = true → solo SSE\n' +
                        'Cuando presenceTracker.isOnline() = false → solo PUSH\n' +
                        'Si Redis no funciona → siempre false (siempre push)',
            recommendation: 'Verificar que usuarios con app abierta estén en online_users_sample'
        };

        // Status general
        const healthy = 
            diagnostics.checks.webpush.configured &&
            diagnostics.checks.subscriptions.active > 0 &&
            diagnostics.checks.bullmq.status === 'connected';

        diagnostics.healthy = healthy;
        diagnostics.status = healthy ? 'HEALTHY' : 'DEGRADED';

        res.status(healthy ? 200 : 503).json(diagnostics);

    } catch (err) {
        res.status(500).json({
            timestamp: new Date().toISOString(),
            status: 'ERROR',
            error: err.message,
            stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
        });
    }
});

/**
 * POST /api/admin/push-test
 * Fuerza el envío de una notificación push de prueba
 * 
 * Body: { anonymousId: string, message?: string }
 */
router.post('/push-test', async (req, res) => {
    const { anonymousId, message = 'Test notification from SafeSpot' } = req.body;
    
    if (!anonymousId) {
        return res.status(400).json({ error: 'anonymousId required' });
    }

    const results = {
        timestamp: new Date().toISOString(),
        target: anonymousId.substring(0, 8) + '...',
        steps: []
    };

    try {
        // Paso 1: Verificar suscripciones
        const db = pool;
        const subsResult = await db.query(
            'SELECT id, endpoint, p256dh, auth, is_active FROM push_subscriptions WHERE anonymous_id = $1',
            [anonymousId]
        );
        
        results.steps.push({
            step: 'CHECK_SUBSCRIPTIONS',
            status: subsResult.rows.length > 0 ? 'OK' : 'FAILED',
            count: subsResult.rows.length,
            subscriptions: subsResult.rows.map(s => ({
                id: s.id.substring(0, 8) + '...',
                is_active: s.is_active,
                endpoint_preview: s.endpoint.substring(0, 40) + '...'
            }))
        });

        if (subsResult.rows.length === 0) {
            results.status = 'FAILED';
            results.error = 'No push subscriptions found for this user';
            return res.status(404).json(results);
        }

        // Paso 2: Verificar presence
        const isOnline = await presenceTracker.isOnline(anonymousId);
        results.steps.push({
            step: 'CHECK_PRESENCE',
            status: 'OK',
            is_online: isOnline,
            explanation: isOnline 
                ? 'User appears ONLINE (will skip push in normal flow)'
                : 'User appears OFFLINE (will send push in normal flow)'
        });

        // Paso 3: Forzar envío push (ignorando presence)
        results.steps.push({
            step: 'SEND_PUSH',
            status: 'IN_PROGRESS',
            note: 'Sending to all active subscriptions...'
        });

        const sendResults = [];
        for (const sub of subsResult.rows.filter(s => s.is_active)) {
            try {
                const payload = JSON.stringify({
                    title: '🔔 Test Push',
                    body: message,
                    icon: '/icon-192x192.png',
                    badge: '/badge-72x72.png',
                    tag: 'test-' + Date.now(),
                    requireInteraction: true,
                    data: {
                        url: '/notifications',
                        test: true,
                        timestamp: Date.now()
                    }
                });

                await webpush.sendNotification({
                    endpoint: sub.endpoint,
                    keys: {
                        p256dh: sub.p256dh,
                        auth: sub.auth
                    }
                }, payload);

                sendResults.push({
                    subscription: sub.id.substring(0, 8) + '...',
                    status: 'SUCCESS',
                    http_status: 201
                });
            } catch (pushErr) {
                sendResults.push({
                    subscription: sub.id.substring(0, 8) + '...',
                    status: 'FAILED',
                    error: pushErr.message,
                    statusCode: pushErr.statusCode,
                    should_deactivate: pushErr.statusCode === 410
                });

                // Si es 410, desactivar automáticamente
                if (pushErr.statusCode === 410) {
                    await db.query(
                        'UPDATE push_subscriptions SET is_active = false WHERE id = $1',
                        [sub.id]
                    );
                }
            }
        }

        results.steps[2].status = 'COMPLETED';
        results.steps[2].results = sendResults;

        const successCount = sendResults.filter(r => r.status === 'SUCCESS').length;
        results.status = successCount > 0 ? 'SUCCESS' : 'FAILED';
        results.summary = {
            total: sendResults.length,
            successful: successCount,
            failed: sendResults.length - successCount
        };

        res.status(results.status === 'SUCCESS' ? 200 : 500).json(results);

    } catch (err) {
        results.status = 'ERROR';
        results.error = err.message;
        res.status(500).json(results);
    }
});

/**
 * POST /api/diagnostics/clean-push-test
 * Limpia suscripciones viejas para test limpio (DEV ONLY)
 */
router.post('/clean-push-test', async (req, res) => {
    const { anonymousId } = req.body;
    const targetId = anonymousId || 'e009f2a4-9860-4fbb-8de0-4321b9ae97ea';
    
    try {
        const db = pool;
        
        // 1. Contar antes
        const before = await db.query(
            'SELECT COUNT(*) as count FROM push_subscriptions WHERE anonymous_id = $1',
            [targetId]
        );
        
        // 2. Eliminar todas las suscripciones del usuario
        const deleted = await db.query(
            'DELETE FROM push_subscriptions WHERE anonymous_id = $1 RETURNING id',
            [targetId]
        );
        
        res.json({
            action: 'CLEAN_PUSH_SUBSCRIPTIONS',
            targetUser: targetId.substring(0, 8) + '...',
            beforeCount: parseInt(before.rows[0].count),
            deletedCount: deleted.rowCount,
            message: 'Suscripciones eliminadas. Ahora abrí la app y permití notificaciones.'
        });
        
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/diagnostics/push-force-send
 * Fuerza envío de push ignorando presence (debug/testing)
 */
router.post('/push-force-send', async (req, res) => {
    const { target, payload } = req.body;
    const anonymousId = target?.anonymousId;
    
    if (!anonymousId) {
        return res.status(400).json({ error: 'anonymousId required' });
    }

    try {
        // Importar WebPush
        const { sendPushNotification, createActivityNotificationPayload } = await import('../utils/webPush.js');
        const pool = (await import('../config/database.js')).default;
        
        // Obtener suscripciones (incluyendo inactivas para debug)
        const result = await pool.query(
            'SELECT id, endpoint, p256dh, auth, is_active FROM push_subscriptions WHERE anonymous_id = $1',
            [anonymousId]
        );
        
        const subscriptions = result.rows;
        
        if (subscriptions.length === 0) {
            return res.status(404).json({ 
                error: 'No subscriptions found',
                anonymousId: anonymousId.substring(0, 8) + '...'
            });
        }
        
        // Preparar payload
        const pushPayload = createActivityNotificationPayload({
            type: 'test',
            title: payload?.title || 'Test',
            message: payload?.message || 'Mensaje de prueba',
            deepLink: '/notifications'
        });
        
        // Enviar a TODAS las suscripciones (ignorando is_active)
        const results = [];
        for (const sub of subscriptions) {
            try {
                await sendPushNotification(
                    { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
                    pushPayload
                );
                results.push({ id: sub.id.substring(0, 8), status: 'SUCCESS', wasActive: sub.is_active });
                
                // Reactivar si estaba inactiva
                if (!sub.is_active) {
                    await pool.query('UPDATE push_subscriptions SET is_active = true WHERE id = $1', [sub.id]);
                }
            } catch (err) {
                results.push({ 
                    id: sub.id.substring(0, 8), 
                    status: 'FAILED', 
                    error: err.message,
                    code: err.statusCode,
                    wasActive: sub.is_active
                });
                
                // Desactivar si es 410
                if (err.statusCode === 410) {
                    await pool.query('UPDATE push_subscriptions SET is_active = false WHERE id = $1', [sub.id]);
                }
            }
        }
        
        res.json({
            timestamp: new Date().toISOString(),
            target: anonymousId.substring(0, 8) + '...',
            totalSubscriptions: subscriptions.length,
            results,
            summary: {
                success: results.filter(r => r.status === 'SUCCESS').length,
                failed: results.filter(r => r.status === 'FAILED').length
            }
        });
        
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/admin/presence-force-offline
 * Fuerza a un usuario a estado offline (emergencia/debug)
 * 
 * Body: { anonymousId: string }
 */
router.post('/presence-force-offline', async (req, res) => {
    const { anonymousId } = req.body;
    
    if (!anonymousId) {
        return res.status(400).json({ error: 'anonymousId required' });
    }

    try {
        // 1. Forzar desconexión
        await presenceTracker.trackDisconnect(anonymousId);
        
        // 2. Limpiar Redis manualmente
        if (redis && redis.status === 'ready') {
            await redis.del(`presence:user:${anonymousId}`);
            await redis.del(`presence:sessions:${anonymousId}`);
        }
        
        // 3. Verificar estado
        const isOnline = await presenceTracker.isOnline(anonymousId);
        
        res.json({
            anonymousId: anonymousId.substring(0, 8) + '...',
            action: 'forced_offline',
            previous_status: 'online (incorrect)',
            current_status: isOnline ? 'STILL ONLINE (ERROR)' : 'offline',
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/admin/presence-simulate
 * Simula cambios de presence para testing
 * 
 * Body: { anonymousId: string, action: 'online' | 'offline' }
 */
router.post('/presence-simulate', async (req, res) => {
    const { anonymousId, action } = req.body;
    
    if (!anonymousId || !['online', 'offline'].includes(action)) {
        return res.status(400).json({ error: 'Need anonymousId and action (online|offline)' });
    }

    try {
        if (action === 'online') {
            await presenceTracker.markOnline(anonymousId);
            await presenceTracker.trackConnect(anonymousId);
        } else {
            await presenceTracker.trackDisconnect(anonymousId);
        }

        const currentStatus = await presenceTracker.isOnline(anonymousId);
        
        res.json({
            action,
            anonymousId: anonymousId.substring(0, 8) + '...',
            current_status: currentStatus ? 'online' : 'offline',
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
