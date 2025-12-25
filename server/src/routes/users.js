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
        error: 'Failed to ensure anonymous user',
        message: error.message
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
      error: 'Failed to fetch user profile',
      message: error.message
    });
  }
});

/**
 * GET /api/users/stats
 * Get global statistics
 */
router.get('/stats', async (req, res) => {
  try {
    // Stats are public, no anonymous_id needed
    // Use Supabase client to get stats
    const [totalReportsResult, resolvedReportsResult, totalUsersResult, activeUsersResult] = await Promise.all([
      supabase.from('reports').select('id', { count: 'exact', head: true }),
      supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'resuelto'),
      supabase.from('anonymous_users').select('anonymous_id', { count: 'exact', head: true }),
      supabase.from('anonymous_users').select('anonymous_id', { count: 'exact', head: true })
        .gt('last_active_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    ]);
    
    if (totalReportsResult.error) throw totalReportsResult.error;
    if (resolvedReportsResult.error) throw resolvedReportsResult.error;
    if (totalUsersResult.error) throw totalUsersResult.error;
    if (activeUsersResult.error) throw activeUsersResult.error;
    
    logSuccess('Global stats fetched');
    
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
    logError(error, req);
    res.status(500).json({
      error: 'Failed to fetch stats',
      message: error.message
    });
  }
});

/**
 * GET /api/users/category-stats
 * Get report counts by category
 */
router.get('/category-stats', async (req, res) => {
  try {
    // Get all reports with category field
    // Supabase doesn't support GROUP BY directly, so we fetch all and count in memory
    const { data: reports, error } = await supabase
      .from('reports')
      .select('category');
    
    if (error) {
      logError(error, req);
      return res.status(500).json({
        error: 'Failed to fetch category stats',
        message: error.message
      });
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
    
    // Count reports by category (exact match - categories are now standardized)
    if (reports && Array.isArray(reports)) {
      reports.forEach((report) => {
        const category = report.category;
        if (category && typeof category === 'string' && validCategories.includes(category)) {
          categoryCounts[category]++;
        }
      });
    }
    
    logSuccess('Category stats fetched', { counts: categoryCounts });
    
    res.json({
      success: true,
      data: categoryCounts
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({
      error: 'Failed to fetch category stats',
      message: error.message
    });
  }
});

export default router;

