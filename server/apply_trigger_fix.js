import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const { Client } = pg;

async function applyFix() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to database');

        // First, check if there are any reports with 'en_proceso'
        console.log('\n=== Checking for reports with wrong status ===');
        const checkRes = await client.query(`
            SELECT id, status::text as status_text 
            FROM reports 
            WHERE status::text = 'en_proceso'
        `);
        
        if (checkRes.rows.length > 0) {
            console.log(`Found ${checkRes.rows.length} reports with 'en_proceso':`);
            console.log(checkRes.rows);
            
            // Fix the data
            console.log('\n=== Fixing data ===');
            await client.query(`
                UPDATE reports 
                SET status = 'en_progreso'::report_status_enum 
                WHERE status::text = 'en_proceso'
            `);
            console.log('Data fixed');
        } else {
            console.log('No reports with wrong status found');
        }

        // Now check the trigger function
        console.log('\n=== Checking trigger function ===');
        const triggerRes = await client.query(`
            SELECT pg_get_functiondef(oid) as func_def
            FROM pg_proc 
            WHERE proname = 'enforce_report_state_machine'
        `);
        
        if (triggerRes.rows.length > 0) {
            const funcDef = triggerRes.rows[0].func_def;
            
            if (funcDef.includes('en_proceso')) {
                console.log('Trigger function contains "en_proceso" - needs fixing');
                
                // Drop and recreate the function
                await client.query(`
                    CREATE OR REPLACE FUNCTION enforce_report_state_machine()
                    RETURNS TRIGGER AS $$
                    BEGIN
                        -- Skip validation if status hasn't changed
                        IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
                            RETURN NEW;
                        END IF;

                        IF OLD.status = 'abierto' THEN
                            IF NEW.status NOT IN ('en_progreso', 'rechazado', 'archivado') THEN
                                RAISE EXCEPTION 'Invalid transition from % to %', OLD.status, NEW.status;
                            END IF;
                        ELSIF OLD.status = 'en_progreso' THEN
                            IF NEW.status NOT IN ('resuelto', 'rechazado', 'archivado') THEN
                                RAISE EXCEPTION 'Invalid transition from % to %', OLD.status, NEW.status;
                            END IF;
                        ELSIF OLD.status = 'resuelto' THEN
                            IF NEW.status NOT IN ('verificado', 'archivado') THEN
                                RAISE EXCEPTION 'Invalid transition from % to %', OLD.status, NEW.status;
                            END IF;
                        ELSIF OLD.status IN ('verificado', 'rechazado', 'archivado') THEN
                            RAISE EXCEPTION 'Cannot change status from % - terminal state', OLD.status;
                        END IF;

                        RETURN NEW;
                    END;
                    $$ LANGUAGE plpgsql;
                `);
                console.log('Trigger function updated successfully');
            } else {
                console.log('Trigger function looks OK');
            }
        }

        console.log('\n✅ All fixes applied');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

applyFix();
