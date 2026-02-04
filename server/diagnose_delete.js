
import 'dotenv/config';
import pool from './src/config/database.js';
import { executeUserAction } from './src/utils/governance.js';

async function diagnoseDelete() {
    const reportId = process.argv[2];
    const anonymousId = process.argv[3];

    if (!reportId || !anonymousId) {
        console.error('Usage: node diagnose_delete.js <reportId> <anonymousId>');
        process.exit(1);
    }

    try {
        console.log(`--- Iniciando Diagnóstico de DELETE ---`);
        console.log(`Report ID: ${reportId}`);
        console.log(`Anonymous ID: ${anonymousId}`);

        // 1. Verificar existencia y estado inicial
        const initial = await pool.query('SELECT id, anonymous_id, deleted_at FROM reports WHERE id = $1', [reportId]);
        if (initial.rows.length === 0) {
            console.log('❌ Error: El reporte no existe en la base de datos.');
            process.exit(1);
        }
        console.log('✅ Estado inicial:', initial.rows[0]);

        // 2. Ejecutar Acción de Usuario (DELETE)
        console.log('Ejecutando executeUserAction...');
        const result = await executeUserAction({
            actorId: anonymousId,
            targetType: 'report',
            targetId: reportId,
            actionType: 'USER_DELETE_SELF_REPORT',
            updateQuery: `UPDATE reports SET deleted_at = NOW() WHERE id = $1 AND anonymous_id = $2 AND deleted_at IS NULL`,
            updateParams: [reportId, anonymousId]
        });

        console.log('✅ executeUserAction finalizado.');

        // 3. Verificar persistencia INMEDIATA
        const after = await pool.query('SELECT id, anonymous_id, deleted_at FROM reports WHERE id = $1', [reportId]);
        console.log('🔍 Estado post-delete (SELECT directo):', after.rows[0]);

        if (after.rows[0].deleted_at) {
            console.log('✅ Persistencia confirmada: deleted_at tiene valor.');
        } else {
            console.log('❌ Falla de persistencia: deleted_at sigue siendo NULL.');
            if (after.rows[0].anonymous_id !== anonymousId) {
                console.log(`❗ Causa detectada: El anonymous_id proporcionado (${anonymousId}) no coincide con el dueño (${after.rows[0].anonymous_id}).`);
            }
        }

        process.exit(0);
    } catch (err) {
        console.error('❌ Error durante el diagnóstico:', err);
        process.exit(1);
    }
}

diagnoseDelete();
