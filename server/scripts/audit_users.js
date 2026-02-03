
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ✅ ENTERPRISE: Load Environment Variables FIRST
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MAX_LEVEL = 100;
const MAX_POINTS = 500000;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function auditUsers() {
    console.log('🔍 [AUDIT] Starting User Integrity Scan...');
    console.log('-------------------------------------------');

    try {
        // DYNAMIC IMPORT: To ensure env vars are loaded before db.js is evaluated
        const { supabaseAdmin } = await import('../src/utils/db.js');

        // 1. Fetch Users
        const { data: users, error } = await supabaseAdmin
            .from('anonymous_users')
            .select(`
                *,
                anonymous_trust_scores (
                    trust_score,
                    moderation_status
                )
            `);

        if (error) throw error;

        console.log(`✅ Fetched ${users.length} users.`);

        const violations = [];

        for (const user of users) {
            const issues = [];
            const scoreData = Array.isArray(user.anonymous_trust_scores)
                ? user.anonymous_trust_scores[0]
                : user.anonymous_trust_scores;

            // CHECK 1: ID Format
            if (!UUID_REGEX.test(user.anonymous_id)) {
                issues.push(`🚨 INVALID ID FORMAT: ${user.anonymous_id}`);
            }

            // CHECK 2: Level Integrity
            if (user.level > MAX_LEVEL) {
                issues.push(`🚨 LEVEL OUT OF BOUNDS: ${user.level} (Max: ${MAX_LEVEL})`);
            }

            // CHECK 3: Points Sanity
            if (user.points > MAX_POINTS) {
                issues.push(`⚠️ SUSPICIOUS POINTS: ${user.points}`);
            }

            // CHECK 4: Avatar Presence
            if (!user.avatar_url) {
                if (user.level > 10) {
                    issues.push(`⚠️ HIGH LEVEL USER MISSING AVATAR`);
                }
            }

            if (issues.length > 0) {
                violations.push({
                    id: user.anonymous_id,
                    alias: user.alias,
                    issues
                });
            }
        }

        if (violations.length === 0) {
            console.log('✨ CLEAN AUDIT: No violations found.');
        } else {
            console.log(`⚠️ FOUND ${violations.length} USERS WITH VIOLATIONS:`);
            violations.forEach(v => {
                console.log(`\n👤 User: ${v.alias || 'Unknown'} (${v.id})`);
                v.issues.forEach(i => console.log(`   ${i}`));
            });
        }

        process.exit(violations.length > 0 ? 1 : 0);

    } catch (err) {
        console.error('❌ FATAL ERROR during audit:', err);
        process.exit(1);
    }
}

auditUsers();
