import { DB } from './src/utils/db.js';
import { v4 as uuidv4 } from 'uuid';

async function verify() {
    const anonymousId = uuidv4();
    const db = DB.public();
    const userDb = DB.withContext(anonymousId);

    console.log('--- Verification: Global Stats O(1) ---');

    // 0. Ensure user exists
    console.log('Ensuring test user exists...');
    await db.insert('anonymous_users', {
        anonymous_id: anonymousId
    });

    // 1. Initial State
    const initialStats = (await db.select('global_stats', { where: { id: 1 }, single: true }));
    console.log('Initial Total Reports:', initialStats.total_reports);
    console.log('Initial Category Breakdown:', initialStats.reports_by_category);

    // 2. Create a Report
    console.log('\nCreating a test report (Category: Motos)...');
    const report = await userDb.insert('reports', {
        anonymous_id: anonymousId,
        title: 'Test Scaling',
        description: 'Testing O(1) triggers',
        category: 'Motos',
        zone: 'Palermo',
        address: 'Av. Santa Fe 1234',
        latitude: -34.588,
        longitude: -58.432
    });

    const afterInsertStats = (await db.select('global_stats', { where: { id: 1 }, single: true }));
    console.log('After Insert Total Reports:', afterInsertStats.total_reports);
    console.log('After Insert Category Breakdown:', afterInsertStats.reports_by_category);

    // 3. Update Category
    console.log('\nUpdating report category to: Autos...');
    await userDb.update('reports', { category: 'Autos' }, { id: report.id });

    const afterUpdateStats = (await db.select('global_stats', { where: { id: 1 }, single: true }));
    console.log('After Update Total Reports:', afterUpdateStats.total_reports);
    console.log('After Update Category Breakdown:', afterUpdateStats.reports_by_category);

    // 4. Soft Delete
    console.log('\nSoft deleting report...');
    await userDb.update('reports', { deleted_at: new Date() }, { id: report.id });

    const afterDeleteStats = (await db.select('global_stats', { where: { id: 1 }, single: true }));
    console.log('After Delete Total Reports:', afterDeleteStats.total_reports);
    console.log('After Delete Category Breakdown:', afterDeleteStats.reports_by_category);

    process.exit(0);
}

verify().catch(err => {
    console.error(err);
    process.exit(1);
});
