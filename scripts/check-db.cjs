#!/usr/bin/env node
/**
 * Verificar suscripciones en DB
 */

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.womkvonfiwjzzatsowkl:Safespot2024Dev@aws-0-us-west-2.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
});

const TARGET_ID = 'bc83f625-c100-4a32-b319-a5f7f565ea69';

async function check() {
    console.log('🔍 Verificando suscripciones para:', TARGET_ID);
    console.log('');

    const result = await pool.query(
        'SELECT * FROM push_subscriptions WHERE anonymous_id = $1',
        [TARGET_ID]
    );

    console.log(`Total encontradas: ${result.rows.length}`);
    
    result.rows.forEach((row, i) => {
        console.log(`\n[${i + 1}]`);
        console.log('  ID:', row.id);
        console.log('  Active:', row.is_active);
        console.log('  Endpoint:', row.endpoint?.substring(0, 60) + '...');
        console.log('  Created:', row.created_at);
    });

    // Verificar TODAS las suscripciones
    console.log('\n\n📊 Total de suscripciones en DB:');
    const all = await pool.query('SELECT COUNT(*) FROM push_subscriptions');
    console.log('  Total:', all.rows[0].count);

    const active = await pool.query('SELECT COUNT(*) FROM push_subscriptions WHERE is_active = true');
    console.log('  Activas:', active.rows[0].count);

    const unique = await pool.query('SELECT COUNT(DISTINCT anonymous_id) FROM push_subscriptions');
    console.log('  Usuarios únicos:', unique.rows[0].count);

    await pool.end();
}

check().catch(console.error);
