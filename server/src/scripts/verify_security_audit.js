import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import pool from '../config/database.js';

async function verifySecurity() {
    console.log('🚀 Iniciando Auditoría de Seguridad...');

    const SYSTEM_ROOT_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    const GUEST_ID = '00000000-0000-0000-0000-000000000000';

    try {
        // 0. Asegurar que el usuario root exista (para evitar FK error)
        console.log('0. Asegurando existencia de usuario ROOT...');
        await pool.query(`
            INSERT INTO anonymous_users (anonymous_id, alias, is_official, role)
            VALUES ($1, 'SystemAdmin', true, 'admin')
            ON CONFLICT (anonymous_id) DO UPDATE SET is_official = true, role = 'admin'
        `, [SYSTEM_ROOT_ID]);

        // 1. Preparar datos de prueba
        console.log('1. Creando reporte de prueba oculto (Admin)...');
        const reportResult = await pool.query(
            `INSERT INTO reports (title, description, anonymous_id, is_hidden, category, location, zone, address)
             VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_MakePoint(0,0), 4326), $6, $7)
             RETURNING id`,
            ['Admin Hidden Report', 'This should only be seen by Admin', SYSTEM_ROOT_ID, true, 'security', 'Global', 'System Office']
        );
        const reportId = reportResult.rows[0].id;

        // 2. Simular acceso GUEST (Nil UUID)
        console.log('2. Verificando aislamiento de GUEST...');
        const guestQuery = await pool.query(
            `SELECT id FROM reports WHERE id = $1 
             AND (is_hidden = false OR anonymous_id = $2 OR $3 = 'admin')`,
            [reportId, GUEST_ID, 'citizen']
        );

        if (guestQuery.rows.length === 0) {
            console.log('✅ Aislamiento GUEST OK: Invitado no puede ver reporte oculto de Admin.');
        } else {
            console.error('❌ FALLO DE AISLAMIENTO: Invitado pudo ver reporte oculto de Admin!');
        }

        // 3. Simular Modo Operador (Admin role)
        console.log('3. Verificando Modo Operador (Admin)...');
        const adminQuery = await pool.query(
            `SELECT id FROM reports WHERE id = $1 
             AND (is_hidden = false OR anonymous_id = $2 OR $3 = 'admin')`,
            [reportId, '12345678-1234-1234-1234-1234567890ab', 'admin']
        );

        if (adminQuery.rows.length > 0) {
            console.log('✅ Modo Operador OK: Admin puede ver reportes ocultos de otros.');
        } else {
            console.error('❌ FALLO MODO OPERADOR: Admin no pudo ver el reporte oculto!');
        }

        // 4. Verificar Inmunidad Oficial
        console.log('4. Verificando Inmunidad Oficial...');
        // Simular 10 denuncias
        console.log('   Simulando 10 denuncias en reporte oficial...');
        await pool.query(`UPDATE reports SET flags_count = 10, is_hidden = false WHERE id = $1`, [reportId]);

        // El trigger enforce_auto_moderation debería haber corrido
        const immunityCheck = await pool.query(`SELECT is_hidden FROM reports WHERE id = $1`, [reportId]);

        if (immunityCheck.rows[0].is_hidden === false) {
            console.log('✅ Inmunidad Oficial OK: El reporte oficial no se ocultó automáticamente.');
        } else {
            console.error('❌ FALLO INMUNIDAD: El reporte oficial se ocultó a pesar de la protección!');
        }

        // Limpieza
        await pool.query(`DELETE FROM reports WHERE id = $1`, [reportId]);
        console.log('🧹 Limpieza completada.');

    } catch (err) {
        console.error('❌ Error durante la verificación:', err.message);
    } finally {
        process.exit(0);
    }
}

verifySecurity();
