import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import pg from 'pg';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
    console.log('🔒 Starting Admin Security Migration (Direct PG)...');

    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL is missing in .env');
        process.exit(1);
    }

    const client = new pg.Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // Required for Supabase in many environments
    });

    try {
        await client.connect();
        console.log('✅ Connected to database via PG.');

        // 1. Read SQL file
        const sqlPath = path.join(__dirname, 'create_admin_users.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // 2. Execute SQL to create table (Wrap in try/catch for existing policies)
        console.log('   Running SQL to create admin_users table...');
        try {
            await client.query(sql);
            console.log('   ✅ Table/Policies SQL executed.');
        } catch (e) {
            if (e.code === '42710' || e.message.includes('already exists')) {
                console.log('   ⚠️ policies already exist, continuing...');
            } else {
                console.warn('   ⚠️ SQL Execution warning (might be pre-existing):', e.message);
            }
        }

        // 3. Seed Initial Super Admin
        const email = process.env.ADMIN_EMAIL;
        const password = process.env.ADMIN_PASSWORD;

        if (!email || !password) {
            console.error('❌ ADMIN_EMAIL or ADMIN_PASSWORD missing in .env');
            process.exit(1);
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        console.log(`   Seeding super admin: ${email}`);

        // Check if exists
        const checkRes = await client.query('SELECT id FROM public.admin_users WHERE email = $1', [email]);

        if (checkRes.rows.length > 0) {
            console.log('   ⚠️ Super admin already exists. Updating password...');
            await client.query('UPDATE public.admin_users SET password_hash = $1 WHERE email = $2', [passwordHash, email]);
            console.log('   ✅ Password updated.');
        } else {
            await client.query(
                'INSERT INTO public.admin_users (email, password_hash, role) VALUES ($1, $2, $3)',
                [email, passwordHash, 'super_admin']
            );
            console.log('   ✅ Super admin created.');
        }

        console.log('🎉 Migration completed successfully.');
        await client.end();
        process.exit(0);

    } catch (error) {
        console.error('❌ Migration Failed:', error);
        if (client) await client.end();
        process.exit(1);
    }
}

runMigration();
