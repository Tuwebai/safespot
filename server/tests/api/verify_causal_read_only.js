
import { causalQueryService } from '../../src/services/causalQueryService.js';
import { DB } from '../../src/utils/db.js';

const db = new DB();

async function runPurityTests() {
    console.log('🔬 Iniciando Causal Inspector Purity Suite...');

    // 1. Snapshot State: Count rows in relevant tables
    const initialCounts = await getTableCounts();
    console.log('📸 Estado inicial capturado:', initialCounts);

    // 2. Execute Read Operation
    console.log('\n🔭 Ejecutando lectura causal (getTimeline)...');
    try {
        // Use a known report ID (or nil) just to trigger logic
        await causalQueryService.getTimeline({
            reportId: '00000000-0000-0000-0000-000000000000',
            limit: 10
        });
    } catch (e) {
        console.log('Info: Lectura vacía o error esperado (no data), pero verificamos efectos secundarios.');
    }

    // 3. Verify State: Counts must match EXACTLY
    const finalCounts = await getTableCounts();
    console.log('📸 Estado final capturado:', finalCounts);

    const isPure =
        initialCounts.reports === finalCounts.reports &&
        initialCounts.domain_events === finalCounts.domain_events &&
        initialCounts.moderation === finalCounts.moderation;

    if (isPure) {
        console.log('\n✅ PURITY CHECK PASSED: Ninguna tabla fue modificada por la lectura.');
    } else {
        console.error('\n❌ PURITY CHECK FAILED: Se detectaron escrituras durante una operación de solo lectura.');
        console.error('Diff:', {
            reports: finalCounts.reports - initialCounts.reports,
            domain: finalCounts.domain_events - initialCounts.domain_events,
            moderation: finalCounts.moderation - initialCounts.moderation
        });
        process.exit(1);
    }

    process.exit(0);
}

async function getTableCounts() {
    const reports = await db.query('SELECT COUNT(*) FROM reports');
    // Check if domain_events_log exists first (from Phase 2) - Assuming yes per user context
    const domain = await db.query('SELECT COUNT(*) FROM domain_events_log');
    const moderation = await db.query('SELECT COUNT(*) FROM moderation_actions');

    return {
        reports: parseInt(reports.rows[0].count),
        domain_events: parseInt(domain.rows[0].count),
        moderation: parseInt(moderation.rows[0].count)
    };
}

runPurityTests();
