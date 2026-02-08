import pg from 'pg';
import dotenv from 'dotenv';

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

        // Update the trigger to allow more flexible transitions for admin
        console.log('\n=== Updating trigger function with flexible admin transitions ===');
        
        await client.query(`
            CREATE OR REPLACE FUNCTION enforce_report_state_machine()
            RETURNS TRIGGER AS $$
            BEGIN
                -- Skip validation if status hasn't changed
                IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
                    RETURN NEW;
                END IF;

                -- Allow admin to move from any non-terminal state to any other non-terminal state
                -- Terminal states: verificado, rechazado, archivado
                
                -- If current state is terminal, don't allow changes
                IF OLD.status IN ('verificado', 'rechazado', 'archivado') THEN
                    RAISE EXCEPTION 'Cannot change status from % - terminal state', OLD.status;
                END IF;

                -- If trying to go to a terminal state, allow it from any non-terminal state
                -- (admin override capability)
                IF NEW.status IN ('verificado', 'rechazado', 'archivado') THEN
                    -- Allow direct transition to terminal states from any non-terminal state
                    RETURN NEW;
                END IF;

                -- For non-terminal to non-terminal transitions, enforce standard flow
                -- abierto -> en_progreso
                -- en_progreso -> resuelto
                IF OLD.status = 'abierto' AND NEW.status != 'en_progreso' THEN
                    RAISE EXCEPTION 'Invalid transition from % to % - from abierto, only en_progreso is allowed', OLD.status, NEW.status;
                END IF;

                IF OLD.status = 'en_progreso' AND NEW.status != 'resuelto' THEN
                    RAISE EXCEPTION 'Invalid transition from % to % - from en_progreso, only resuelto is allowed', OLD.status, NEW.status;
                END IF;

                IF OLD.status = 'resuelto' AND NEW.status NOT IN ('verificado', 'archivado') THEN
                    RAISE EXCEPTION 'Invalid transition from % to %', OLD.status, NEW.status;
                END IF;

                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);
        
        console.log('Trigger function updated with flexible admin transitions');
        console.log('\n✅ Fix applied');
        
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

applyFix();
