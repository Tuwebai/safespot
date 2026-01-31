
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env vars
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});


import fs from 'fs';

async function inspectTriggers() {
    const outputFile = path.join(__dirname, 'triggers_dump.txt');
    const stream = fs.createWriteStream(outputFile);

    const log = (msg) => {
        console.log(msg);
        stream.write(msg + '\n');
    };

    try {
        log('--- Triggers on report_flags ---');
        let triggers = await pool.query(`
      SELECT tgname, pg_get_triggerdef(oid) as def
      FROM pg_trigger 
      WHERE tgrelid = 'report_flags'::regclass
    `);

        // Check anonymous_trust_scores as well
        const triggersTrust = await pool.query(`
      SELECT tgname, pg_get_triggerdef(oid) as def
      FROM pg_trigger 
      WHERE tgrelid = 'anonymous_trust_scores'::regclass
    `);


        triggers.rows.push(...triggersTrust.rows.map(r => ({ ...r, source: 'anonymous_trust_scores' })));

        // Check reports
        const triggersReports = await pool.query(`
      SELECT tgname, pg_get_triggerdef(oid) as def
      FROM pg_trigger 
      WHERE tgrelid = 'reports'::regclass
    `);
        triggers.rows.push(...triggersReports.rows.map(r => ({ ...r, source: 'reports' })));


        // Check specific function
        log(`--- Function: calculate_trust_score ---`);
        const funcDef = await pool.query(`
      SELECT prosrc FROM pg_proc WHERE proname = 'calculate_trust_score'
    `);
        if (funcDef.rows.length > 0) {
            log(funcDef.rows[0].prosrc);
        } else {
            log('Function calculate_trust_score not found');
        }

    } catch (err) {

        log('Error: ' + err);
    } finally {
        pool.end();
        stream.end();
    }
}


inspectTriggers();
