import { supabaseAdmin } from '../utils/db.js';

/**
 * Script de verificación de esquema de admin_users
 * Verifica que la columna avatar_url existe
 */

async function verifySchema() {
    console.log('[Verify] Checking admin_users schema...');

    try {
        // 1. Test SELECT with avatar_url
        const { data: users, error: selectError } = await supabaseAdmin
            .from('admin_users')
            .select('id, email, alias, avatar_url')
            .limit(1);

        if (selectError) {
            console.error('[Verify] ❌ SELECT error:', selectError.message);
            console.error('[Verify] Error details:', JSON.stringify(selectError, null, 2));

            if (selectError.message.includes('avatar_url')) {
                console.error('\n[Verify] 🚨 PROBLEMA DETECTADO: La columna avatar_url NO EXISTE en admin_users');
                console.error('[Verify] Necesitas ejecutar la migración para agregar la columna');
            }
            process.exit(1);
        }

        console.log('[Verify] ✅ SELECT successful');
        console.log('[Verify] Sample user:', JSON.stringify(users, null, 2));

        // 2. Check if avatar_url is in the result
        if (users && users.length > 0) {
            const hasAvatarUrl = 'avatar_url' in users[0];
            if (hasAvatarUrl) {
                console.log('[Verify] ✅ Column avatar_url exists and is accessible');
            } else {
                console.error('[Verify] ❌ Column avatar_url is NOT in the result');
            }
        }

        console.log('\n[Verify] ✅ Schema verification complete!');

    } catch (error) {
        console.error('[Verify] ❌ Unexpected error:', error.message);
        console.error('[Verify] Stack:', error.stack);
        process.exit(1);
    }
}

verifySchema();
