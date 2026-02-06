import 'dotenv/config';
import pool from '../../src/config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyTriggerFix() {
    const client = await pool.connect();
    try {
        console.log('\n========================================');
        console.log('🔧 Aplicando Fix del Trigger');
        console.log('========================================\n');

        console.log('📋 Problema identificado:');
        console.log('   - Trigger actual: AFTER INSERT OR DELETE');
        console.log('   - Trigger necesario: AFTER INSERT OR DELETE OR UPDATE');
        console.log('   - Soft delete (UPDATE deleted_at) NO actualiza contador\n');

        // Leer el archivo SQL
        const sqlPath = path.join(__dirname, 'fix_trigger_update.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('🚀 Ejecutando fix...\n');

        await client.query('BEGIN');

        // Ejecutar el script completo
        const result = await client.query(sql);

        await client.query('COMMIT');

        console.log('✅ Fix aplicado exitosamente!\n');

        // Verificar resultados
        console.log('\n========================================');
        console.log('📊 Validación Post-Fix');
        console.log('========================================\n');

        const statsResult = await client.query(`
            SELECT 
                COUNT(*) AS total_reports,
                SUM(CASE WHEN r.comments_count = real_count THEN 1 ELSE 0 END) AS consistent_reports,
                SUM(CASE WHEN r.comments_count <> real_count THEN 1 ELSE 0 END) AS inconsistent_reports,
                ROUND(100.0 * SUM(CASE WHEN r.comments_count = real_count THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2) AS consistency_percentage
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

        // Verificar trigger actualizado
        const triggerResult = await client.query(`
            SELECT 
                tgname AS trigger_name,
                pg_get_triggerdef(oid) AS trigger_definition
            FROM pg_trigger
            WHERE tgrelid = 'comments'::regclass
              AND tgname = 'trigger_update_report_comments';
        `);

        if (triggerResult.rows.length > 0) {
            console.log('✅ Trigger actualizado:');
            console.log(triggerResult.rows[0].trigger_definition);
            console.log('\n');
        }

        console.log('\n========================================');
        console.log('📋 RESULTADO FINAL');
        console.log('========================================\n');

        if (parseInt(stats.inconsistent_reports) === 0) {
            console.log('🎉 ÉXITO TOTAL:');
            console.log('   ✅ Trigger actualizado para incluir UPDATE');
            console.log('   ✅ Todos los contadores recalculados');
            console.log('   ✅ 100% de consistencia\n');
            console.log('🟢 CAPA 1 (DB) COMPLETADA');
            console.log('   Podés proceder a la Capa 2 (SSE)\n');
        } else {
            console.log('⚠️ Aún hay inconsistencias:');
            console.log(`   - ${stats.inconsistent_reports} reportes con contadores incorrectos`);
            console.log('   - Revisar logs para más detalles\n');
        }

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('\n❌ ERROR durante el fix:', error.message);
        console.error(error.stack);
    } finally {
        client.release();
        await pool.end();
    }
}

applyTriggerFix();
