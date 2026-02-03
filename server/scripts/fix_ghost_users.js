
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ✅ ENTERPRISE: Load Environment Variables FIRST
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MAX_LEVEL = 100;
const MAX_POINTS = 500000;
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';

async function fixGhostUser() {
    console.log('🔧 [FIX] Starting Ghost User Normalization...');
    console.log('-------------------------------------------');

    try {
        const { supabaseAdmin } = await import('../src/utils/db.js');

        // 1. Fetch the specific Ghost User
        const { data: user, error } = await supabaseAdmin
            .from('anonymous_users')
            .select('*')
            .eq('anonymous_id', SYSTEM_USER_ID)
            .single();

        if (error) {
            console.error('❌ Could not find system user to fix (or other DB error):', error);
            process.exit(1);
        }

        console.log(`Found User: ${user.alias} (${user.anonymous_id})`);
        console.log(`Current State: Level ${user.level}, Points ${user.points}`);

        // 2. Prepare Updates
        const updates = {};
        if (user.level > MAX_LEVEL) {
            console.log(`-> Fixing Level: ${user.level} -> ${MAX_LEVEL}`);
            updates.level = MAX_LEVEL;
        }

        if (user.points > MAX_POINTS) {
            console.log(`-> Fixing Points: ${user.points} -> ${MAX_POINTS}`);
            updates.points = MAX_POINTS;
        }

        if (!user.avatar_url) {
            console.log(`-> Fixing Avatar: Missing -> Default System Logo`);
            updates.avatar_url = 'https://api.dicebear.com/9.x/bottts/svg?seed=SafeSpotSystem';
        }

        if (Object.keys(updates).length === 0) {
            console.log('✨ No changes needed. User is already normalized.');
            process.exit(0);
        }

        // 3. Apply Updates
        const { error: updateError } = await supabaseAdmin
            .from('anonymous_users')
            .update(updates)
            .eq('anonymous_id', SYSTEM_USER_ID);

        if (updateError) throw updateError;

        console.log('✅ FIX APPLIED SUCCESSFULLY.');
        process.exit(0);

    } catch (err) {
        console.error('❌ FATAL ERROR during fix:', err);
        process.exit(1);
    }
}

fixGhostUser();
