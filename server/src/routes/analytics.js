/**
 * ============================================================================
 * ANALYTICS TRACKING ROUTES - Fase 1
 * ============================================================================
 * 
 * Endpoint público para recibir eventos de analytics desde el frontend.
 * Diseñado para ser rápido y no bloqueante.
 * 
 * Fase 1: Solo 4 eventos permitidos
 * - page_view
 * - report_create_success
 * - comment_create
 * - vote_cast
 */

import express from 'express';
import { supabaseAdmin } from '../utils/db.js';
import { analyticsLimiter } from '../utils/rateLimiter.js';

const router = express.Router();

// Eventos permitidos en Fase 1
const ALLOWED_EVENTS = new Set([
    'page_view',
    'report_create_success',
    'comment_create',
    'vote_cast'
]);

/**
 * POST /api/analytics/track
 * 
 * Recibe un evento de analytics y lo persiste.
 * Diseñado para ser "fire and forget" - no bloquea al usuario.
 */
router.post('/track', analyticsLimiter, async (req, res) => {
    const startTime = Date.now();
    
    try {
        const {
            anonymous_id,
            session_id,
            event_id,
            event_type,
            page_path,
            page_title,
            metadata = {}
        } = req.body;

        // Validaciones básicas
        if (!anonymous_id || !session_id || !event_type || !event_id) {
            return res.status(400).json({ 
                error: 'Missing required fields: anonymous_id, session_id, event_id, event_type' 
            });
        }

        // Solo eventos permitidos en Fase 1
        if (!ALLOWED_EVENTS.has(event_type)) {
            return res.status(400).json({ 
                error: 'Event type not allowed in current phase',
                allowed: Array.from(ALLOWED_EVENTS)
            });
        }

        // Validar UUID básico
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(anonymous_id)) {
            return res.status(400).json({ error: 'Invalid anonymous_id format' });
        }

        // Insertar evento (fire and forget para el cliente)
        const { error } = await supabaseAdmin
            .from('analytics_events')
            .insert({
                event_id,
                anonymous_id,
                session_id,
                event_type,
                page_path: page_path?.substring(0, 255) || null,
                page_title: page_title?.substring(0, 255) || null,
                metadata,
                occurred_at: new Date().toISOString()
            });

        if (error) {
            // Log interno pero no exponer al cliente
            console.error('[Analytics] Insert error:', error.message);
            
            // Si es error de duplicado, es OK (evento ya registrado)
            if (error.code === '23505') {
                return res.status(200).json({ status: 'duplicate_ignored' });
            }
            
            // Otros errores: responder 200 para no afectar UX
            return res.status(200).json({ status: 'logged' });
        }

        // Actualizar contador de eventos en sesión (async, no bloqueante)
        updateSessionEvents(session_id).catch(() => {});

        const duration = Date.now() - startTime;
        if (duration > 100) {
            console.warn(`[Analytics] Slow track: ${duration}ms`);
        }

        return res.status(200).json({ status: 'ok' });

    } catch (err) {
        console.error('[Analytics] Track error:', err.message);
        return res.status(200).json({ status: 'logged' });
    }
});

/**
 * POST /api/analytics/session
 * 
 * Inicia o actualiza una sesión de analytics.
 * Llamado al inicio de sesión y al final (heartbeat).
 */
router.post('/session', analyticsLimiter, async (req, res) => {
    try {
        const {
            anonymous_id,
            session_id,
            action, // 'start' | 'end' | 'heartbeat'
            device_type,
            os,
            browser,
            referrer,
            landing_page
        } = req.body;

        if (!anonymous_id || !session_id || !action) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (action === 'start') {
            // Insertar nueva sesión (ignorar duplicados)
            const { error } = await supabaseAdmin
                .from('analytics_sessions')
                .insert({
                    anonymous_id,
                    session_id,
                    device_type: device_type || 'unknown',
                    os: os?.substring(0, 50),
                    browser: browser?.substring(0, 50),
                    referrer: referrer?.substring(0, 500),
                    landing_page: landing_page?.substring(0, 255),
                    started_at: new Date().toISOString()
                });

            if (error && error.code !== '23505') {
                console.error('[Analytics] Session start error:', error.message);
            }
        } 
        else if (action === 'end') {
            // Calcular duración y cerrar sesión
            const { data: session } = await supabaseAdmin
                .from('analytics_sessions')
                .select('started_at, events_count')
                .eq('session_id', session_id)
                .single();

            if (session) {
                const startedAt = new Date(session.started_at);
                const endedAt = new Date();
                const durationSeconds = Math.floor((endedAt - startedAt) / 1000);

                await supabaseAdmin
                    .from('analytics_sessions')
                    .update({
                        ended_at: endedAt.toISOString(),
                        duration_seconds: durationSeconds
                    })
                    .eq('session_id', session_id);
            }
        }

        return res.status(200).json({ status: 'ok' });

    } catch (err) {
        console.error('[Analytics] Session error:', err.message);
        return res.status(200).json({ status: 'logged' });
    }
});

/**
 * Actualiza el contador de eventos en una sesión.
 * Función interna, no bloqueante.
 */
async function updateSessionEvents(sessionId) {
    try {
        const { data: session } = await supabaseAdmin
            .from('analytics_sessions')
            .select('events_count')
            .eq('session_id', sessionId)
            .single();

        if (session) {
            await supabaseAdmin
                .from('analytics_sessions')
                .update({ 
                    events_count: (session.events_count || 0) + 1 
                })
                .eq('session_id', sessionId);
        }
    } catch {
        // Silenciar errores - no crítico
    }
}

export default router;
