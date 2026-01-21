import pool from '../config/database.js';

/**
 * Servicio para el cálculo autoritativo del SafeScore.
 * Implementa el Algoritmo v1 definido en SAFESCORE_ARCHITECTURE.md
 */
export class SafeScoreService {

    // Pesos por categoría (Algoritmo v1)
    static CATEGORY_WEIGHTS = {
        'Robo de Vehículo': 1.5,
        'Robo de Bicicleta': 1.2,
        'Robo de Objetos Personales': 1.1,
        'Actividad Sospechosa': 1.0,
        'Acoso': 1.3,
        'Infraestructura': 0.5,
        'Otros': 0.2
    };

    /**
     * Obtiene el SafeScore de una zona. Si el caché expiró (>24h), recalcula.
     * @param {string} zoneId - ID de zona canonizado (ej: "palermo_caba")
     * @returns {Promise<{score: number, breakdown: object}>}
     */
    static async getZoneScore(zoneId) {
        if (!zoneId) return { score: 100, breakdown: {} };

        const res = await pool.query(
            `SELECT * FROM zone_safety_scores WHERE zone_id = $1`,
            [zoneId]
        );

        const data = res.rows[0];

        // Cache Hit: Si existe y es reciente (< 24h)
        if (data) {
            const ageHours = (new Date() - new Date(data.last_calculated_at)) / (1000 * 60 * 60);
            if (ageHours < 24) {
                return {
                    score: data.score,
                    breakdown: data.breakdown,
                    version: data.algorithm_version
                };
            }
        }

        // Cache Miss / Stale: Recalcular
        return await this.calculateAndPersist(zoneId);
    }

    /**
     * Calcula el score usando datos reales de DB y actualiza `zone_safety_scores`
     */
    static async calculateAndPersist(zoneId) {
        // En v1, buscamos reportes en un radio aproximado o por zona administrativa stringMatch
        // Para simplificar "Tu Zona" v1, usaremos coincidencia exacta de strings en 'zone' o 'address'
        // TODO (v2): Usar PostGIS polygon o hex index

        // 1. Obtener reportes últimos 30 días
        const reportsRes = await pool.query(`
            SELECT category, created_at, status 
            FROM reports 
            WHERE 
                (zone ILIKE $1 OR address ILIKE $1)
                AND created_at > NOW() - INTERVAL '30 days'
                AND deleted_at IS NULL
        `, [`%${this.normalizeZoneQuery(zoneId)}%`]);

        const reports = reportsRes.rows;

        // 2. Ejecutar Algoritmo v1
        const { score, breakdown } = this.calculateAlgorithmV1(reports);

        // 3. Persistir SSOT
        await pool.query(`
            INSERT INTO zone_safety_scores (zone_id, score, report_count, breakdown, last_calculated_at, algorithm_version)
            VALUES ($1, $2, $3, $4, NOW(), 'v1')
            ON CONFLICT (zone_id) DO UPDATE SET
                score = EXCLUDED.score,
                report_count = EXCLUDED.report_count,
                breakdown = EXCLUDED.breakdown,
                last_calculated_at = NOW(),
                algorithm_version = 'v1'
        `, [zoneId, score, reports.length, breakdown]);

        return { score, breakdown, version: 'v1' };
    }

    /**
     * Algoritmo Puro v1
     * BaseScore: 100
     * Penalties: Sum(Weight * RecencyFactor)
     */
    static calculateAlgorithmV1(reports) {
        if (!reports || reports.length === 0) {
            return { score: 100, breakdown: { factor: 'no_reports' } };
        }

        let totalPenalty = 0;
        let severitySum = 0;
        let recencySum = 0;

        const now = new Date();

        for (const r of reports) {
            // A. Severidad
            const weight = this.CATEGORY_WEIGHTS[r.category] || 0.5;
            severitySum += weight;

            // B. Recencia (Linear Decay: Hoy=1.0, hace 30 días=0.0)
            const daysAgo = (now - new Date(r.created_at)) / (1000 * 60 * 60 * 24);
            const recencyFactor = Math.max(0, 1 - (daysAgo / 30));
            recencySum += recencyFactor;

            // Penalty Calculation
            // Penalidad base por reporte * peso * recencia
            // Un robo hoy quita más puntos que un robo hace 20 días
            totalPenalty += (5 * weight * recencyFactor);
        }

        // C. Normalización (Evitar negativos)
        // Cap penalty a 99 (para dejar siempre min score 1)
        const finalPenalty = Math.min(99, Math.ceil(totalPenalty));
        const score = 100 - finalPenalty;

        return {
            score,
            breakdown: {
                totalReports: reports.length,
                avgSeverity: (severitySum / reports.length).toFixed(2),
                recencyImpact: (recencySum / reports.length).toFixed(2),
                totalPenalty: finalPenalty.toFixed(2)
            }
        };
    }

    static normalizeZoneQuery(zoneId) {
        // "palermo_caba" -> "Palermo"
        // Simplificación para v1
        if (!zoneId) return "";
        return zoneId.split('_')[0].replace(/-/g, ' ');
    }
}
