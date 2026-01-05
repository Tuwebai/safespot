
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function testDirect() {
    console.log('🧪 Probando conexión DIRECTA (evitando el Pooler)...');

    const envUrl = process.env.DATABASE_URL;
    if (!envUrl) {
        console.error('❌ No se encontró DATABASE_URL');
        return;
    }

    // Intentar parsear la URL actual
    let password, projectId;
    try {
        const url = new URL(envUrl);
        password = url.password;
        // Usuario en pooler es: postgres.PROYECTO
        const userParts = url.username.split('.');
        if (userParts.length === 2) {
            projectId = userParts[1];
        } else {
            // Si el usuario es solo 'postgres', intentamos sacar el ID del host anterior si era db.ID.supabase.co
            // Pero aquí asumimos que venimos del pooler.
            // Fallback: Hardcodeamos el ID que vimos en los logs anteriores
            projectId = 'womkvonfiwjzzatsowkl';
        }
    } catch (e) {
        console.error('❌ URL inválida en .env');
        return;
    }

    if (!projectId || !password) {
        console.error('❌ No pude extraer el ID del proyecto o la contraseña.');
        console.log(`Debug: ID=${projectId}, PassLen=${password ? password.length : 0}`);
        return;
    }

    // Construir URL Directa
    const directUrl = `postgresql://postgres:${password}@db.${projectId}.supabase.co:5432/postgres`;

    console.log(`🔌 Conectando a: db.${projectId}.supabase.co`);

    const client = new Client({
        connectionString: directUrl,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 10000 // 10s timeout
    });

    try {
        await client.connect();
        console.log('\n✅ ¡ÉXITO TOTAL! La conexión DIRECTA funciona.');
        console.log('🚀 El problema era el "Intermediario" (Pooler) de Supabase.');
        console.log('\n👇 REEMPLAZA TU .env CON ESTA LÍNEA MÁGICA Y TODO FUNCIONARÁ: 👇\n');
        console.log(`DATABASE_URL=${directUrl}`);
        console.log('\n(Copia y pega eso en tu archivo server/.env y reinicia)');
        await client.end();
    } catch (e) {
        console.error('\n❌ La conexión DIRECTA falló.');
        console.error(`   Error: ${e.message}`);
        if (e.message.includes('password authentication failed')) {
            console.error('🔑 CONCLUSIÓN FINAL: La contraseña en el .env ES INCORRECTA.');
            console.error('   No importa cuántas veces la hayas copiado, la base de datos la rechaza.');
            console.error('   Solución: Reseteala en Supabase por una MUY simple (ej: "abc12345") y probá de nuevo.');
        } else if (e.code === 'ENOTFOUND') {
            console.error('🌐 Error de DNS: Tu internet o Supabase no encuentran el host.');
        }
        await client.end();
    }
}

testDirect();
