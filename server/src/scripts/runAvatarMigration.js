import { supabaseAdmin } from '../utils/db.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Script para ejecutar migración: agregar avatar_url a admin_users
 */

async function runMigration() {
    console.log('[Migration] Starting migration: add_avatar_url_to_admin_users');

    try {
        // Read SQL file
        const sqlPath = join(__dirname, '../../migrations/add_avatar_url_to_admin_users.sql');
        const sql = readFileSync(sqlPath, 'utf-8');

        console.log('[Migration] Executing SQL...');
        console.log(sql);

        // Execute migration using raw SQL
        const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql_query: sql });

        if (error) {
            // Si RPC no existe, intentar con query directa
            console.log('[Migration] RPC not available, trying direct query...');

            // Split SQL into statements and execute each
            const statements = sql
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('SELECT'));

            for (const statement of statements) {
                console.log(`[Migration] Executing: ${statement.substring(0, 50)}...`);
                const { error: execError } = await supabaseAdmin.from('_migrations').insert({
                    query: statement
                }).select();

                if (execError) {
                    console.error('[Migration] ❌ Error executing statement:', execError.message);
                }
            }
        }

        // Verify column exists
        console.log('[Migration] Verifying column...');
        const { data: users, error: verifyError } = await supabaseAdmin
            .from('admin_users')
            .select('id, avatar_url')
            .limit(1);

        if (verifyError) {
            console.error('[Migration] ❌ Verification failed:', verifyError.message);
            console.error('[Migration] La columna avatar_url aún no existe.');
            console.error('[Migration] Ejecuta manualmente el SQL en Supabase Dashboard:');
            console.error('\n' + sql + '\n');
            process.exit(1);
        }

        console.log('[Migration] ✅ Column avatar_url verified!');
        console.log('[Migration] Sample result:', JSON.stringify(users, null, 2));
        console.log('\n[Migration] ✅ Migration complete!');

    } catch (error) {
        console.error('[Migration] ❌ Unexpected error:', error.message);
        console.error('[Migration] Stack:', error.stack);
        process.exit(1);
    }
}

runMigration();
