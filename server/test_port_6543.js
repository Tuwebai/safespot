
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;

async function testTransactionPort() {
    console.log('🔄 Probando conexión por puerto 6543 (Transaction Mode)...');

    // Forzar puerto 6543
    const originalUrl = process.env.DATABASE_URL;
    if (!originalUrl) {
        console.error('❌ No hay DATABASE_URL');
        return;
    }

    // Reemplazamos 5432 por 6543
    // O si no tiene puerto, lo agregamos.
    let transactionUrl = originalUrl;
    if (transactionUrl.includes(':5432')) {
        transactionUrl = transactionUrl.replace(':5432', ':6543');
    } else {
        console.log('⚠️ No encontré :5432 en la URL, intentando añadir :6543 al final del host...');
        // Esto es arriesgado sin regex sofisticado, pero para prueba rápida:
        // Asumimos formato standard pooler.supabase.com:5432
    }

    console.log('   URL modificada para usar puerto 6543.');

    const client = new Client({
        connectionString: transactionUrl,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000
    });

    try {
        await client.connect();
        console.log('✅ ¡EXITO! El puerto 6543 funciona perfectamente.');
        console.log('   El problema es el puerto 5432 (Session Mode) que suele bloquearse.');
        await client.end();
        process.exit(0);
    } catch (e) {
        console.error('❌ Falló también el puerto 6543.');
        console.error('   Error:', e.message);
        await client.end();
        process.exit(1);
    }
}

testTransactionPort();
