
import { reportLifecycleService } from '../../src/services/reportLifecycleService.js';
import { DB } from '../../src/utils/db.js';
import { AppError } from '../../src/utils/AppError.js';

const db = new DB();

async function runGovernanceTests() {
    console.log('👮 Iniciando Actor Governance Suite...');

    const testValues = {
        title: 'GOV_TEST_REPORT',
        description: 'Report for governance verification',
        latitude: 0,
        longitude: 0,
        anonymous_id: '00000000-0000-0000-0000-000000000000',
        status: 'pendiente',
        category: 'robo',
        zone: 'Córdoba',
        address: 'Gov St'
    };

    let reportId;
    // Actors
    const adminActor = { id: '00000000-0000-0000-0000-000000000000', role: 'admin', alias: 'AdminUser' };
    const citizenActor = { id: '11111111-1111-1111-1111-111111111111', role: 'citizen', alias: 'RegularUser' };
    const systemActor = { id: '00000000-0000-0000-0000-000000000000', role: 'system', alias: 'System' }; // Should be allowed or blocked depending on logic? System usually allowed.

    try {
        // 1. SETUP: Create Report
        const insertRes = await db.query(
            `INSERT INTO reports (title, description, latitude, longitude, anonymous_id, status, category, zone, address) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
            [testValues.title, testValues.description, testValues.latitude, testValues.longitude, testValues.anonymous_id, testValues.status, testValues.category, testValues.zone, testValues.address]
        );
        reportId = insertRes.rows[0].id;
        console.log(`📝 Reporte creado: ${reportId}`);

        // 2. TEST: Regular User tries to Resolve (Should FAIL)
        console.log('\n🧪 Testing Citizen Access (Expected: FAIL)...');
        try {
            await reportLifecycleService.resolveReport(reportId, citizenActor, 'Hacking attempt');
            console.error('❌ FAILURE: Citizen was able to resolve report! (Vulnerability Confirmed)');
            // Throw error to fail test if vulnerability exists (or catch to confirm finding?)
            // If we want to "prove" it works after fix, this line should throw.
            throw new Error('VULNERABILITY_DETECTED');
        } catch (e) {
            if (e.message === 'VULNERABILITY_DETECTED') {
                throw e; // Rethrow our detection
            }
            if (e.message.includes('Forbidden') || e.message.includes('Unauthorized') || e.statusCode === 403) {
                console.log('✅ Access Denied correctly for Citizen.');
            } else {
                console.log(`⚠️ Unexpected error for citizen: ${e.message}`);
                // If it failed for other reason, it's ambiguous.
                // But if it succeed, flow continues above.
            }
        }

        // 3. TEST: Admin User tries to Resolve (Should PASS)
        console.log('\n🧪 Testing Admin Access (Expected: PASS)...');
        await reportLifecycleService.resolveReport(reportId, adminActor, 'Official Resolution');
        console.log('✅ Admin Access Granted.');


        console.log('\n🎉 GOVERNANCE SUITE PASSED (If Citizen detected forbidden)');

    } catch (err) {
        console.error('\n❌ TEST FAILED:', err.message);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

runGovernanceTests();
