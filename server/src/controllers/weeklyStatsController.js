
import { WeeklyStatsService } from '../jobs/weeklyActivitySummary/weeklyStats.service.js';
import { AppError } from '../utils/AppError.js';
import { logError } from '../utils/logger.js';

export const getWeeklyStats = async (req, res, next) => {
    try {
        const { zone } = req.query;

        if (!zone) {
            throw new AppError('Zone parameter is required', 400);
        }

        // Define Time Window (Previous Monday to this Sunday)
        // Similar logic to the Job, but maybe for "Current context" or "Last Week"
        // If the user asks for "Weekly Summary", it usually means the *completed* week.
        
        const now = new Date();
        const endDate = new Date(now);
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);

        // Calculate Stats
        const stats = await WeeklyStatsService.getZoneStats(zone, startDate, endDate);

        res.json({
            success: true,
            data: {
                ...stats,
                period: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
            }
        });

    } catch (error) {
        logError(error, { context: 'getWeeklyStats', zone: req.query.zone });
        next(error);
    }
};
