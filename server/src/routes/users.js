import express from 'express';
import { queryWithRLS } from '../utils/rls.js';
import { requireAnonymousId } from '../utils/validation.js';
import { logError, logSuccess } from '../utils/logger.js';
import { ensureAnonymousUser } from '../utils/anonymousUser.js';
import supabase from '../config/supabase.js';

const router = express.Router();

/**
 * GET /api/users/profile
 * Get anonymous user profile/stats
 * Requires: X-Anonymous-Id header
 */
router.get('/profile', requireAnonymousId, async (req, res) => {
  console.log(`[BACKEND] GET /api/users/profile - ${req.anonymousId}`);
  try {
    const anonymousId = req.anonymousId;

    // CRITICAL: Validate anonymousId is present and valid before using in queries
    if (!anonymousId || typeof anonymousId !== 'string' || anonymousId.trim() === '') {
      logError(new Error('Invalid anonymousId in /profile'), req);
      return res.status(400).json({
        error: 'Invalid anonymous ID',
        message: 'Anonymous ID is required and must be a valid string'
      });
    }

    logSuccess('Fetching user profile', { anonymousId });

    // Get or create user (ensures user exists in DB)
    logSuccess('Ensuring anonymous user exists', { anonymousId });
    try {
      await ensureAnonymousUser(anonymousId);
    } catch (error) {
      logError(error, req);
      return res.status(500).json({
        error: 'Failed to ensure anonymous user'
      });
    }

    // Get user stats
    logSuccess('Fetching user stats', { anonymousId });
    const userResult = await queryWithRLS(
      anonymousId,
      `SELECT 
        anonymous_id,
        created_at,
        last_active_at,
        total_reports,
        total_comments,
        total_votes,
        points,
        level
      FROM anonymous_users
      WHERE anonymous_id = $1`,
      [anonymousId] // Explicit array with exactly one element
    );

    if (userResult.rows.length === 0) {
      logError(new Error('User not found after creation'), req);
      return res.status(404).json({
        error: 'User not found'
      });
    }

    // Get user's reports
    logSuccess('Fetching user reports', { anonymousId });
    const reportsResult = await queryWithRLS(
      anonymousId,
      `SELECT 
        id,
        title,
        status,
        upvotes_count,
        comments_count,
        created_at
      FROM reports
      WHERE anonymous_id = $1
      ORDER BY created_at DESC
      LIMIT 10`,
      [anonymousId] // Explicit array with exactly one element
    );

    logSuccess('User profile fetched successfully', {
      anonymousId,
      reportsCount: reportsResult.rows.length
    });

    res.json({
      success: true,
      data: {
        ...userResult.rows[0],
        recent_reports: reportsResult.rows
      }
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({
      error: 'Failed to fetch user profile'
    });
  }
});

/**
 * GET /api/users/stats
 * Get global statistics
 */
router.get('/stats', async (req, res) => {
  console.log('[STATS] GET /api/users/stats');
  try {
    // Stats are public, no anonymous_id needed
    // Use Supabase client to get stats with individual error handling for each count
    const [totalReportsResult, resolvedReportsResult, totalUsersResult, activeUsersResult] = await Promise.all([
      supabase.from('reports').select('id', { count: 'exact', head: true }).catch(e => ({ count: 0, error: e })),
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'resuelto').catch(e => ({ count: 0, error: e })),
      supabase.from('anonymous_users').select('anonymous_id', { count: 'exact', head: true }).catch(e => ({ count: 0, error: e })),
      supabase.from('anonymous_users').select('anonymous_id', { count: 'exact', head: true })
        .gt('last_active_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .catch(e => ({ count: 0, error: e }))
    ]);

    // We don't throw error here, just log if something failed and return what we have
    if (totalReportsResult.error) console.error('[STATS] totalReports count failed:', totalReportsResult.error.message);
    if (resolvedReportsResult.error) console.error('[STATS] resolvedReports count failed:', resolvedReportsResult.error.message);
    if (totalUsersResult.error) console.error('[STATS] totalUsers count failed:', totalUsersResult.error.message);
    if (activeUsersResult.error) console.error('[STATS] activeUsers count failed:', activeUsersResult.error.message);

    res.json({
      success: true,
      data: {
        total_reports: totalReportsResult.count || 0,
        resolved_reports: resolvedReportsResult.count || 0,
        total_users: totalUsersResult.count || 0,
        active_users_month: activeUsersResult.count || 0
      }
    });
  } catch (error) {
    console.error('[STATS] Unexpected error in global stats:', error);
    res.json({
      success: true, // Use true here to prevent frontend from showing error UI if possible
      data: { total_reports: 0, resolved_reports: 0, total_users: 0, active_users_month: 0 }
    });
  }
});

/**
 * GET /api/users/category-stats
 * Get report counts by category
 */
router.get('/category-stats', async (req, res) => {
  console.log('[STATS] GET /api/users/category-stats');
  try {
    // Get all reports with category field
    const { data: reports, error } = await supabase
      .from('reports')
      .select('category');

    if (error) {
      console.error('[STATS] category-stats query failed:', error.message);
    }

    // Initialize category counts (official categories only)
    const validCategories = ['Celulares', 'Bicicletas', 'Motos', 'Autos', 'Laptops', 'Carteras'];
    const categoryCounts = {
      'Celulares': 0,
      'Bicicletas': 0,
      'Motos': 0,
      'Autos': 0,
      'Laptops': 0,
      'Carteras': 0
    };

    // Count reports by category
    if (reports && Array.isArray(reports)) {
      reports.forEach((report) => {
        const category = report.category;
        if (category && typeof category === 'string' && validCategories.includes(category)) {
          categoryCounts[category]++;
        }
      });
    }

    res.json({
      success: true,
      data: categoryCounts
    });
  } catch (error) {
    console.error('[STATS] Unexpected error in category stats:', error);
    res.json({
      success: true,
      data: { 'Celulares': 0, 'Bicicletas': 0, 'Motos': 0, 'Autos': 0, 'Laptops': 0, 'Carteras': 0 }
    });
  }
});

export default router;

