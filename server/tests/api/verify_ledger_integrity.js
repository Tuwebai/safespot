
import { reportLifecycleService } from '../../src/services/reportLifecycleService.js';
import { DB } from '../../src/utils/db.js';
import { AppError } from '../../src/utils/AppError.js';

// Mock DB client setup if necessary, but we can reuse the real DB util which reads env
// We need to ensure we are connected.

const db = new DB();

async function runLedgerTests() {
    console.log('📜 Iniciando Ledger Integrity Suite...');

    const testValues = {
        title: 'LEDGER_TEST_REPORT',
        description: 'Report for ledger verification',
        latitude: 0,
        longitude: 0,
        anonymous_id: '00000000-0000-0000-0000-000000000000',
        status: 'pendiente',
        category: 'robo',
        zone: 'Córdoba',
        address: 'Test Addr'
    };

    let reportId;
    const adminActor = { id: '00000000-0000-0000-0000-000000000000', role: 'admin', alias: 'TestAdmin' };

    try {
        // 1. SETUP: Crear reporte
        const insertRes = await db.query(
            `INSERT INTO reports (title, description, latitude, longitude, anonymous_id, status, category, zone, address) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
            [testValues.title, testValues.description, testValues.latitude, testValues.longitude, testValues.anonymous_id, testValues.status, testValues.category, testValues.zone, testValues.address]
        );
        reportId = insertRes.rows[0].id;
        console.log(`📝 Reporte creado: ${reportId}`);

        // 2. TEST: Process Transition (Pendiente -> En Proceso)
        console.log('\n🧪 Testing PROCESS transition...');
        await reportLifecycleService.processReport(reportId, adminActor);

        // Verify Ledger
        let audit = await db.query(
            `SELECT * FROM moderation_actions WHERE target_id = $1 AND action_type = 'PROCESS_REPORT'`,
            [reportId]
        );

        if (audit.rows.length !== 1) throw new Error('❌ Falta registro de auditoría para PROCESS');
        if (audit.rows[0].snapshot.status !== 'pendiente') throw new Error('❌ Snapshot incorrecto (debería ser pendiente)');
        console.log('✅ Ledger Check: PROCESS_REPORT validado.');

        // 3. TEST: Resolve Transition (En Proceso -> Resuelto)
        console.log('\n🧪 Testing RESOLVE transition...');
        const resolveReason = 'Fixed issue';
        await reportLifecycleService.resolveReport(reportId, adminActor, resolveReason);

        audit = await db.query(
            `SELECT * FROM moderation_actions WHERE target_id = $1 AND action_type = 'RESOLVE_REPORT'`,
            [reportId]
        );

        if (audit.rows.length !== 1) throw new Error('❌ Falta registro de auditoría para RESOLVE');
        if (audit.rows[0].snapshot.status !== 'en_proceso') throw new Error('❌ Snapshot incorrecto (debería ser en_proceso)');
        if (audit.rows[0].reason !== resolveReason) throw new Error('❌ Razón de resolución no coincide');
        console.log('✅ Ledger Check: RESOLVE_REPORT validado.');

        // 4. TEST: Close Transition (Resuelto -> Cerrado)
        console.log('\n🧪 Testing CLOSE transition...');
        await reportLifecycleService.closeReport(reportId, adminActor);

        audit = await db.query(
            `SELECT * FROM moderation_actions WHERE target_id = $1 AND action_type = 'CLOSE_REPORT'`,
            [reportId]
        );

        if (audit.rows.length !== 1) throw new Error('❌ Falta registro de auditoría para CLOSE');
        console.log('✅ Ledger Check: CLOSE_REPORT validado.');


        // 5. TEST: Concurrency / Duplication Check (Excellence Level)
        console.log('\n🧪 Testing REJECT transition concurrency (Creating new report)...');

        // Create new report for concurrency test
        const insertRes2 = await db.query(
            `INSERT INTO reports (title, description, latitude, longitude, anonymous_id, status, category, zone, address) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
            ['CONCURRENCY_TEST', 'Desc', 0, 0, '00000000-0000-0000-0000-000000000000', 'pendiente', 'robo', 'Córdoba', 'Addr']
        );
        const reportId2 = insertRes2.rows[0].id;

        // Simulate double click logic (race condition)
        // Both try to reject. Only one should succeed? Or both if valid?
        // Status idempotent? P -> R (Valid). P -> R (Valid if simultaneous reading P?)
        // DB Locked? 
        // Actually, reportLifecycleService uses queryWithRLS which might not serialize perfectly unless we lock row.
        // BUT the UPDATE CTE has `WHERE id = ...`. PG isolation level defaults to Read Committed. 
        // Update takes lock. Second update waits.
        // Second update sees NEW status. Status is Repetido (Rechazado)? 
        // Trigger should block transition Rejected -> Rejected (Final state loop? No, Rejected is final).
        // Let's see if we get duplicate logs or one failure.

        try {
            await Promise.all([
                reportLifecycleService.rejectReport(reportId2, adminActor, 'Race 1'),
                reportLifecycleService.rejectReport(reportId2, adminActor, 'Race 2')
            ]);
            console.log('⚠️ Ambos rechazos completaron sin error (Posible duplicación si lógica lo permite)');
        } catch (e) {
            console.log(`✅ Race Condition capturada: ${e.message}`);
        }

        // Verify only ONE audit log exists
        audit = await db.query(
            `SELECT * FROM moderation_actions WHERE target_id = $1 AND action_type = 'REJECT_REPORT'`,
            [reportId2]
        );

        if (audit.rows.length > 1) {
            console.error('❌ FAILURE: Filas de auditoría duplicadas detectadas en concurrencia.');
            console.error(audit.rows);
            process.exit(1);
        } else {
            console.log(`✅ Concurrency Check: ${audit.rows.length} auditoría(s) encontrada(s). (Ideal: 1)`);
        }

        console.log('\n🎉 LEDGER INTEGRITY SUITE PASSED');

    } catch (err) {
        console.error('\n❌ TEST FAILED:', err);
        process.exit(1);
    } finally {
        // Clean up if needed, but in dev/test db maybe not critical.
        process.exit(0);
    }
}

runLedgerTests();
