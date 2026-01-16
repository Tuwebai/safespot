require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('render') ? { rejectUnauthorized: false } : false
});

async function check() {
    try {
        const res = await pool.query(`
      SELECT 
        count(*) as total_users,
        count(current_city) as users_with_city, 
        count(current_province) as users_with_province
      FROM anonymous_users
    `);
        console.log('Migration Stats:', res.rows[0]);

        if (parseInt(res.rows[0].users_with_city) === 0) {
            console.log('WARNING: No users have current_city set!');
        }

        const sample = await pool.query(`
      SELECT current_city, count(*) 
      FROM anonymous_users 
      WHERE current_city IS NOT NULL 
      GROUP BY current_city 
      ORDER BY count(*) DESC 
      LIMIT 10
    `);
        console.log('Top Cities:', sample.rows);

        // Check notification settings for comparison
        const nsStats = await pool.query(`
      SELECT count(*) as total, count(last_known_city) as with_city 
      FROM notification_settings
    `);
        console.log('Legacy Settings Stats:', nsStats.rows[0]);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

check();
