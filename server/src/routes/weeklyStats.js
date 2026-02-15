
import express from 'express';
import { getWeeklyStats } from '../controllers/weeklyStatsController.js';
import { validateAuth } from '../middleware/auth.js'; // Optional: if we want to protect it, but digest might be public link?
// Phase 3 requirement says "Deep link". Usually these links have a token or are public (anonymous).
// SafeSpot backend is "Anonymous backend", but often uses `validateAuth` for session/device tracking.
// Since the frontend uses `WeeklySummaryPage` which might be accessed by anyone with the link, 
// we should probably allow anonymous access (rate limited).

const router = express.Router();

// GET /api/weekly-stats?zone=Palermo
router.get('/', getWeeklyStats);

export default router;
