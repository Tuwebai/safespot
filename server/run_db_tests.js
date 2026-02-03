
import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const { Client } = pg;

async function runTests() {
    console.log('🛡️  Iniciando DB Regression Suite...');

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const testsDir = path.join(__dirname, 'tests', 'db');
        if (!fs.existsSync(testsDir)) {
            console.error(`❌ Directorio de tests no encontrado: ${testsDir}`);
            process.exit(1);
        }

        const files = fs.readdirSync(testsDir).filter(f => f.endsWith('.sql'));

        for (const file of files) {
            console.log(`\n📄 Ejecutando: ${file}`);
            const sql = fs.readFileSync(path.join(testsDir, file), 'utf-8');

            try {
                // Ejecutamos todo el script. 
                // El script debe estar diseñado para lanzar excepciones si falla la aserción.
                // Usamos una transacción para no ensuciar la DB (ROLLBACK al final).
                await client.query('BEGIN');
                await client.query(sql);
                await client.query('ROLLBACK'); // Siempre rollback en tests
                console.log(`✅  ${file}: PASSED (Rollback ejecutado para limpieza)`);
            } catch (err) {
                await client.query('ROLLBACK');
                console.error(`❌  ${file}: FAILED`);
                console.error(`   Error: ${err.message}`);
                // Si el error viene de un RAISE EXCEPTION en el test, es un fallo controlado.
                if (err.context) console.error(`   Context: ${err.context}`);
            }
        }

    } catch (err) {
        console.error('🔥 Error fatal en runner:', err);
    } finally {
        await client.end();
    }
}

runTests();
