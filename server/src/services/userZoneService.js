import pool from '../config/database.js';
import { SafeScoreService } from './safeScoreService.js';

export class UserZoneService {

    /**
     * Obtiene las zonas del usuario.
     * INCLUYE: Score de seguridad (Enrichment).
     * INCLUYE: Migración Lazy desde notification_settings (si no tiene zonas).
     */
    static async getUserZones(anonymousId) {
        // 1. Intentar obtener zonas existentes
        let zones = await this._fetchZonesWithScores(anonymousId);

        // 2. Lazy Migration: Si no tiene zonas, buscar en notification_settings
        if (zones.length === 0) {
            const migrationResult = await this._migrateFromSettings(anonymousId);
            if (migrationResult) {
                // Si migró, volver a buscar ya con el score calculado
                zones = await this._fetchZonesWithScores(anonymousId);
            }
        }

        return zones;
    }

    /**
     * Private: Consulta DB con JOIN a safety scores
     */
    static async _fetchZonesWithScores(anonymousId) {
        const res = await pool.query(`
            SELECT 
                uz.*,
                json_build_object(
                    'score', zss.score,
                    'breakdown', zss.breakdown,
                    'version', zss.algorithm_version,
                    'last_calculated_at', zss.last_calculated_at
                ) as safety
            FROM user_zones uz
            LEFT JOIN zone_safety_scores zss ON uz.zone_id = zss.zone_id
            WHERE uz.anonymous_id = $1
        `, [anonymousId]);

        // Limpiar null objects si join falla (zona nueva sin score aun)
        return res.rows.map(row => ({
            ...row,
            safety: row.safety.score !== null ? row.safety : null
        }));
    }

    /**
     * Private: Migración One-Time de settings antiguos
     */
    static async _migrateFromSettings(anonymousId) {
        try {
            // Check legacy settings existence
            const res = await pool.query(`
                SELECT last_known_lat, last_known_lng 
                FROM notification_settings 
                WHERE anonymous_id = $1 AND last_known_lat IS NOT NULL
            `, [anonymousId]);

            if (res.rows.length > 0) {
                const { last_known_lat, last_known_lng } = res.rows[0];
                console.log(`[UserZoneService] Migrating user ${anonymousId} from notification_settings...`);
                // Reutilizamos la lógica principal que ya resuelve nombre, id y score
                await this.updateCurrentZone(anonymousId, last_known_lat, last_known_lng);
                return true;
            }
        } catch (error) {
            console.warn('[UserZoneService] Migration warning:', error.message);
        }
        return false;
    }

    /**
     * Actualiza la zona actual del usuario basado en coordenadas.
     * Orquestador principal: Geocode -> Persist -> GetScore.
     */
    static async updateCurrentZone(anonymousId, lat, lng, clientProvidedLabel = null) {
        // 1. Resolver Zona Administrativa (Si no viene del cliente)
        // Preferimos el label del cliente si existe (ya geocodificó), sino backend
        let label = clientProvidedLabel;
        let zoneId = null;

        if (!label) {
            const geoData = await this.resolveZoneName(lat, lng);
            if (geoData) {
                label = geoData.display_name;
                zoneId = this.normalizeZoneId(geoData.city, geoData.province);
            }
        } else {
            // Generar zoneId simple del label
            const parts = label.split(',');
            zoneId = this.normalizeZoneId(parts[0], parts[1]);
        }

        // Fallback si falla todo
        if (!label) label = 'Zona Desconocida';
        if (!zoneId) zoneId = 'unknown_zone';

        // 2. Persistir en user_zones (Type: 'current')
        const savedZone = await this.persistUserZone(anonymousId, 'current', lat, lng, zoneId, label);

        // 3. Obtener SafeScore de la zona resuelta
        const safetyData = await SafeScoreService.getZoneScore(zoneId);

        return {
            zone: savedZone,
            safety: safetyData
        };
    }

    /**
     * Persiste la zona en DB (Upsert)
     */
    static async persistUserZone(anonymousId, type, lat, lng, zoneId, label) {
        const res = await pool.query(`
            INSERT INTO user_zones (anonymous_id, type, lat, lng, zone_id, label, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW())
            ON CONFLICT (anonymous_id, type) DO UPDATE SET
                lat = EXCLUDED.lat,
                lng = EXCLUDED.lng,
                zone_id = EXCLUDED.zone_id,
                label = EXCLUDED.label,
                updated_at = NOW()
            RETURNING *
        `, [anonymousId, type, lat, lng, zoneId, label]);

        return res.rows[0];
    }

    /**
     * Normaliza nombre de ciudad/provincia a ID (ej: "Palermo", "CABA" -> "palermo_caba")
     */
    static normalizeZoneId(city, province) {
        const c = (city || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
        const p = (province || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
        if (!c) return p || 'unknown';
        if (!p) return c;
        return `${c}_${p}`;
    }

    /**
     * Resolución Geográfica (Geocodificación Inversa)
     * Reutiliza lógica similar a rutas pero encapsulada
     */
    static async resolveZoneName(lat, lng) {
        try {
            // 1. Intentar Georef AR (Open Data)
            const georefUrl = `https://apis.datos.gob.ar/georef/api/ubicacion?lat=${lat}&lon=${lng}`;
            const res = await fetch(georefUrl);
            if (res.ok) {
                const data = await res.json();
                if (data.ubicacion && data.ubicacion.provincia) {
                    const prov = data.ubicacion.provincia.nombre;
                    const muni = data.ubicacion.municipio?.nombre; // O departamento
                    const city = muni && muni !== 'null' ? muni : data.ubicacion.departamento?.nombre;

                    return {
                        city: city || prov,
                        province: prov,
                        display_name: `${city ? city + ', ' : ''}${prov}, Argentina`
                    };
                }
            }
        } catch (e) {
            console.warn('[UserZoneService] Georef failed:', e.message);
        }

        // 2. Fallback Nominatim (OSM)
        try {
            const nomUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`;
            const res = await fetch(nomUrl, {
                headers: { 'User-Agent': 'SafeSpot-Backend/1.0' }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.address) {
                    const city = data.address.city || data.address.town || data.address.suburb || data.address.neighborhood;
                    const state = data.address.state || data.address.region;
                    return {
                        city: city || 'Zona',
                        province: state || '',
                        display_name: data.display_name
                    };
                }
            }
        } catch (e) {
            console.error('[UserZoneService] Nominatim failed:', e.message);
        }

        return null;
    }
}
