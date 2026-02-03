
import { supabaseAdmin } from '../src/utils/db.js';

async function auditAdmins() {
    console.log('🕵️  Auditoría de Usuarios Admin...\n');

    const { data: admins, error } = await supabaseAdmin
        .from('admin_users')
        .select('*');

    if (error) {
        console.error('Error fetching admins:', error);
        process.exit(1);
    }

    console.table(admins.map(a => ({
        ID: a.id,
        Alias: a.alias,
        Email: a.email,
        Role: a.role,
        LastLogin: a.last_login
    })));

    process.exit(0);
}

auditAdmins();
