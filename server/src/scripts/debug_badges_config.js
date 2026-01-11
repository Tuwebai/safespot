
import { queryWithRLS } from '../utils/rls.js';
import supabase from '../config/supabase.js';

async function debugBadges() {
    try {
        console.log('Fetching badges...');
        const { data: badges, error } = await supabase
            .from('badges')
            .select('*')
            .order('level', { ascending: true });

        if (error) {
            console.error('Error fetching badges:', error);
            return;
        }

        console.log('--- Badges Configuration (Filtered) ---');
        badges.filter(b => b.name.includes('Debatiente') || b.name.includes('Analista')).forEach(b => {
            console.log(`[${b.level}] ${b.name} (${b.code})`);
            console.log(`    Category: ${b.category}`);
            console.log(`    Metric: ${b.target_metric}`);
            console.log(`    Threshold: ${b.threshold}`);
            console.log('--------------------------------');
        });

    } catch (err) {
        console.error('Script failed:', err);
    }
}

debugBadges();
