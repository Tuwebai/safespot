
import dns from 'dns';
import net from 'net';
import pg from 'pg';
import dotenv from 'dotenv';
import { promisify } from 'util';

dotenv.config();

const lookup = promisify(dns.lookup);
const { Client } = pg;

async function runDiagnostics() {
    console.log('\n🏥 INICIANDO DIAGNÓSTICO PROFUNDO (Deep Debug)...\n');

    const envUrl = process.env.DATABASE_URL;
    if (!envUrl) {
        console.error('❌ ERROR: DATABASE_URL no existe en server/.env');
        return;
    }

    let config;
    try {
        const url = new URL(envUrl);
        config = {
            host: url.hostname,
            port: url.port || 5432,
            user: url.username,
            password: url.password,
            database: url.pathname.split('/')[1]
        };
        console.log('📋 Configuración leída del .env:');
        console.log(`   Host: ${config.host}`);
        console.log(`   Port: ${config.port}`);
        console.log(`   User: ${config.user}`);
        console.log(`   Database: ${config.database}`);
        console.log(`   Password Length: ${config.password ? config.password.length : 0}`);
    } catch (e) {
        console.error('❌ La URL del .env tiene un formato inválido:', e.message);
        return;
    }

    console.log('\n----------------------------------------');
    console.log('1️⃣  PRUEBA DE DNS (Resolución de Nombres)');
    try {
        console.log(`   Resolviendo IP de: ${config.host}...`);
        const { address } = await lookup(config.host);
        console.log(`   ✅ DNS OK! IP: ${address}`);
    } catch (e) {
        console.error(`   ❌ FALLÓ DNS: No se puede encontrar el host ${config.host}`);
        console.error(`      Error: ${e.code} - ${e.message}`);
        console.error('      👉 Posible causa: ID de proyecto incorrecto o problema de internet.');
    }

    console.log('\n----------------------------------------');
    console.log('2️⃣  PRUEBA DE TCP (Conectividad Básica)');
    await new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(5000);

        console.log(`   Intentando abrir puerto ${config.port} en ${config.host}...`);

        socket.on('connect', () => {
            console.log('   ✅ TCP OK! El servidor responde (puerto abierto).');
            socket.destroy();
            resolve();
        });

        socket.on('timeout', () => {
            console.error('   ❌ TCP TIMEOUT: El servidor no respondió en 5 segundos.');
            console.error('      👉 Posible causa: Firewall, bloqueo de ISP, o servidor caído.');
            socket.destroy();
            resolve();
        });

        socket.on('error', (err) => {
            console.error(`   ❌ TCP ERROR: ${err.message}`);
            resolve();
        });

        socket.connect(config.port, config.host);
    });

    console.log('\n----------------------------------------');
    console.log('3️⃣  PRUEBA DE AUTENTICACIÓN POSTGRES (pg client)');
    const client = new Client({
        connectionString: envUrl,
        ssl: { rejectUnauthorized: false }, // Permitir SSL sin certificado estricto
        connectionTimeoutMillis: 5000
    });

    try {
        console.log('   Intentando login en PostgreSQL...');
        await client.connect();
        console.log('   ✅ ¡LOGIN CORRECTO! La base de datos aceptó la contraseña.');
        await client.end();
    } catch (e) {
        console.error('   ❌ FALLÓ LOGIN POSTGRES:');
        console.error(`      Mensaje: ${e.message}`);
        console.error(`      Código: ${e.code}`);
        if (e.message.includes('password authentication failed')) {
            console.error('      👉 LA CONTRASEÑA ES INCORRECTA (Confirmado).');
        } else if (e.message.includes('Circuit breaker')) {
            console.error('      👉 ERROR RARO: Circuit breaker. Sugiere bloqueo del lado de Supabase.');
        }
    }

    console.log('\n🏁 Diagnóstico finalizado.');
}

runDiagnostics();
