
import { supabaseAdmin } from '../src/utils/db.js';
import bcrypt from 'bcrypt';

const ADMIN_EMAIL = 'juanchi@safespot.com';
const ADMIN_ALIAS = 'Juanchi';
const ADMIN_PASS = 'safespot-secure-pass'; // Juanchi: Cambiá esto luego con el script de set_password

async function provision() {
    console.log('👷 Aprovisionando primer Administrador Nominal...');

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(ADMIN_PASS, salt);

    const { data, error } = await supabaseAdmin
        .from('admin_users')
        .upsert({
            email: ADMIN_EMAIL,
            alias: ADMIN_ALIAS,
            password_hash: hash,
            role: 'super_admin'
        }, { onConflict: 'email' })
        .select()
        .single();

    if (error) {
        console.error('❌ Error al provisionar:', error.message);
        process.exit(1);
    }

    console.log(`✅ Admin creado con éxito: ${data.alias} (${data.email}) [ID: ${data.id}]`);
    console.log('⚠️  Usa esta cuenta para el nuevo flujo de login nominal.');
    process.exit(0);
}

provision();
