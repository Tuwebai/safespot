import pool from './config/database.js';

async function migrate() {
    try {
        // Check if read_at exists
        const checkResult = await pool.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'chat_messages' AND column_name = 'read_at'
            ) as exists
        `);
        
        if (checkResult.rows[0].exists) {
            console.log('[Migrate] read_at column already exists');
        } else {
            // Add read_at column
            await pool.query(`
                ALTER TABLE chat_messages 
                ADD COLUMN read_at TIMESTAMP WITH TIME ZONE
            `);
            console.log('[Migrate] Added read_at column');
        }
        
        // Create index for catchup queries
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_chat_messages_read_catchup
            ON chat_messages(sender_id, read_at) 
            WHERE is_read = true AND read_at IS NOT NULL
        `);
        console.log('[Migrate] Created idx_chat_messages_read_catchup index');
        
        // Verify final state
        const verifyResult = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'chat_messages' 
            AND column_name IN ('is_delivered', 'delivered_at', 'is_read', 'read_at')
            ORDER BY column_name
        `);
        
        console.log('\n[Verify] chat_messages delivery receipt columns:');
        verifyResult.rows.forEach(c => {
            console.log(`  ✓ ${c.column_name}: ${c.data_type}`);
        });
        
        if (verifyResult.rows.length === 4) {
            console.log('\n✅ Migration complete: All delivery receipt columns present');
        } else {
            console.log('\n⚠️  Migration incomplete: Some columns missing');
        }
        
    } catch (err) {
        console.error('[Migrate] Error:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
