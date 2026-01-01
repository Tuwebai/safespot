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
    try {
      await ensureAnonymousUser(anonymousId);
    } catch (error) {
      console.warn(`[PROFILE] Failed to ensure user ${anonymousId}:`, error.message);
      // Fallback: Return a default skeleton profile instead of crashing
      return res.json({
        success: true,
        data: {
          anonymous_id: anonymousId,
          created_at: new Date().toISOString(),
          total_reports: 0,
          total_comments: 0,
          total_votes: 0,
          points: 0,
          level: 1,
          recent_reports: []
        },
        warning: 'Usando perfil temporal por error de conexión.'
      });
    }

    // Get user stats
    const userResult = await queryWithRLS(
      anonymousId,
      `SELECT anonymous_id, created_at, last_active_at, total_reports, total_comments, total_votes, points, level 
       FROM anonymous_users WHERE anonymous_id = $1`,
      [anonymousId]
    ).catch(e => {
      console.error('[PROFILE] user query failed:', e.message);
      return { rows: [] };
    });

    if (userResult.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          anonymous_id: anonymousId,
          created_at: new Date().toISOString(),
          total_reports: 0,
          total_comments: 0,
          total_votes: 0,
          points: 0,
          level: 1,
          recent_reports: []
        },
        warning: 'No pudimos encontrar tus datos guardados.'
      });
    }

    // Get user's reports
    const reportsResult = await queryWithRLS(
      anonymousId,
      `SELECT id, title, status, upvotes_count, comments_count, created_at
       FROM reports WHERE anonymous_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 10`,
      [anonymousId]
    ).catch(e => {
      console.error('[PROFILE] reports query failed:', e.message);
      return { rows: [] };
    });

    res.json({
      success: true,
      data: {
        ...userResult.rows[0],
        recent_reports: reportsResult.rows
      }
    });
  } catch (error) {
    console.error('[PROFILE] UNEXPECTED ERROR:', error);
    res.json({
      success: true,
      data: {
        anonymous_id: req.anonymousId,
        created_at: new Date().toISOString(),
        total_reports: 0,
        total_comments: 0,
        total_votes: 0,
        points: 0,
        level: 1,
        recent_reports: []
      },
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
    // Read from precalculated global_stats table (O(1))
    const { data: stats, error } = await supabase
      .from('global_stats')
      .select('total_reports, resolved_reports, total_users')
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      logError(error, req);
      // Fallback to zeros but keep success: true to avoid breaking UI
      return res.json({
        success: true,
        data: { total_reports: 0, resolved_reports: 0, total_users: 0, active_users_month: 0 }
      });
    }

    // Note: active_users_month is currently kept as a placeholder or handled by DB
    // For now we return what we have in O(1)
    res.json({
      success: true,
      data: {
        total_reports: parseInt(stats?.total_reports || 0, 10),
        resolved_reports: parseInt(stats?.resolved_reports || 0, 10),
        total_users: parseInt(stats?.total_users || 0, 10),
        active_users_month: 0 // Placeholder for now
      }
    });
  } catch (error) {
    logError(error, req);
    res.json({
      success: true,
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
    // Read category breakdown from global_stats (O(1))
    const { data: stats, error } = await supabase
      .from('global_stats')
      .select('reports_by_category')
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      logError(error, req);
    }

    // Default structure for official categories
    const validCategories = ['Celulares', 'Bicicletas', 'Motos', 'Autos', 'Laptops', 'Carteras'];
    const categoryCounts = {};

    validCategories.forEach(cat => {
      categoryCounts[cat] = parseInt(stats?.reports_by_category?.[cat] || 0, 10);
    });

    res.json({
      success: true,
      data: categoryCounts
    });
  } catch (error) {
    logError(error, req);
    res.json({
      success: true,
      data: { 'Celulares': 0, 'Bicicletas': 0, 'Motos': 0, 'Autos': 0, 'Laptops': 0, 'Carteras': 0 }
    });
  }
});

export default router;

