
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Hack to make imports work if they rely on process.env before it's loaded?
// No, gamificationCore relies on '../config/supabase.js' which loads env?
// Actually supabase.js in config usually does dotenv.config() or expects env.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Construct local mock for gamificationCore dependencies if needed, 
// OR simpler: just call the function if it works in isolation.
// But gamificationCore imports 'supabase' from config.
// Let's rely on standard backend setup.

// DYNAMIC IMPORT to ensure env is loaded first
async function run() {
    const { calculateUserGamification } = await import('../utils/gamificationCore.js');
    const { createClient } = await import('@supabase/supabase-js');

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('--- FINDING AFFECTED USER (155 pts) ---');
    const { data: users } = await supabase
        .from('anonymous_users')
        .select('*')
        .gte('points', 150)
        .limit(1);

    if (!users || users.length === 0) {
        console.log('User not found');
        return;
    }

    const userId = users[0].anonymous_id;
    console.log('Testing User:', userId);

    const result = await calculateUserGamification(userId, true); // Read Only

    // Find Analista Badge
    const analista = result.badges.find(b => b.name === 'Analista');

    if (analista) {
        console.log('\n--- ANALISTA BADGE STATUS ---');
        console.log('Progress:', analista.progress);
        console.log('Obtained:', analista.obtained);
        console.log('Should be > 0/40 even if comments=0');

        // Find Debatiente to verify floor
        const debatiente = result.badges.find(b => b.name === 'Debatiente'); // Threshold 15
        console.log('Debatiente Obtained:', debatiente?.obtained);
        console.log('Floor applied?', result.metrics.comments_created >= 15);
        console.log('Metrics:', { comments_created: result.metrics.comments_created });
    }
}

run().catch(err => console.error(err));
