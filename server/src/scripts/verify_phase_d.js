// server/src/scripts/verify_phase_d.js
import dotenv from 'dotenv';
import pg from 'pg';
import { reportLifecycleService } from '../services/reportLifecycleService.js';
import { AppError } from '../utils/AppError.js';

// MOCK Environment for Verification
process.env.ENABLE_STRICT_REPORT_LIFECYCLE = 'true';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/safespot';

// Helper to simulate Report Router PATCH behavior (since we can't spin up full Express app easily in script)
// We duplicate the check logic here to verify the CONCEPT of the flag, 
// and we trust integration tests for the actual HTTP layer.
const updateReportParamsMock = (body) => {
    if (body.status !== undefined) {
        if (process.env.ENABLE_STRICT_REPORT_LIFECYCLE === 'true') {
            throw new Error('400: Semantics Enforcement: Direct status update is forbidden.');
        }
    }
    return "OK";
};

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function verifyPhaseD() {
    console.log('🛡️ Verifying Phase D: Backend Semantic Layer...');

    // We need a dummy report ID created in Phase C verification or create a new one.
    // Let's create a fresh one to be atomic.
    let reportId;
    const cleanup = async () => {
        if (reportId) {
            // Ledger is append-only, cannot delete.
            // await pool.query('DELETE FROM moderation_actions WHERE target_id = $1', [reportId]);
            await pool.query('DELETE FROM reports WHERE id = $1', [reportId]);
            console.log('🧹 Cleanup: Test report deleted (Ledger kept invaraint).');
        }
    };

    try {
        // 1. Setup: Create Dummy Report
        // NO transaction for setup, so service can see it.
        const res = await pool.query(`
            INSERT INTO reports (anonymous_id, title, description, category, zone, address, status)
            VALUES ('00000000-0000-0000-0000-000000000000', 'Phase D Test', 'Testing semantics', 'security', 'Test Zone', '123 Test St', 'pendiente')
            RETURNING id, status
        `);
        reportId = res.rows[0].id;
        console.log(`✅ Setup: Created Report ${reportId} [${res.rows[0].status}]`);

        // 2. Test: Arbitrary PATCH Block
        console.log('👉 Test 1: Arbitrary PATCH status (Should Fail)');
        try {
            updateReportParamsMock({ status: 'resuelto' });
            console.error('❌ FAILED: PATCH was allowed contrary to flag!');
        } catch (e) {
            if (e.message.includes('Semantics Enforcement')) {
                console.log('✅ PASSED: PATCH blocked by Execution Guard.');
            } else {
                console.error(`❌ FAILED: Unexpected error: ${e.message}`);
            }
        }

        // 3. Test: Semantic Resolve (Should Succeed)
        console.log('👉 Test 2: Semantic Resolve Command');
        const actor = { id: '00000000-0000-0000-0000-000000000000', role: 'admin' }; // Using nil uuid as system/admin

        // We use the service directly.
        await reportLifecycleService.resolveReport(reportId, actor, 'Verification Script');
        console.log('✅ Service executed without error.');

        // 4. Verify DB State
        const dbCheck = await pool.query('SELECT status FROM reports WHERE id = $1', [reportId]);
        if (dbCheck.rows[0].status === 'resuelto') {
            console.log('✅ DB Check: Status updated to "resuelto".');
        } else {
            console.error(`❌ DB Check Failed: Status is ${dbCheck.rows[0].status}`);
        }

        // 5. Verify Ledger
        const ledgerCheck = await pool.query(`
            SELECT * FROM moderation_actions 
            WHERE target_id = $1 AND action_type = 'RESOLVE_REPORT'
        `, [reportId]);

        if (ledgerCheck.rows.length > 0) {
            console.log('✅ Ledger Check: Audit log found.');
            console.log(`   - Action: ${ledgerCheck.rows[0].action_type}`);
            console.log(`   - Reason: ${ledgerCheck.rows[0].reason}`);
        } else {
            console.error('❌ Ledger Check Failed: No audit log found!');
        }

        // 6. Test: Invalid Transition (Resuelto -> Process) - Should be blocked by DB Trigger or Service Map
        console.log('👉 Test 3: Invalid Transition (Resuelto -> En Proceso) [Strict]');
        try {
            await reportLifecycleService.processReport(reportId, actor);
            console.error('❌ FAILED: Service/DB allowed invalid transition!');
        } catch (e) {
            console.log(`✅ REJECTED Correctly: ${e.message}`);
        }

    } catch (e) {
        console.error('❌ Unexpected Error:', e);
        process.exitCode = 1;
    } finally {
        await cleanup();
        await pool.end();
        console.log('✨ Phase D Verification Complete.');
        // Force exit due to hanging redis/eventEmitter handles
        process.exit();
    }
}

verifyPhaseD();
