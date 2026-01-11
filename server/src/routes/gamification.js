import express from 'express';
import { requireAnonymousId } from '../utils/validation.js';
import { logError, logSuccess } from '../utils/logger.js';
import { ensureAnonymousUser } from '../utils/anonymousUser.js';
import { syncGamification, getGamificationProfile } from '../utils/gamificationCore.js';

const router = express.Router();

/**
 * GET /api/gamification/badges
 * Get all badges with user's progress
 */
router.get('/badges', requireAnonymousId, async (req, res) => {
  try {
    const anonymousId = req.anonymousId;
    await ensureAnonymousUser(anonymousId);

    const result = await syncGamification(anonymousId);

    res.json({
      success: true,
      badges: result.badges,
      newBadges: result.profile.newlyAwarded
    });
  } catch (error) {
    logError(error, req);
    res.status(500).json({ error: 'Failed to fetch badges' });
  }
});

/**
 * GET /api/gamification/summary
 * OPTIMIZED: Read-only endpoint for Home and Profile (no writes)
 */
router.get('/summary', requireAnonymousId, async (req, res) => {
  const anonymousId = req.anonymousId;

  try {
    // 1. Ensure user exists (idempotent)
    await ensureAnonymousUser(anonymousId);

    // 2. Get current state (READ-ONLY, no badge awarding)
    const data = await getGamificationProfile(anonymousId);

    // 3. Return consistent structure
    return res.json({
      success: true,
      data: {
        profile: {
          level: data.profile.level,
          points: data.profile.points,
          total_reports: data.metrics.reports_created,
          total_comments: data.metrics.comments_created,
          total_votes: data.metrics.votes_cast
        },
        badges: data.badges.map(b => ({
          ...b,
          obtained_at: b.awarded_at // Duplicate for frontend compatibility
        })),
        newBadges: data.profile.newlyAwarded,
        nextAchievement: data.nextAchievement
      }
    });

  } catch (error) {
    logError(error, req);

    // Provide a safe fallback response so the frontend doesn't break
    return res.json({
      success: true,
      data: {
        profile: { level: 1, points: 0, total_reports: 0, total_comments: 0, total_votes: 0 },
        badges: [],
        newBadges: [],
        warning: 'Error al sincronizar datos, mostrando valores temporales.'
      }
    });
  }
});

/**
 * POST /api/gamification/evaluate
 * Explicitly trigger sync (WRITE mode)
 */
router.post('/evaluate', requireAnonymousId, async (req, res) => {
  try {
    const result = await syncGamification(req.anonymousId);
    res.json({
      success: true,
      newly_awarded: result.profile.newlyAwarded,
      count: result.profile.newlyAwarded.length,
      points: result.profile.points
    });
  } catch (error) {
    logError(error, req);
    res.json({ success: true, newly_awarded: [], count: 0 });
  }
});

export default router;
