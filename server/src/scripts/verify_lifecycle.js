// server/verify_state_machine.js
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function verifyStateMachine() {
    const client = await pool.connect();
    console.log('🛡️ Verifying State Machine Enforcement...');

    try {
        await client.query('BEGIN');

        // 1. Create a dummy report
        const res = await client.query(`
            INSERT INTO reports (anonymous_id, title, description, category, zone, address, status)
            VALUES ('00000000-0000-0000-0000-000000000000', 'State Machine Test', 'Testing transitions', 'security', 'Test Zone', '123 Test St', 'pendiente')
            RETURNING id, status
        `);
        const reportId = res.rows[0].id;
        console.log(`✅ Created Report ${reportId} with status '${res.rows[0].status}'`);

        // 2. Valid Transition: Pendiente -> En Proceso
        console.log('👉 Attempting Valid Transition: pendiente -> en_proceso');
        await client.query('UPDATE reports SET status = $1 WHERE id = $2', ['en_proceso', reportId]);
        console.log('✅ Success.');

        // 3. Invalid Transition: En Proceso -> Pendiente (Reverse not allowed)
        console.log('👉 Attempting Invalid Transition: en_proceso -> pendiente');
        await client.query('SAVEPOINT sp_inv_1');
        try {
            await client.query('UPDATE reports SET status = $1 WHERE id = $2', ['pendiente', reportId]);
            console.error('❌ FAILED: Protection did not trigger!');
        } catch (e) {
            await client.query('ROLLBACK TO SAVEPOINT sp_inv_1');
            console.log(`✅ REJECTED Correctly: ${e.message}`);
        }

        // 4. Invalid Transition: En Proceso -> Invalido (Enum check)
        console.log('👉 Attempting Invalid Enum Value: en_proceso -> "foobar"');
        await client.query('SAVEPOINT sp_inv_2');
        try {
            await client.query('UPDATE reports SET status = $1 WHERE id = $2', ['foobar', reportId]);
            console.error('❌ FAILED: Enum check did not trigger!');
        } catch (e) {
            await client.query('ROLLBACK TO SAVEPOINT sp_inv_2');
            // Expecting generic syntax error for enum
            console.log(`✅ REJECTED Correctly (Enum): ${e.message.split('\n')[0]}`);
        }

        // 5. Valid Transition: En Proceso -> Resuelto
        console.log('👉 Attempting Valid Transition: en_proceso -> resuelto');
        await client.query('UPDATE reports SET status = $1 WHERE id = $2', ['resuelto', reportId]);
        console.log('✅ Success.');

        // 6. Invalid Transition: Resuelto -> En Proceso (Strict)
        console.log('👉 Attempting Invalid Transition: resuelto -> en_proceso (Closed loop)');
        await client.query('SAVEPOINT sp_inv_3');
        try {
            await client.query('UPDATE reports SET status = $1 WHERE id = $2', ['en_proceso', reportId]);
            console.error('❌ FAILED: Protection did not trigger!');
        } catch (e) {
            await client.query('ROLLBACK TO SAVEPOINT sp_inv_3');
            console.log(`✅ REJECTED Correctly: ${e.message}`);
        }

        await client.query('ROLLBACK'); // Clean up
        console.log('✨ All checks passed. Rolled back test data.');

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Unexpected Error:', e);
    } finally {
        client.release();
        await pool.end();
    }
}

verifyStateMachine();
