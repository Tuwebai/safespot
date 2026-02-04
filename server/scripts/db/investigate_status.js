import 'dotenv/config';
import pool from '../../src/config/database.js';

async function checkInvalidStatuses() {
    const client = await pool.connect();
    try {
        const res = await client.query(`
            SELECT status, COUNT(*) 
            FROM reports 
            WHERE status::text NOT IN ('abierto', 'en_progreso', 'resuelto', 'verificado', 'rechazado', 'archivado')
            GROUP BY status;
        `);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

checkInvalidStatuses();
