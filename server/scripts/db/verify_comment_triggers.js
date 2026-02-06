import 'dotenv/config';
import pool from '../../src/config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function verifyCommentTriggers() {
    const client = await pool.connect();
    try {
        console.log('\n========================================');
        console.log('🔍 PASO 1: Verificar Triggers Activos');
        console.log('========================================\n');

        const triggersResult = await client.query(`
            SELECT 
                tgname AS trigger_name,
                tgtype AS trigger_type,
                tgenabled AS enabled,
                pg_get_triggerdef(oid) AS trigger_definition
            FROM pg_trigger
            WHERE tgrelid = 'comments'::regclass
              AND tgname LIKE '%comment%'
            ORDER BY tgname;
        `);

        if (triggersResult.rows.length === 0) {
            console.log('❌ NO SE ENCONTRARON TRIGGERS activos en tabla comments');
            console.log('   Esto confirma que el contador NO se actualiza automáticamente.\n');
        } else {
            console.log(`✅ Encontrados ${triggersResult.rows.length} triggers:\n`);
            triggersResult.rows.forEach(row => {
                console.log(`   - ${row.trigger_name}`);
                console.log(`     Tipo: ${row.trigger_type}, Enabled: ${row.enabled}`);
                console.log(`     Definición: ${row.trigger_definition}\n`);
            });
        }

        console.log('\n========================================');
        console.log('🔍 PASO 2: Verificar Función del Trigger');
        console.log('========================================\n');

        const functionResult = await client.query(`
            SELECT 
                proname AS function_name,
                pg_get_functiondef(oid) AS function_definition
            FROM pg_proc
            WHERE proname = 'update_report_comments_count';
        `);

        if (functionResult.rows.length === 0) {
            console.log('❌ FUNCIÓN update_report_comments_count() NO EXISTE en DB');
            console.log('   Necesitás ejecutar fix_triggers_and_counters.sql\n');
        } else {
            console.log('✅ Función encontrada:\n');
            console.log(functionResult.rows[0].function_definition);
            console.log('\n');
        }

        console.log('\n========================================');
        console.log('🔍 PASO 3: Validar Consistencia del Contador');
        console.log('========================================\n');

        const inconsistentResult = await client.query(`
            SELECT 
                r.id AS report_id,
                r.title,
                r.comments_count AS stored_count,
                COUNT(c.id) AS real_count,
                (r.comments_count - COUNT(c.id)) AS difference
            FROM reports r
            LEFT JOIN comments c
              ON c.report_id = r.id
              AND c.deleted_at IS NULL
            GROUP BY r.id, r.title, r.comments_count
            HAVING r.comments_count <> COUNT(c.id)
            ORDER BY ABS(r.comments_count - COUNT(c.id)) DESC
            LIMIT 20;
        `);

        if (inconsistentResult.rows.length === 0) {
            console.log('✅ TODOS los contadores están consistentes!\n');
        } else {
            console.log(`❌ Encontrados ${inconsistentResult.rows.length} reportes con contadores inconsistentes:\n`);
            console.table(inconsistentResult.rows.map(row => ({
                'Report ID': row.report_id.substring(0, 8) + '...',
                'Title': row.title?.substring(0, 30) || 'Sin título',
                'Stored': row.stored_count,
                'Real': row.real_count,
                'Diff': row.difference
            })));
        }

        console.log('\n========================================');
        console.log('📊 PASO 4: Estadísticas Generales');
        console.log('========================================\n');

        const statsResult = await client.query(`
            SELECT 
                COUNT(*) AS total_reports,
                SUM(CASE WHEN r.comments_count = real_count THEN 1 ELSE 0 END) AS consistent_reports,
                SUM(CASE WHEN r.comments_count <> real_count THEN 1 ELSE 0 END) AS inconsistent_reports,
                ROUND(100.0 * SUM(CASE WHEN r.comments_count = real_count THEN 1 ELSE 0 END) / COUNT(*), 2) AS consistency_percentage
            FROM (
                SELECT 
                    r.id,
                    r.comments_count,
                    COUNT(c.id) AS real_count
                FROM reports r
                LEFT JOIN comments c ON c.report_id = r.id AND c.deleted_at IS NULL
                GROUP BY r.id, r.comments_count
            ) AS stats;
        `);

        const stats = statsResult.rows[0];
        console.log(`Total de reportes: ${stats.total_reports}`);
        console.log(`Reportes consistentes: ${stats.consistent_reports}`);
        console.log(`Reportes inconsistentes: ${stats.inconsistent_reports}`);
        console.log(`Porcentaje de consistencia: ${stats.consistency_percentage}%\n`);

        console.log('\n========================================');
        console.log('📋 RESUMEN Y PRÓXIMOS PASOS');
        console.log('========================================\n');

        if (triggersResult.rows.length === 0) {
            console.log('🔴 ACCIÓN REQUERIDA:');
            console.log('   1. Ejecutar: psql -d <database> -f server/scripts/db/fix_triggers_and_counters.sql');
            console.log('   2. Esto creará los triggers y recalculará los contadores');
            console.log('   3. Volver a ejecutar este script para validar\n');
        } else if (parseInt(stats.inconsistent_reports) > 0) {
            console.log('🟠 TRIGGERS EXISTEN pero hay inconsistencias:');
            console.log('   1. Ejecutar: psql -d <database> -f server/scripts/db/fix_triggers_and_counters.sql');
            console.log('   2. Esto recalculará los contadores existentes\n');
        } else {
            console.log('✅ TODO CORRECTO:');
            console.log('   - Triggers activos');
            console.log('   - Contadores consistentes');
            console.log('   - Podés proceder a la Capa 2 (SSE)\n');
        }

    } catch (error) {
        console.error('\n❌ ERROR durante la verificación:', error.message);
        console.error(error.stack);
    } finally {
        client.release();
        await pool.end();
    }
}

verifyCommentTriggers();
