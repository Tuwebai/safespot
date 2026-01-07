import pool from '../config/database.js'; // Use direct DB pool
import { logError, logSuccess } from './logger.js';

// Local cache to avoid redundant Supabase lookups for existence check
// UUID keys are small, but we use a Map to keep it simple.
const existenceCache = new Map();
const CACHE_LIMIT = 5000;

const UPDATE_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Ensure anonymous user exists in anonymous_users table
 * This function is idempotent - safe to call multiple times
 * Uses DIRECT SQL (pg pool) for performance and reliability
 * 
 * @param {string} anonymousId - UUID v4 of the anonymous user
 * @returns {Promise<boolean>} - true if user exists or was created, false on error
 */
export async function ensureAnonymousUser(anonymousId) {
  if (!anonymousId) {
    throw new Error('anonymousId is required');
  }

  const now = Date.now();
  const cachedEntry = existenceCache.get(anonymousId);

  // Check cache first
  if (cachedEntry) {
    // If we have verified existence recently, just return
    // But if it's been a while, we should update last_active_at in background
    if (now - cachedEntry.lastChecked > UPDATE_INTERVAL_MS) {
      // Background update (fire and forget) to keep "active users" stats fresh
      pool.query(
        'UPDATE anonymous_users SET last_active_at = NOW() WHERE anonymous_id = $1',
        [anonymousId]
      ).catch(err => console.error('[AUTH] Exception updating last_active_at:', err.message));

      // Update cache timestamp immediately to prevent spamming
      existenceCache.set(anonymousId, { ...cachedEntry, lastChecked: now });
    }
    return true;
  }

  try {
    // 1. Try to INSERT directly (Optimistic: Assume new user mostly, or heavily cached)
    // Using ON CONFLICT DO NOTHING + RETURNING to check if it was inserted

    // Note: We access pool directly, so we are running as the DB User (typically admin/postgres)
    // This bypasses RLS naturally, which is what we want for this system-level check.

    // First, try to just select it (Read is cheaper than Write)
    const checkResult = await pool.query(
      'SELECT anonymous_id FROM anonymous_users WHERE anonymous_id = $1',
      [anonymousId]
    );

    if (checkResult.rows.length > 0) {
      // User exists
      existenceCache.set(anonymousId, { exists: true, lastChecked: now });

      // Update activity asynchronously
      pool.query(
        'UPDATE anonymous_users SET last_active_at = NOW() WHERE anonymous_id = $1',
        [anonymousId]
      ).catch(() => { });

      return true;
    }

    // User doesn't exist, Insert it
    const insertResult = await pool.query(
      `INSERT INTO anonymous_users (
        anonymous_id, 
        created_at, 
        last_active_at, 
        total_reports, 
        total_comments, 
        total_votes, 
        points, 
        level
       ) VALUES ($1, NOW(), NOW(), 0, 0, 0, 0, 1)
       ON CONFLICT (anonymous_id) DO NOTHING
       RETURNING anonymous_id`,
      [anonymousId]
    );

    // If inserted (or race condition handled)
    logSuccess('Anonymous user created/verified', { anonymousId });

    // Manage cache size
    if (existenceCache.size >= CACHE_LIMIT) {
      const firstKey = existenceCache.keys().next().value;
      existenceCache.delete(firstKey);
    }
    existenceCache.set(anonymousId, { exists: true, lastChecked: now });

    return true;
  } catch (error) {
    logError(error, null);
    // Don't throw, just log. The downstream queryWithRLS might fail if user really doesn't exist,
    // but we tried our best.
    throw error;
  }
}

