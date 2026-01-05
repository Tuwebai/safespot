
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function testDirectConnection() {
    console.log('🕵️ Iniciando diagnóstico de conexión directa...');

    const currentUrl = process.env.DATABASE_URL;
    if (!currentUrl) {
        console.error('❌ No se encontró DATABASE_URL');
        return;
    }

    // 1. Extraer contraseña de la URL actual (Pooler)
    // Formato Pooler: postgresql://postgres.PROJECT_ID:PASSWORD@pooler...
    let password = '';
    try {
        const urlObj = new URL(currentUrl);
        password = urlObj.password;
        console.log('🔑 Contraseña extraída de la configuración actual.');
    } catch (e) {
        console.error('❌ No se pudo parsear la URL actual:', e.message);
        return;
    }

    // 2. Construir URL Directa (Standard Supabase Direct Connection)
    // Host: db.womkvonfiwjzzatsowkl.supabase.co
    // User: postgres
    const projectId = 'womkvonfiwjzzatsowkl';
    const directUrl = `postgresql://postgres:${password}@db.${projectId}.supabase.co:5432/postgres`;

    console.log(`🔌 Probando conexión DIRECTA a: db.${projectId}.supabase.co`);

    const client = new Client({
        connectionString: directUrl,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000 // 5s timeout
    });

    try {
        await client.connect();
        console.log('✅ ¡ÉXITO! La conexión DIRECTA funciona correctamente.');
        console.log('---------------------------------------------------');
        console.log('💡 SOLUCIÓN:');
        console.log('El "Pooler" de Supabase está fallando, pero la base de datos está bien.');
        console.log('Debes actualizar tu archivo .env con esta URL (copia y pega):');
        console.log('');
        console.log(`DATABASE_URL=${directUrl}`);
        console.log('');
        console.log('---------------------------------------------------');
        await client.end();
    } catch (err) {
        console.error('❌ La conexión DIRECTA también falló.');
        console.error('Error:', err.message);
        if (err.message.includes('password authentication failed')) {
            console.error('👉 ESTO CONFIRMA QUE LA CONTRASEÑA ES INCORRECTA.');
        } else {
            console.error('👉 Puede ser un problema de red o configuración de Supabase.');
        }
        await client.end();
    }
}

testDirectConnection();
