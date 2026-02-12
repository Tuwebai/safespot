/**
 * ============================================================================
 * ANALYTICS DAILY JOB
 * ============================================================================
 * 
 * Job para calcular métricas diarias. Debe ejecutarse una vez al día,
 * preferiblemente a las 00:05 (5 minutos después de medianoche).
 * 
 * Ejecución manual:
 *   node server/src/jobs/analyticsJob.js
 * 
 * Configuración con cron (ejemplo):
 *   5 0 * * * cd /path/to/app && node server/src/jobs/analyticsJob.js
 */

import { supabaseAdmin } from '../utils/db.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

async function runAnalyticsJob() {
    const startTime = Date.now();
    console.log(`[AnalyticsJob] Starting at ${new Date().toISOString()}`);

    try {
        // Ejecutar función SQL que calcula últimos 3 días
        const { data, error } = await supabaseAdmin
            .rpc('run_daily_analytics_job');

        if (error) {
            console.error('[AnalyticsJob] Error:', error);
            process.exit(1);
        }

        const duration = Date.now() - startTime;
        console.log(`[AnalyticsJob] Completed. Calculated ${data} days in ${duration}ms`);
        process.exit(0);

    } catch (err) {
        console.error('[AnalyticsJob] Fatal error:', err);
        process.exit(1);
    }
}

// Si se ejecuta directamente (no importado)
if (import.meta.url === `file://${process.argv[1]}`) {
    runAnalyticsJob();
}

export { runAnalyticsJob };
