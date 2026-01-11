
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server/.env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('--- CHECKING BADGE: Analista ---');
    const { data: badge, error } = await supabase
        .from('badges')
        .select('*')
        .eq('name', 'Analista')
        .single();

    if (error) {
        console.error('Error fetching badge:', error);
        return;
    }

    console.log('Badge Data:', JSON.stringify(badge, null, 2));

    console.log('\n--- FINDING TOP USERS ---');
    const { data: users, error: userError } = await supabase
        .from('anonymous_users')
        .select('*')
        .gte('points', 50)
        .order('points', { ascending: false })
        .limit(10);

    if (userError) console.error(userError);
    if (!users || users.length === 0) {
        console.log('No matching user found.');
        return;
    }

    for (const user of users) {
        const { count: commentsCount } = await supabase
            .from('comments')
            .select('*', { count: 'exact', head: true })
            .eq('anonymous_id', user.anonymous_id);

        const { count: reportsCount } = await supabase
            .from('reports')
            .select('*', { count: 'exact', head: true })
            .eq('anonymous_id', user.anonymous_id);

        console.log(`User: ${user.anonymous_id} | Points: ${user.points} | Comments (Raw): ${commentsCount} | Comments (Stats): ${user.total_comments}`);
    }
}

run();
