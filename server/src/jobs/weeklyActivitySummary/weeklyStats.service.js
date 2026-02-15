
import { DB } from '../../utils/db.js';
import { logError } from '../../utils/logger.js';
import { AppError } from '../../utils/AppError.js';

/**
 * WeeklyStatsService (JS)
 * 
 * Handles aggregation of report statistics for the Weekly Community Activity Summary.
 * Optimized for performance using specific DB indices.
 */
export const WeeklyStatsService = {

    /**
     * Calculate weekly stats for a specific zone.
     * @param {string} zoneName - The normalized zone name (e.g., "Palermo, Buenos Aires")
     * @param {Date} startDate - Start of the week (inclusive)
     * @param {Date} endDate - End of the week (exclusive)
     * @returns {Promise<{totalReceived: number, topCategory: string, diffPercent: number, prevTotal: number, zoneName: string}>}
     */
    async getZoneStats(zoneName, startDate, endDate) {
        const db = DB.public();
        
        // 1. Get current week stats
        const currentStatsQuery = `
            SELECT 
                COUNT(*) as total,
                MODE() WITHIN GROUP (ORDER BY category) as top_category
            FROM reports
            WHERE 
                zone = $1 
                AND created_at >= $2 
                AND created_at < $3
                AND status != 'rechazado'
                AND is_hidden = false
        `;
        
        // 2. Get previous week stats for comparison
        // Subtract 7 days from start/end
        const prevStartDate = new Date(startDate);
        prevStartDate.setDate(prevStartDate.getDate() - 7);
        const prevEndDate = new Date(endDate);
        prevEndDate.setDate(prevEndDate.getDate() - 7);

        const prevStatsQuery = `
            SELECT COUNT(*) as total
            FROM reports
            WHERE 
                zone = $1 
                AND created_at >= $2 
                AND created_at < $3
                AND status != 'rechazado'
                AND is_hidden = false
        `;

        try {
            const [currentRes, prevRes] = await Promise.all([
                db.query(currentStatsQuery, [zoneName, startDate, endDate]),
                db.query(prevStatsQuery, [zoneName, prevStartDate, prevEndDate])
            ]);

            const currentTotal = parseInt(currentRes.rows[0].total || 0, 10);
            const topCategory = currentRes.rows[0].top_category || null;
            const prevTotal = parseInt(prevRes.rows[0].total || 0, 10);

            // Calculate percentage difference
            let diffPercent = 0;
            if (prevTotal > 0) {
                diffPercent = Math.round(((currentTotal - prevTotal) / prevTotal) * 100);
            } else if (currentTotal > 0) {
                diffPercent = 100; // 100% increase if detailed
            }

            return {
                totalReceived: currentTotal,
                topCategory,
                diffPercent,
                prevTotal,
                zoneName
            };

        } catch (error) {
            logError(error, { context: 'WeeklyStatsService.getZoneStats', zoneName });
            throw new AppError('Failed to calculate zone stats', 500);
        }
    },

    /**
     * Get all DISTINCT zones that had activity in the last week.
     * This avoids iterating over zones with 0 activity.
     */
    async getActiveZones(startDate, endDate) {
        const db = DB.public();
        const query = `
            SELECT DISTINCT zone 
            FROM reports 
            WHERE created_at >= $1 AND created_at < $2
            AND zone IS NOT NULL
        `;
        const res = await db.query(query, [startDate, endDate]);
        return res.rows.map(r => r.zone);
    },

    /**
     * Get users subscribed to a specific zone who haven't been notified yet for this digest.
     * Using cursor-based approach implicitly via batching in the Job.
     */
    async getSubscribedUsers(zoneName) {
        const db = DB.public();
        
        const res = await db.query(`
            SELECT anonymous_id, type
            FROM user_zones
            WHERE zone_id = $1
        `, [zoneName]);
        
        return res.rows;
    }
};
