import express from 'express';
import multer from 'multer';
import { queryWithRLS } from '../utils/rls.js';
import { requireAnonymousId, validateImageBuffer } from '../utils/validation.js';
import { logError, logSuccess } from '../utils/logger.js';
import { ensureAnonymousUser } from '../utils/anonymousUser.js';
import supabase, { supabaseAdmin } from '../config/supabase.js';

const router = express.Router();

// Multer config for avatar uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB max for avatars
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Archivo de imagen inválido. Solo JPG, PNG o WEBP.'), false);
    }
  },
});

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
          avatar_url: null,
          recent_reports: []
        },
        warning: 'Usando perfil temporal por error de conexión.'
      });
    }

    // Get user stats
    const userResult = await queryWithRLS(
      anonymousId,
      `SELECT anonymous_id, created_at, last_active_at, total_reports, total_comments, total_votes, points, level, avatar_url, alias 
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
          points: 0,
          level: 1,
          avatar_url: null,
          theme: 'default',
          accent_color: 'green',
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
        points: 0,
        level: 1,
        avatar_url: null,
        theme: 'default',
        accent_color: 'green',
        recent_reports: []
      },
      error: 'Failed to fetch user profile'
    });
  }
});

/**
 * PUT /api/users/profile
 * Update user profile (specifically avatar_url)
 */
router.put('/profile', requireAnonymousId, async (req, res) => {
  try {
    const anonymousId = req.anonymousId;
    const { avatar_url, theme, accent_color, alias } = req.body;

    // Validate if any field is provided
    if (avatar_url === undefined && theme === undefined && accent_color === undefined && alias === undefined) {
      return res.status(400).json({ error: 'No fields to update provided' });
    }

    // Dynamic query construction
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (avatar_url !== undefined) {
      updates.push(`avatar_url = $${paramIndex++}`);
      values.push(avatar_url);
    }
    if (theme !== undefined) {
      updates.push(`theme = $${paramIndex++}`);
      values.push(theme);
    }
    if (accent_color !== undefined) {
      updates.push(`accent_color = $${paramIndex++}`);
      values.push(accent_color);
    }
    if (alias !== undefined) {
      // Basic validation for alias
      if (typeof alias !== 'string' || alias.length > 20) {
        return res.status(400).json({ error: 'Alias inválido (máx 20 caracteres)' });
      }
      updates.push(`alias = $${paramIndex++}`);
      values.push(alias);
    }

    values.push(anonymousId);

    const query = `UPDATE anonymous_users SET ${updates.join(', ')} WHERE anonymous_id = $${paramIndex} RETURNING *`;

    // Update query
    const result = await queryWithRLS(
      anonymousId,
      query,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Perfil actualizado correctamente'
    });

  } catch (error) {
    // Handle unique constraint violation for alias
    if (error.code === '23505' && error.constraint === 'anonymous_users_alias_key') {
      return res.status(409).json({
        error: 'Alias no disponible',
        message: 'Este alias ya está en uso. Por favor elige otro.'
      });
    }

    logError(error, req);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * POST /api/users/avatar
 * Upload a custom avatar
 */
router.post('/avatar', requireAnonymousId, upload.single('avatar'), async (req, res) => {
  try {
    const anonymousId = req.anonymousId;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Validate Image Content
    try {
      await validateImageBuffer(file.buffer);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid image data' });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Storage service not configured' });
    }

    // Use 'report-images' bucket but in 'avatars' folder
    const bucketName = 'report-images';
    const fileExt = file.originalname.split('.').pop() || 'jpg';
    // Use timestamp to prevent browser caching issues and simple uniqueness
    const fileName = `avatars/${anonymousId}/avatar-${Date.now()}.${fileExt}`;

    // Upload to Supabase
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true, // Overwrite previous avatar
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;

    // Update DB
    const result = await queryWithRLS(
      anonymousId,
      `UPDATE anonymous_users SET avatar_url = $1 WHERE anonymous_id = $2 RETURNING avatar_url`,
      [publicUrl, anonymousId]
    );

    res.json({
      success: true,
      data: { avatar_url: publicUrl },
      message: 'Avatar actualizado correctamente'
    });

  } catch (error) {
    logError(error, req);
    res.status(500).json({ error: 'Failed to upload avatar', details: error.message });
  }
});

/**
 * GET /api/users/search
 * Search users by alias for mentions
 */
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.json({ success: true, data: [] });
    }

    console.log(`[SEARCH] Query: "${q}"`);

    // Search users with aliases matching query
    // We only select necessary public info
    const result = await queryWithRLS(
      '', // Use empty string for system level query (sets app.anonymous_id = '')
      `SELECT alias, avatar_url, anonymous_id 
       FROM anonymous_users 
       WHERE alias ILIKE $1 
       AND alias IS NOT NULL 
       LIMIT 5`,
      [`%${q}%`]
    );

    console.log(`[SEARCH] Found ${result.rows.length} users`);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logError(error, req);
    res.json({ success: true, data: [] }); // Fail silently for autocomplete
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

