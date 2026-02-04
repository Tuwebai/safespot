import 'dotenv/config';
import pool from '../../src/config/database.js';

async function checkCounterColumns() {
    const client = await pool.connect();
    try {
        console.log("--- REPORTS COLUMNS ---");
        const resRep = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'reports' 
            AND column_name LIKE '%vote%';
        `);
        console.table(resRep.rows);

        console.log("--- COMMENTS COLUMNS ---");
        const resCom = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'comments' 
            AND column_name LIKE '%vote%';
        `);
        console.table(resCom.rows);
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

checkCounterColumns();
