import express from 'express';
import { requireAnonymousId } from '../utils/validation.js';
import { logError } from '../utils/logger.js';
import { ensureAnonymousUser } from '../utils/anonymousUser.js';
import supabase from '../config/supabase.js';

const router = express.Router();

/**
 * GET /api/favorites
 * Get all favorite reports for the current anonymous user
 * Requires: X-Anonymous-Id header
 */
router.get('/', requireAnonymousId, async (req, res) => {
  try {
    const anonymousId = req.anonymousId;
    
    // Ensure anonymous user exists
    try {
      await ensureAnonymousUser(anonymousId);
    } catch (error) {
      logError(error, req);
      return res.status(500).json({
        error: 'Failed to ensure anonymous user',
        message: error.message
      });
    }
    
    // Get favorites with report details
    const { data: favorites, error: favoritesError } = await supabase
      .from('favorites')
      .select(`
        id,
        created_at,
        report:reports (*)
      `)
      .eq('anonymous_id', anonymousId)
      .order('created_at', { ascending: false });
    
    if (favoritesError) {
      logError(favoritesError, req);
      return res.status(500).json({
        error: 'Failed to fetch favorites',
        message: favoritesError.message
      });
    }
    
    // Extract reports from favorites
    const reports = favorites?.map(fav => ({
      ...fav.report,
      favorited_at: fav.created_at
    })) || [];
    
    res.json({
      success: true,
      data: reports,
      count: reports.length
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({
      error: 'Failed to fetch favorites',
      message: error.message
    });
  }
});

export default router;

