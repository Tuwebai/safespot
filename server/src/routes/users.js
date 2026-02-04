import express from 'express';
import multer from 'multer';
import { queryWithRLS } from '../utils/rls.js';
import { requireAnonymousId, validateImageBuffer } from '../utils/validation.js';
import { logError, logSuccess, default as logger } from '../utils/logger.js';
import { ensureAnonymousUser } from '../utils/anonymousUser.js';
import { NotificationService } from '../utils/appNotificationService.js';
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

    // Only log in debug to avoid noise
    logger.debug('Fetching user profile', { anonymousId });

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
      `SELECT anonymous_id, created_at, last_active_at, total_reports, total_comments, total_votes, points, level, avatar_url, alias, is_official, role
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
 * GET /api/users/transparency-log
 * Get moderation history for the user's content
 * Requires: X-Anonymous-Id header
 */
router.get('/transparency-log', requireAnonymousId, async (req, res) => {
  try {
    const anonymousId = req.anonymousId;

    // Join with reports and comments to ensure the owner is the requester
    const query = `
      SELECT 
        ma.id, 
        ma.target_type, 
        ma.target_id, 
        ma.action_type, 
        ma.reason, 
        ma.created_at,
        CASE 
          WHEN ma.target_type = 'report' THEN r.title
          WHEN ma.target_type = 'comment' THEN SUBSTRING(co.content FROM 1 FOR 50)
        END as target_display_name
      FROM moderation_actions ma
      LEFT JOIN reports r ON ma.target_id = r.id AND ma.target_type = 'report'
      LEFT JOIN comments co ON ma.target_id = co.id AND ma.target_type = 'comment'
      WHERE (r.anonymous_id = $1 OR co.anonymous_id = $1)
      ORDER BY ma.created_at DESC
      LIMIT 50
    `;

    const result = await queryWithRLS(anonymousId, query, [anonymousId]);

    // [M12 REFINEMENT] Semantic Mapping for Users
    const USER_VISIBLE_ACTION_MAP = {
      'ADMIN_HIDE': 'Contenido ocultado por moderación',
      'ADMIN_RESTORE': 'Contenido restaurado por moderación',
      'AUTO_HIDE': 'Ocultado automáticamente por denuncias de la comunidad',
      'HIDE': 'Contenido ocultado',
      'RESTORE': 'Contenido restaurado',
      'SHADOW_BAN': 'Cuenta en revisión (Shadow Ban)',
      'AUTO_SHADOW_BAN': 'Cuenta en revisión automática',
      'ADMIN_DISMISS_FLAGS': 'Denuncias desestimadas'
    };

    const mappedEvents = result.rows.map(row => ({
      ...row,
      display_message: USER_VISIBLE_ACTION_MAP[row.action_type] || 'Acción de moderación aplicada'
    }));

    res.json({
      success: true,
      data: mappedEvents
    });

  } catch (error) {
    logError(error, req);
    res.status(500).json({ error: 'Failed to fetch transparency log' });
  }
});

/**
 * PUT /api/users/profile
 * Update user profile (specifically avatar_url)
 */
router.put('/profile', requireAnonymousId, async (req, res) => {
  try {
    const anonymousId = req.anonymousId;
    const { avatar_url, theme, accent_color, alias, interest_radius_meters } = req.body;

    // Validate if any field is provided
    if (avatar_url === undefined && theme === undefined && accent_color === undefined && alias === undefined && interest_radius_meters === undefined) {
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
    if (interest_radius_meters !== undefined) {
      const radius = parseInt(interest_radius_meters);
      if (isNaN(radius) || radius < 100 || radius > 10000) {
        return res.status(400).json({ error: 'Radio de interés inválido (100m - 10km)' });
      }
      updates.push(`interest_radius_meters = $${paramIndex++}`);
      values.push(radius);
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
/**
 * GET /api/users/stats
 * Get global statistics
 * CHANGED: Now runs live COUNT(*) to ensure 100% accuracy (Enterprise Grade)
 * Removed dependency on stale 'global_stats' table.
 */
router.get('/stats', async (req, res) => {
  // console.log('[STATS] GET /api/users/stats (Live Count)');
  try {
    // Parallelize valid counts for performance
    const [reportsCount, resolvedCount, usersCount] = await Promise.all([
      // Total Reports (Live)
      supabaseAdmin.from('reports').select('*', { count: 'exact', head: true }).is('deleted_at', null),

      // Resolved Reports (Live)
      supabaseAdmin.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'resuelto').is('deleted_at', null),

      // Total Users (Live)
      supabaseAdmin.from('anonymous_users').select('*', { count: 'exact', head: true })
    ]);

    res.json({
      success: true,
      data: {
        total_reports: reportsCount.count || 0,
        resolved_reports: resolvedCount.count || 0,
        total_users: usersCount.count || 0,
        active_users_month: 0 // Placeholder
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
 * CHANGED: Live Aggregation (Enterprise Grade)
 */
router.get('/category-stats', async (req, res) => {
  // console.log('[STATS] GET /api/users/category-stats (Live)');
  try {
    // Perform efficient Group By Count
    // CRITICAL: Use supabaseAdmin to bypass RLS
    const { data, error } = await supabaseAdmin
      .from('reports')
      .select('category');

    if (error) throw error;

    // Aggregate in memory (fast for <100k rows) or ideally use .rpc() for millions
    // Since Supabase .select doesn't support easy GroupBy w/ Counts in standard SDK without RPC,
    // we fetch columns and reduce. *Optimization: Create an RPC function if this gets slow.*

    // For now, to guarantee correctness without new SQL migrations:
    const categoryCounts = {
      'Celulares': 0, 'Bicicletas': 0, 'Motos': 0, 'Autos': 0, 'Laptops': 0, 'Carteras': 0
    };

    data.forEach(row => {
      if (categoryCounts[row.category] !== undefined) {
        categoryCounts[row.category]++;
      }
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

/**
 * GET /api/users/public/:alias
 * Get public profile of a user by alias
 */
router.get('/public/:alias', async (req, res) => {
  try {
    const { alias } = req.params;

    if (!alias) {
      return res.status(400).json({ error: 'Alias required' });
    }

    // Check if alias is a UUID (to support direct ID navigation)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(alias);

    const query = isUUID
      ? `SELECT anonymous_id, alias, avatar_url, level, points, total_reports, created_at, role, is_official
         FROM anonymous_users 
         WHERE anonymous_id = $1`
      : `SELECT anonymous_id, alias, avatar_url, level, points, total_reports, created_at, role, is_official
         FROM anonymous_users 
         WHERE LOWER(alias) = LOWER($1)`;

    // Public query - get user data
    const result = await queryWithRLS(
      '',
      query,
      [alias]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const publicProfile = result.rows[0];

    // Fetch Badges (Joined with badge details)
    const badgesResult = await queryWithRLS(
      '',
      `SELECT b.code, b.name, b.icon, b.description, b.rarity, ub.awarded_at
       FROM user_badges ub
       JOIN badges b ON ub.badge_id = b.id
       WHERE ub.anonymous_id = $1
       ORDER BY b.level DESC, ub.awarded_at DESC`,
      [publicProfile.anonymous_id]
    );

    // Calculate detailed stats (This could be cached or pre-calculated in a real high-scale app)
    // For now, we calculate on the fly for freshness
    const statsResult = await queryWithRLS(
      '',
      `SELECT 
         (SELECT COUNT(*) FROM reports WHERE anonymous_id = $1) as total_reports,
         (SELECT COUNT(*) FROM comments WHERE anonymous_id = $1) as total_comments,
         (SELECT COALESCE(SUM(upvotes_count), 0) FROM reports WHERE anonymous_id = $1) as report_upvotes,
         (SELECT COALESCE(SUM(upvotes_count), 0) FROM comments WHERE anonymous_id = $1) as comment_upvotes,
         (SELECT COUNT(DISTINCT created_at::date) FROM reports WHERE anonymous_id = $1 AND created_at > NOW() - INTERVAL '30 days') as active_days_30
       `,
      [publicProfile.anonymous_id]
    );

    const stats = statsResult.rows[0] || {};
    const trustScore = Math.min(100, 50 + (parseInt(stats.report_upvotes || 0) * 2) + (parseInt(stats.comment_upvotes || 0) * 0.5)); // Simple algo

    // Get public reports (limit to 10 most recent)
    const reportsResult = await queryWithRLS(
      '',
      `SELECT id, title, status, upvotes_count, created_at, category
       FROM reports 
       WHERE anonymous_id = $1
       AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 10`,
      [publicProfile.anonymous_id]
    );

    // 3. Get follow counts and trust score from stats (now using denormalized columns)
    const followStatsResult = await queryWithRLS(
      req.headers['x-anonymous-id'],
      `SELECT
           followers_count,
           following_count
         FROM anonymous_users
         WHERE anonymous_id = $1`,
      [publicProfile.anonymous_id]
    );

    const isFollowingResult = await queryWithRLS(
      req.headers['x-anonymous-id'],
      `SELECT EXISTS(SELECT 1 FROM followers WHERE follower_id = $1 AND following_id = $2) as is_following`,
      [req.headers['x-anonymous-id'], publicProfile.anonymous_id]
    );

    const followStats = followStatsResult.rows[0] || { followers_count: 0, following_count: 0 };
    const isFollowing = isFollowingResult.rows[0]?.is_following || false;

    // 4. Combine everything
    const profileData = {
      ...publicProfile,
      badges: badgesResult.rows,
      stats: {
        trust_score: Math.floor(trustScore),
        upvotes_received: parseInt(stats.report_upvotes) + parseInt(stats.comment_upvotes),
        active_days_30: parseInt(stats.active_days_30),
        followers_count: parseInt(followStats.followers_count) || 0,
        following_count: parseInt(followStats.following_count) || 0,
        is_following: isFollowing
      },
      recent_reports: reportsResult.rows
    };

    res.json({
      success: true,
      data: profileData
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({ error: 'Failed to fetch public profile' });
  }
});

/**
 * POST /api/users/follow/:followingId
 * Follow a user
 */
router.post('/follow/:followingId', requireAnonymousId, async (req, res) => {
  try {
    const followerId = req.anonymousId;
    const { followingId } = req.params;

    if (followerId === followingId) {
      return res.status(400).json({ error: 'No puedes seguirte a ti mismo' });
    }

    // Ensure users exist
    await ensureAnonymousUser(followerId);

    // Check if followingId exists
    const userCheck = await queryWithRLS('', 'SELECT 1 FROM anonymous_users WHERE anonymous_id = $1', [followingId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'El usuario a seguir no existe' });
    }

    await queryWithRLS(
      followerId,
      'INSERT INTO followers (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [followerId, followingId]
    );

    // Trigger Notification (Async)
    NotificationService.notifyNewFollower(followerId, followingId).catch(err => {
      console.error('[FOLLOW] Notification failed:', err.message);
    });

    res.json({ success: true, message: 'Usuario seguido' });
  } catch (error) {
    logError(error, req);
    res.status(500).json({ error: 'Error al seguir usuario' });
  }
});

/**
 * DELETE /api/users/follow/:followingId
 * Unfollow a user
 */
router.delete('/follow/:followingId', requireAnonymousId, async (req, res) => {
  try {
    const followerId = req.anonymousId;
    const { followingId } = req.params;

    await queryWithRLS(
      followerId,
      'DELETE FROM followers WHERE follower_id = $1 AND following_id = $2',
      [followerId, followingId]
    );

    res.json({ success: true, message: 'Dejaste de seguir al usuario' });
  } catch (error) {
    logError(error, req);
    res.status(500).json({ error: 'Error al dejar de seguir' });
  }
});


/**
 * GET /api/users/:identifier/followers
 * Get list of followers
 */
router.get('/:identifier/followers', async (req, res) => {
  try {
    const { identifier } = req.params;
    const currentUserId = req.headers['x-anonymous-id'];

    if (!identifier) return res.status(400).json({ error: 'Identifier required' });

    // Resolve Identifier to Anonymous ID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    const userQuery = isUUID
      ? `SELECT anonymous_id FROM anonymous_users WHERE anonymous_id = $1`
      : `SELECT anonymous_id FROM anonymous_users WHERE LOWER(alias) = LOWER($1)`;

    const userResult = await queryWithRLS('', userQuery, [identifier]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetUserId = userResult.rows[0].anonymous_id;

    // Get Followers List
    // We join with anonymous_users to get details
    // And check if current user is following them back
    const result = await queryWithRLS(
      currentUserId || '',
      `SELECT 
         u.anonymous_id, 
         u.alias, 
         u.avatar_url, 
         u.level,
         EXISTS(SELECT 1 FROM followers f2 WHERE f2.follower_id = $1 AND f2.following_id = u.anonymous_id) as is_following_back
       FROM followers f
       JOIN anonymous_users u ON f.follower_id = u.anonymous_id
       WHERE f.following_id = $2
       ORDER BY f.created_at DESC
       LIMIT 50`,
      [currentUserId || '00000000-0000-0000-0000-000000000000', targetUserId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({ error: 'Failed to fetch followers' });
  }
});

/**
 * GET /api/users/:identifier/following
 * Get list of users followed by target
 */
router.get('/:identifier/following', async (req, res) => {
  try {
    const { identifier } = req.params;
    const currentUserId = req.headers['x-anonymous-id'];

    if (!identifier) return res.status(400).json({ error: 'Identifier required' });

    // Resolve Identifier
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    const userQuery = isUUID
      ? `SELECT anonymous_id FROM anonymous_users WHERE anonymous_id = $1`
      : `SELECT anonymous_id FROM anonymous_users WHERE LOWER(alias) = LOWER($1)`;

    const userResult = await queryWithRLS('', userQuery, [identifier]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const targetUserId = userResult.rows[0].anonymous_id;

    // Get Following List
    const result = await queryWithRLS(
      currentUserId || '',
      `SELECT 
         u.anonymous_id, 
         u.alias, 
         u.avatar_url, 
         u.level,
         EXISTS(SELECT 1 FROM followers f2 WHERE f2.follower_id = $1 AND f2.following_id = u.anonymous_id) as is_following
       FROM followers f
       JOIN anonymous_users u ON f.following_id = u.anonymous_id
       WHERE f.follower_id = $2
       ORDER BY f.created_at DESC
       LIMIT 50`,
      [currentUserId || '00000000-0000-0000-0000-000000000000', targetUserId]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({ error: 'Failed to fetch following' });
  }
});


/**
 * GET /api/users/recommendations
 * Get user suggestions based on shared locality
 */
router.get('/recommendations', requireAnonymousId, async (req, res) => {
  try {
    const anonymousId = req.anonymousId;

    // 1. Determine User's Top Locality
    const localityResult = await queryWithRLS(
      anonymousId,
      `SELECT locality, COUNT(*) as report_count
       FROM reports
       WHERE anonymous_id = $1 AND locality IS NOT NULL AND locality != ''
       GROUP BY locality
       ORDER BY report_count DESC
       LIMIT 1`,
      [anonymousId]
    );

    let locality = null;
    let fallback = false;

    if (localityResult.rows.length > 0) {
      locality = localityResult.rows[0].locality;
    }

    let recommendations = [];

    // 2. Query Recommendations
    if (locality) {
      // Find users who reported in the same locality, exclude self/followed
      const recResult = await queryWithRLS(
        anonymousId,
        `SELECT DISTINCT ON (u.anonymous_id) 
           u.anonymous_id, 
           u.alias, 
           u.avatar_url, 
           u.level,
           $2 as common_locality
         FROM anonymous_users u
         JOIN reports r ON u.anonymous_id = r.anonymous_id
         WHERE r.locality = $2
           AND u.anonymous_id != $1
           AND u.alias IS NOT NULL AND u.alias != ''
           AND NOT EXISTS (SELECT 1 FROM followers f WHERE f.follower_id = $1 AND f.following_id = u.anonymous_id)
         ORDER BY u.anonymous_id, u.level DESC, u.last_active_at DESC
         LIMIT 20`,
        [anonymousId, locality]
      );
      recommendations = recResult.rows;
    }

    // 3. Fallback: Global Top Users if no local matches or no user locality
    if (recommendations.length < 5) {
      const excludeIds = [anonymousId, ...recommendations.map(r => r.anonymous_id)];

      const fallbackResult = await queryWithRLS(
        anonymousId,
        `SELECT 
           u.anonymous_id, 
           u.alias, 
           u.avatar_url, 
           u.level,
           'Global' as common_locality
         FROM anonymous_users u
         WHERE u.anonymous_id != ALL($1)
           AND u.alias IS NOT NULL AND u.alias != ''
           AND NOT EXISTS (SELECT 1 FROM followers f WHERE f.follower_id = $2 AND f.following_id = u.anonymous_id)
         ORDER BY u.level DESC, u.last_active_at DESC
         LIMIT $3`,
        [excludeIds, anonymousId, 20 - recommendations.length]
      );

      recommendations = [...recommendations, ...fallbackResult.rows];
      fallback = !locality;
    }

    res.json({
      success: true,
      data: recommendations,
      meta: {
        locality,
        is_fallback: fallback
      }
    });

  } catch (error) {
    logError(error, req);
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

/**
 * GET /api/users/nearby
 * Get users in the same locality/city
 */
/**
 * LOCATION SSOT
 *
 * The user's location MUST be read from anonymous_users.
 * notification_settings columns (last_known_city/province) are DEPRECATED 
 * and MUST NOT be used as a location source for queries.
 *
 * Breaking this invariant will cause:
 * - Empty "People Nearby" (if user has alerts off)
 * - Privacy bugs (showing user when they expect invisibility, or vice versa)
 * - UX inconsistency
 */

/**
 * PATCH /api/users/profile/location
 * Explicitly updates the user's current location (SSOT).
 * Does NOT affect notification settings.
 */
router.patch('/profile/location', requireAnonymousId, async (req, res) => {
  try {
    const anonymousId = req.anonymousId;
    const { city, province, lat, lng } = req.body;

    if (!city || !province) {
      return res.status(400).json({ error: 'City and Province are required' });
    }

    // Update SSOT in anonymous_users
    const result = await queryWithRLS(
      anonymousId,
      `UPDATE anonymous_users 
       SET current_city = $2, 
           current_province = $3, 
           last_geo_update = NOW()
       WHERE anonymous_id = $1
       RETURNING current_city, current_province`,
      [anonymousId, city, province]
    );

    // Optional: We might desire to update lat/lng if we stored them in profile too.
    // For now, based on migration, we added city/province.
    // Lat/Lng might still live in settings or we should have migrated them too?
    // User Prompt "Ajuste 2" body included lat/lng.
    // "Migración de Ubicación... current_city, current_province, last_geo_update".
    // It didn't explicitly say lat/lng columns in the table migration, but usually we need them for radius.
    // Let's stick to city/province for "People Nearby" text logic as requested.
    // But wait, "People Nearby" query uses locality string, so city/province is enough for that.
    // Geo-queries need lat/lng. 
    // IF we want full decoupling, `anonymous_users` should probably have git lat/lng or PostGIS point.
    // The instructions said "current_city, current_province".
    // I will stick to what was migrated.

    // Update Legacy Settings (DEPRECATED but kept for consistency if needed during transition)
    // We do NOT update them here to enforce decoupling? 
    // "notification_settings NO guarda ubicación: Solo preferencias". -> So we STOP updating them here.
    // Correct. We only update profile.

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

/**
 * GET /api/users/nearby
 * Get users in the same locality/city
 * Uses anonymous_users as SSOT.
 */
router.get('/nearby', requireAnonymousId, async (req, res) => {
  try {
    const anonymousId = req.anonymousId;

    // 1. Determine User's Top Locality from SSOT (anonymous_users)
    const profileResult = await queryWithRLS(
      anonymousId,
      `SELECT current_city as locality
       FROM anonymous_users 
       WHERE anonymous_id = $1`,
      [anonymousId]
    );

    let locality = null;
    let source = 'unknown';

    if (profileResult.rows.length > 0 && profileResult.rows[0].locality) {
      locality = profileResult.rows[0].locality;
      source = 'profile';
    } else {
      // Fallback: Legacy Reports (only if totally new user with no location set)
      const reportResult = await queryWithRLS(
        anonymousId,
        `SELECT locality
         FROM reports
         WHERE anonymous_id = $1 AND locality IS NOT NULL AND locality != ''
         GROUP BY locality
         ORDER BY COUNT(*) DESC
         LIMIT 1`,
        [anonymousId]
      );

      if (reportResult.rows.length > 0) {
        locality = reportResult.rows[0].locality;
        source = 'reports_fallback';
      }
    }

    if (!locality) {
      return res.json({
        success: true,
        data: [],
        meta: {
          locality: null,
          has_location_configured: false,
          source: null
        }
      });
    }

    // 2. Fetch users in that locality
    // Join on anonymous_users (SSOT) instead of settings/reports
    const usersResult = await queryWithRLS(
      anonymousId,
      `SELECT DISTINCT ON (u.anonymous_id) 
         u.anonymous_id, 
         u.alias, 
         u.avatar_url, 
         u.level,
         u.points,
         $2 as common_locality,
         EXISTS(SELECT 1 FROM followers f WHERE f.follower_id = $1 AND f.following_id = u.anonymous_id) as is_following
       FROM anonymous_users u
       WHERE 
         u.anonymous_id != $1
         AND u.alias IS NOT NULL AND u.alias != ''
         AND (
           u.current_city = $2
           OR
           translate(lower(u.current_city), 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU') = translate(lower($2), 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')
         )
       ORDER BY u.anonymous_id, u.last_active_at DESC
       LIMIT 50`,
      [anonymousId, locality]
    );

    res.json({
      success: true,
      data: usersResult.rows,
      meta: {
        locality,
        has_location_configured: true,
        source
      }
    });

  } catch (error) {
    logError(error, req);
    res.status(500).json({ error: 'Failed to fetch nearby users' });
  }
});

/**
 * GET /api/users/global
 * Get all users (Discovery)
 */
router.get('/global', requireAnonymousId, async (req, res) => {
  try {
    const anonymousId = req.anonymousId;
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;

    const result = await queryWithRLS(
      anonymousId,
      `SELECT 
         u.anonymous_id, 
         u.alias, 
         u.avatar_url, 
         u.level,
         u.points,
         EXISTS(SELECT 1 FROM followers f WHERE f.follower_id = $1 AND f.following_id = u.anonymous_id) as is_following
       FROM anonymous_users u
       WHERE u.anonymous_id != $1
         AND u.alias IS NOT NULL AND u.alias != ''
       ORDER BY u.last_active_at DESC
       LIMIT $2 OFFSET $3`,
      [anonymousId, limit, offset]
    );

    res.json({
      success: true,
      data: result.rows,
      meta: { page, has_more: result.rows.length === limit }
    });

  } catch (error) {
    logError(error, req);
    res.status(500).json({ error: 'Failed to fetch global community' });
  }
});

export default router;


