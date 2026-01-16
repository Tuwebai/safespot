require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('render') ? { rejectUnauthorized: false } : false
});

async function check() {
    try {
        console.log('--- CITY NORMALIZATION CHECK ---');

        // 1. Get raw distinct cities to see variations
        const res = await pool.query(`
      SELECT current_city, count(*) 
      FROM anonymous_users 
      WHERE current_city IS NOT NULL 
      GROUP BY current_city 
      ORDER BY count(*) DESC
    `);

        console.table(res.rows);

        // 2. Check strict matches for a likely candidate (e.g. Rio Tercero)
        // We'll search for 'Rio Tercero' fuzzy
        const fuzzy = await pool.query(`
      SELECT current_city, count(*)
      FROM anonymous_users
      WHERE current_city ILIKE '%Rio Tercero%' OR current_city ILIKE '%Río Tercero%'
      GROUP BY current_city
    `);

        console.log('\n--- Fuzzy Matches for Rio Tercero ---');
        console.table(fuzzy.rows);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();
