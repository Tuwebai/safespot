import express from 'express';
import { requireAnonymousId } from '../utils/validation.js';
import { logError } from '../utils/logger.js';
import { ensureAnonymousUser } from '../utils/anonymousUser.js';
import { syncGamification } from '../utils/gamificationCore.js';
import supabase, { supabaseAdmin } from '../config/supabase.js';

const router = express.Router();

/**
 * GET /api/badges/all
 * Get all available badges (catalog)
 */
router.get('/all', async (req, res) => {
  try {
    const clientToUse = supabaseAdmin || supabase;
    const { data: badges, error } = await clientToUse
      .from('badges')
      .select('code, name, description, icon, category, points')
      .order('category', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      data: badges || []
    });
  } catch (error) {
    logError(error, req);
    res.json({ success: true, data: [] });
  }
});

/**
 * GET /api/badges/progress
 * Get user's badge progress (delegates to syncGamification)
 */
router.get('/progress', requireAnonymousId, async (req, res) => {
  try {
    const anonymousId = req.anonymousId;
    await ensureAnonymousUser(anonymousId);

    const result = await syncGamification(anonymousId);

    // Map back to legacy format if needed, but the new core format is cleaner
    const legacyBadges = result.badges.map(b => ({
      code: b.code,
      name: b.name,
      description: b.description,
      icon: b.icon,
      category: b.category,
      is_earned: b.obtained,
      awarded_at: b.awarded_at,
      obtained_at: b.awarded_at, // Both for compatibility
      progress: {
        current: b.progress.current,
        required: b.progress.required,
        progress: b.progress.required > 0 ? b.progress.current / b.progress.required : 0,
        text: b.obtained ? '¡Insignia obtenida!' : 'En progreso'
      }
    }));

    res.json({
      success: true,
      data: {
        badges: legacyBadges,
        earned_count: result.badges.filter(b => b.obtained).length,
        total_count: result.badges.length
      }
    });
  } catch (error) {
    logError(error, req);
    res.json({
      success: true,
      data: { badges: [], earned_count: 0, total_count: 0 }
    });
  }
});

export default router;

