
import pool from './src/config/database.js';
import { SafeScoreService } from './src/services/safeScoreService.js';
import { UserZoneService } from './src/services/userZoneService.js';

async function verifySafeScore() {
    console.log('🚀 Iniciando Verificación SafeScore...');

    try {
        // 1. Esperar conexión DB
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 1.5 MIGRATION FORCE FIX (Para asegurar test environment)
        try {
            await pool.query("ALTER TABLE user_zones DROP CONSTRAINT IF EXISTS user_zones_type_check");
            await pool.query("ALTER TABLE user_zones ADD CONSTRAINT user_zones_type_check CHECK (type IN ('home', 'work', 'school', 'other', 'current'))");
            console.log('✅ Constraint fixed.');
        } catch (e) {
            console.warn('⚠️ Constraint fix warning:', e.message);
        }

        // 2. Crear Zona de Prueba
        const testZone = 'zona_test_verification';
        const testLat = -34.58;
        const testLng = -58.40;

        // 3. Limpiar datos previos
        await pool.query('DELETE FROM zone_safety_scores WHERE zone_id = $1', [testZone]);
        await pool.query('DELETE FROM user_zones WHERE zone_id = $1', [testZone]);
        await pool.query("DELETE FROM reports WHERE zone = 'Zona Test Verification'");

        // 3.5 Crear Usuario Dummy para FK
        const userId = '00000000-0000-0000-0000-000000000000'; // Fake UUID
        await pool.query(`INSERT INTO anonymous_users (anonymous_id) VALUES ($1) ON CONFLICT DO NOTHING`, [userId]);
        console.log('✅ Usuario dummy preparado.');

        // 4. Insertar Reportes Fake (1 Robo de Vehículo reciente)
        await pool.query(`
            INSERT INTO reports (
                id, title, description, category, latitude, longitude, zone, address, 
                status, anonymous_id, created_at, updated_at
            ) VALUES (
                gen_random_uuid(), 'Robo Test', 'Test description', 'Robo de Vehículo', 
                $1, $2, 'Zona Test Verification', 'Test Address',
                'abierto', $3, NOW(), NOW()
            )
        `, [testLat, testLng, userId]);

        console.log('✅ Reporte de prueba insertado.');

        // 5. Probar SafeScoreService (Recálculo)
        console.log('🔄 Calculando SafeScore...');
        const scoreData = await SafeScoreService.getZoneScore(testZone);

        console.log('📊 Resultado SafeScore:', scoreData);

        if (scoreData.score < 100 && scoreData.breakdown.totalReports === 1) {
            console.log('✅ SafeScore calculado correctamente (Score < 100 por penalidad).');
        } else {
            console.error('❌ SafeScore falló: Se esperaba score < 100 y totalReports 1.');
            process.exit(1);
        }

        // 5.5 Probar Lazy Migration
        console.log('🔄 Probando Lazy Migration desde notification_settings...');
        // Insertar dato legacy
        await pool.query(`
            INSERT INTO notification_settings (anonymous_id, last_known_lat, last_known_lng, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (anonymous_id) DO UPDATE SET 
                last_known_lat = EXCLUDED.last_known_lat,
                last_known_lng = EXCLUDED.last_known_lng
        `, [userId, testLat, testLng]);

        // Asegurar que NO existe en user_zones
        await pool.query('DELETE FROM user_zones WHERE anonymous_id = $1', [userId]);

        // Llamar a getUserZones (debería disparar la migración)
        const migratedZones = await UserZoneService.getUserZones(userId);

        if (migratedZones.length > 0 && migratedZones[0].type === 'current' && migratedZones[0].safety) {
            console.log('✅ Migración Lazy exitosa.');
        } else {
            console.error('❌ Falló Migración Lazy: No se creó la zona o falta safety data.', migratedZones);
            process.exit(1);
        }

        // 6. Probar UserZoneService (Persistencia)
        console.log('🔄 Probando UserZoneService...');
        // Mock result de geocodificación para evitar network en test si se quiere, 
        // pero probaremos el flow completo. Si falla geocodificación, usará fallback.

        const zoneResult = await UserZoneService.updateCurrentZone(userId, testLat, testLng, 'Zona Test Verification, CABA');
        console.log('📍 Resultado UserZone:', zoneResult);

        if (zoneResult.zone.label === 'Zona Test Verification, CABA' && zoneResult.safety.score === scoreData.score) {
            console.log('✅ UserZoneService integrado correctamente.');
        } else {
            console.error('❌ UserZoneService falló integración.');
            process.exit(1);
        }

        console.log('🎉 VERIFICACIÓN EXITOSA');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error Fatal:', error);
        process.exit(1);
    }
}

verifySafeScore();
