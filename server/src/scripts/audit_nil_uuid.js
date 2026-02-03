import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import { supabaseAdmin } from '../utils/db.js';

async function checkSystemUsers() {
    const { data, error } = await supabaseAdmin
        .from('anonymous_users')
        .select('anonymous_id, alias, role, is_official')
        .eq('anonymous_id', '00000000-0000-0000-0000-000000000000');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('System Users (Nil UUID):', data);
}

checkSystemUsers();
