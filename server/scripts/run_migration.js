
import { DB } from '../src/utils/db.js';
import fs from 'fs/promises';
import path from 'path';

const sqlPath = process.argv[2];

if (!sqlPath) {
    console.error('❌ Error: Debés proveer la ruta al archivo .sql');
    process.exit(1);
}

async function run() {
    console.log(`🚀 Iniciando ejecución de migración: ${path.basename(sqlPath)}`);
    const db = new DB();

    try {
        const fullPath = path.isAbsolute(sqlPath) ? sqlPath : path.resolve(process.cwd(), sqlPath);
        const sql = await fs.readFile(fullPath, 'utf8');

        console.log('🔍 Conectando a la base de datos...');
        // El constructor de DB ya testea la conexión
        
        console.log('⚡ Ejecutando transacción...');
        await db.query(sql);

        console.log('✅ Migración aplicada exitosamente.');
        process.exit(0);
    } catch (err) {
        console.error('❌ FALLO en la migración:');
        console.error(err.message);
        process.exit(1);
    }
}

run();
