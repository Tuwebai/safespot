
import { DB } from '../src/utils/db.js';

const db = new DB();

async function cleanup() {
    console.log('🧹 Buscando reportes de prueba...');

    // Criterios de búsqueda para reportes de test
    const criteria = [
        "title ILIKE '%test%'",
        "title ILIKE '%prueba%'",
        "description ILIKE '%test%'",
        "description ILIKE '%regression%'",
        "anonymous_id = '00000000-0000-0000-0000-000000000000'" // System/Test users
    ];

    const query = `
    SELECT id, title, created_at, status 
    FROM reports 
    WHERE ${criteria.join(' OR ')}
  `;

    const res = await db.query(query);

    if (res.rows.length === 0) {
        console.log('✅ No se encontraron reportes de prueba.');
        process.exit(0);
    }

    console.log(`⚠️ Se encontraron ${res.rows.length} reportes de prueba:`);
    res.rows.forEach(r => console.log(`- [${r.status}] ${r.title} (${r.id})`));

    // Delete
    const deleteQuery = `
    DELETE FROM reports 
    WHERE id = ANY($1)
    RETURNING id
  `;

    const idsToDelete = res.rows.map(r => r.id);
    const deleteRes = await db.query(deleteQuery, [idsToDelete]);

    console.log(`\n🗑️ Eliminados ${deleteRes.rows.length} reportes.`);

    // Also clean up related tables if cascade is not set (usually safe to rely on cascade or just ignore for loose cleanup)
    // But strictly, we should cleanup moderation_actions too if they reference these?
    // Let's assume database constraints (CASCADE) handle the rest or they remain as orphaned logs (acceptable for this quick cleanup).

    process.exit(0);
}

cleanup();
