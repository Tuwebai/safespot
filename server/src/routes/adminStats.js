import express from 'express';
import { DB, supabaseAdmin } from '../utils/db.js';
import { verifyAdminToken } from '../utils/adminMiddleware.js';

const router = express.Router();

/**
 * GET /api/admin/stats
 * Returns dashboard KPIs and recent activity
 */
router.get('/stats', verifyAdminToken, async (req, res) => {
    try {
        // 1. Calculate Active Users (Last 1 hour)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

        // Check if anonymous_users exists and has data. 
        // We'll try to count, but catch error specifically.
        let activeUsers = 0;
        try {
            const { count, error } = await supabaseAdmin
                .from('anonymous_users')
                .select('*', { count: 'exact', head: true })
                .gt('last_active_at', oneHourAgo);

            if (error) {
                console.warn('⚠️ Error counting active users (anonymous_users):', error);
                // Fallback: don't fail the whole request, just show 0
            } else {
                activeUsers = count || 0;
            }
        } catch (err) {
            console.warn('⚠️ Exception counting active users:', err);
        }

        // 2. New Reports (Last 24h)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        let newReports = 0;
        try {
            const { count, error } = await supabaseAdmin
                .from('reports')
                .select('*', { count: 'exact', head: true })
                .gt('created_at', twentyFourHoursAgo);

            if (error) {
                console.error('❌ Error counting reports:', error);
                throw error; // This is critical, we should probably fail or handle
            } else {
                newReports = count || 0;
            }
        } catch (err) {
            console.error('❌ Exception counting reports:', err);
            throw err;
        }

        // 3. Risk Level Logic
        let riskLevel = 'LOW';
        let riskMessage = 'Minimal activity';
        if (newReports > 50) {
            riskLevel = 'CRITICAL';
            riskMessage = 'High incident volume';
        } else if (newReports > 10) {
            riskLevel = 'MODERATE';
            riskMessage = 'Elevated activity';
        }

        // 4. Recent Activity Feed
        let recentActivity = [];
        try {
            const { data, error } = await supabaseAdmin
                .from('reports')
                .select(`
                    id, 
                    title, 
                    created_at, 
                    category, 
                    zone, 
                    anonymous_id,
                    anonymous_users (
                        avatar_url,
                        alias
                    )
                `)
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) {
                console.error('❌ Error fetching recent activity:', error);
                // Don't fail entire request
            } else {
                recentActivity = data || [];
            }
        } catch (err) {
            console.error('❌ Exception fetching activity:', err);
        }

        res.json({
            kpis: {
                activeUsers,
                newReports,
                riskLevel,
                riskMessage,
                systemStatus: 'OPERATIONAL'
            },
            recentActivity
        });

    } catch (error) {
        console.error('Admin Stats Fatal Error:', error);
        res.status(500).json({ error: 'Failed to fetch admin statistics' });
    }
});

export default router;
