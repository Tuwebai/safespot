import 'dotenv/config';
import pool from '../../src/config/database.js';

async function checkTableInfo() {
    const client = await pool.connect();
    try {
        console.log("Checking 'reports' table structure...");

        // Check column type
        const colRes = await client.query(`
            SELECT column_name, data_type, udt_name 
            FROM information_schema.columns 
            WHERE table_name = 'reports' AND column_name = 'status';
        `);
        console.table(colRes.rows);

        // If it is an enum, list values
        const row = colRes.rows[0];
        if (row && row.udt_name === 'report_status_enum') {
            console.log("Enum values:");
            const enumRes = await client.query(`
                SELECT unnest(enum_range(NULL::report_status_enum)) as value
             `);
            console.table(enumRes.rows);
        } else {
            console.log("Not using report_status_enum (or it is not named that).");
        }

    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        await pool.end();
    }
}

checkTableInfo();
