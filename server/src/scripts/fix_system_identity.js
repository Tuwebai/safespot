
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env') });

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixSystemIdentity() {
    const SYSTEM_ID = '00000000-0000-0000-0000-000000000000';
    const NEW_IDENTITY = {
        alias: process.env.ADMIN_ALIAS || 'SafeSpot Oficial',
        email: process.env.ADMIN_EMAIL || 'getsafespot@gmail.com',
    };

    console.log(`[Identity] Updating Legacy System User (${SYSTEM_ID})...`);
    console.log(`[Identity] New Alias: ${NEW_IDENTITY.alias}`);
    console.log(`[Identity] New Email: ${NEW_IDENTITY.email}`);

    const { error } = await supabaseAdmin
        .from('admin_users')
        .update(NEW_IDENTITY)
        .eq('id', SYSTEM_ID);

    if (error) {
        console.error('[Identity] Failed to update:', error);
    } else {
        console.log('[Identity] ✅ Update successful. Audit logs will now show the new corporate identity.');
    }
}

fixSystemIdentity();
