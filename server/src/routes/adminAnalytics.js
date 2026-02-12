/**
 * ============================================================================
 * ADMIN ANALYTICS ROUTES - Fase 4
 * ============================================================================
 * 
 * Endpoint para consultar métricas agregadas (analytics_daily)
 * KPIs: DAU ayer, MAU, Stickiness, Total reports, Avg session duration
 */

import express from 'express';
import { supabaseAdmin } from '../utils/db.js';
import { verifyAdminToken } from '../utils/adminMiddleware.js';

const router = express.Router();

/**
 * GET /api/admin/analytics
 * 
 * Devuelve métricas diarias para el dashboard.
 * Query params:
 * - days: número de días a retornar (default: 30, max: 90)
 */
router.get('/', verifyAdminToken, async (req, res) => {
    try {
        const days = Math.min(parseInt(req.query.days) || 30, 90);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Obtener métricas diarias
        const { data: dailyMetrics, error } = await supabaseAdmin
            .from('analytics_daily')
            .select('*')
            .gte('date', startDate.toISOString().split('T')[0])
            .order('date', { ascending: true });

        if (error) {
            console.error('[AdminAnalytics] Error fetching metrics:', error);
            return res.status(500).json({ error: 'Failed to fetch analytics' });
        }

        // Obtener MAU actual (últimos 30 días)
        const { data: mauData } = await supabaseAdmin
            .rpc('calculate_mau', {
                p_date: new Date().toISOString().split('T')[0]
            });

        // DAU de ayer (último día calculado)
        const yesterdayDAU = dailyMetrics?.[dailyMetrics.length - 1]?.dau || 0;
        
        // Calcular stickiness: DAU / MAU
        const mau = mauData || 0;
        const stickiness = mau > 0 ? (yesterdayDAU / mau) : 0;

        // Avg session duration del período
        const avgDurationArray = dailyMetrics
            ?.filter(d => d.avg_session_duration_seconds)
            ?.map(d => d.avg_session_duration_seconds);
        
        const avgSessionDuration = avgDurationArray?.length > 0
            ? Math.round(avgDurationArray.reduce((a, b) => a + b, 0) / avgDurationArray.length)
            : 0;

        // KPIs (según feedback: DAU ayer, MAU, Stickiness, Totales)
        const kpis = {
            dau_yesterday: yesterdayDAU,
            mau: mau,
            stickiness: Math.round(stickiness * 100) / 100, // 0.15 = 15%
            total_reports: dailyMetrics?.reduce((sum, d) => sum + d.reports_created, 0) || 0,
            total_comments: dailyMetrics?.reduce((sum, d) => sum + d.comments_created, 0) || 0,
            total_votes: dailyMetrics?.reduce((sum, d) => sum + d.votes_cast, 0) || 0,
            avg_session_duration_seconds: avgSessionDuration,
        };

        // Formatear para gráficos de línea
        const timeSeries = {
            labels: dailyMetrics?.map(d => d.date) || [],
            datasets: {
                dau: dailyMetrics?.map(d => d.dau) || [],
                new_users: dailyMetrics?.map(d => d.new_users) || [],
                returning_users: dailyMetrics?.map(d => d.returning_users) || [],
            }
        };

        res.json({
            kpis,
            timeSeries,
            daily: dailyMetrics || []
        });

    } catch (err) {
        console.error('[AdminAnalytics] Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * GET /api/admin/analytics/export
 * 
 * Exporta métricas a CSV para descarga.
 * Query params:
 * - days: número de días (default: 30, max: 90)
 */
router.get('/export', verifyAdminToken, async (req, res) => {
    try {
        const days = Math.min(parseInt(req.query.days) || 30, 90);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const { data: dailyMetrics, error } = await supabaseAdmin
            .from('analytics_daily')
            .select('*')
            .gte('date', startDate.toISOString().split('T')[0])
            .order('date', { ascending: true });

        if (error) {
            console.error('[AdminAnalytics] Export error:', error);
            return res.status(500).json({ error: 'Failed to export analytics' });
        }

        // Generar CSV
        const headers = [
            'Date', 'DAU', 'New Users', 'Returning Users',
            'Total Sessions', 'Avg Session Duration (s)',
            'Reports Created', 'Comments Created', 'Votes Cast'
        ].join(',');

        const rows = dailyMetrics?.map(d => [
            d.date,
            d.dau,
            d.new_users,
            d.returning_users,
            d.total_sessions,
            d.avg_session_duration_seconds || 0,
            d.reports_created,
            d.comments_created,
            d.votes_cast
        ].join(',')).join('\n') || '';

        const csv = `${headers}\n${rows}`;

        // Headers para descarga
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="analytics-${new Date().toISOString().split('T')[0]}.csv"`);
        res.send(csv);

    } catch (err) {
        console.error('[AdminAnalytics] Export error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * POST /api/admin/analytics/run-cron
 * 
 * Ejecuta el job de analytics manualmente.
 * Para usar con Render Cron Jobs (llama a este endpoint).
 * Solo super_admin.
 */
router.post('/run-cron', verifyAdminToken, async (req, res) => {
    try {
        // Verificar super_admin
        if (req.adminUser?.role !== 'super_admin') {
            return res.status(403).json({ error: 'Super admin required' });
        }

        // Ejecutar job
        const { data, error } = await supabaseAdmin
            .rpc('run_daily_analytics_job');

        if (error) {
            console.error('[AdminAnalytics] Cron error:', error);
            return res.status(500).json({ error: 'Cron job failed' });
        }

        res.json({ 
            success: true, 
            message: `Analytics job completed. Calculated ${data} days.` 
        });

    } catch (err) {
        console.error('[AdminAnalytics] Cron error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * POST /api/admin/analytics/recalculate
 * 
 * Fuerza recálculo de métricas para una fecha específica.
 * Solo super_admin.
 */
router.post('/recalculate', verifyAdminToken, async (req, res) => {
    try {
        if (req.adminUser?.role !== 'super_admin') {
            return res.status(403).json({ error: 'Super admin required' });
        }

        const date = req.body.date || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const { error } = await supabaseAdmin
            .rpc('calculate_daily_metrics', { p_date: date });

        if (error) {
            console.error('[AdminAnalytics] Recalculate error:', error);
            return res.status(500).json({ error: 'Recalculation failed' });
        }

        res.json({ success: true, message: `Metrics recalculated for ${date}` });

    } catch (err) {
        console.error('[AdminAnalytics] Recalculate error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
