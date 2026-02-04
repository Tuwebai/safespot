import 'dotenv/config';
import pool from '../../src/config/database.js';
import fs from 'fs';
import path from 'path';

const sqlFile = process.argv[2];

if (!sqlFile) {
    console.error('❌ Error: No SQL file provided.');
    process.exit(1);
}

const filePath = path.resolve(process.cwd(), sqlFile);

if (!fs.existsSync(filePath)) {
    console.error(`❌ Error: File not found: ${filePath}`);
    process.exit(1);
}

async function executeSql() {
    const client = await pool.connect();
    try {
        console.log(`⏳ Executing: ${path.basename(filePath)}...`);
        const sql = fs.readFileSync(filePath, 'utf8');

        // Force serialization for safety
        await client.query('BEGIN; SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;');
        await client.query(sql);
        await client.query('COMMIT');

        console.log(`✅ Success: ${path.basename(filePath)} executed.`);
        process.exit(0);
    } catch (e) {
        if (client) await client.query('ROLLBACK');
        console.error(`❌ Execution Failed: ${e.message}`);
        console.error(e.stack);
        process.exit(1);
    } finally {
        client.release();
    }
}

executeSql();
