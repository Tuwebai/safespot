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
      LIMIT 20
    `);

        console.table(res.rows);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();
