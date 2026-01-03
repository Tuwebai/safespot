import supabase, { supabaseAdmin } from '../config/supabase.js';
import { logError, logSuccess } from './logger.js';

// Local cache to avoid redundant Supabase lookups for existence check
// UUID keys are small, but we use a Map to keep it simple.
const existenceCache = new Map();
const CACHE_LIMIT = 5000;

/**
 * Ensure anonymous user exists in anonymous_users table
 * This function is idempotent - safe to call multiple times
 * Uses ONLY Supabase client (no SQL manual)
 * 
 * @param {string} anonymousId - UUID v4 of the anonymous user
 * @returns {Promise<boolean>} - true if user exists or was created, false on error
 */
export async function ensureAnonymousUser(anonymousId) {
  if (!anonymousId) {
    throw new Error('anonymousId is required');
  }

  // Check cache first (saves 150-300ms HTTP round-trip)
  if (existenceCache.has(anonymousId)) {
    return true;
  }

  try {
    // Use admin client to bypass RLS for system-level existence check/creation
    const clientToUse = supabaseAdmin || supabase;

    // Check if user already exists
    const { data: existingUser, error: checkError } = await clientToUse
      .from('anonymous_users')
      .select('anonymous_id')
      .eq('anonymous_id', anonymousId)
      .maybeSingle();

    if (checkError) {
      logError(checkError, null);
      throw new Error(`Failed to check anonymous user: ${checkError.message}`);
    }

    // If user exists, return early (idempotent)
    if (existingUser) {
      existenceCache.set(anonymousId, true);
      return true;
    }

    // User doesn't exist, create it
    const { data: newUser, error: insertError } = await clientToUse
      .from('anonymous_users')
      .insert({
        anonymous_id: anonymousId,
        created_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
        total_reports: 0,
        total_comments: 0,
        total_votes: 0,
        points: 0,
        level: 1
      })
      .select()
      .single();

    if (insertError) {
      // If error is due to duplicate (race condition), that's okay
      if (insertError.code === '23505') {
        logSuccess('Anonymous user already exists (race condition)', { anonymousId });
        existenceCache.set(anonymousId, true);
        return true;
      }

      logError(insertError, null);
      throw new Error(`Failed to create anonymous user: ${insertError.message}`);
    }

    logSuccess('Anonymous user created', { anonymousId });

    // Manage cache size
    if (existenceCache.size >= CACHE_LIMIT) {
      // Very simple eviction: clear the first one (Iterator of keys)
      const firstKey = existenceCache.keys().next().value;
      existenceCache.delete(firstKey);
    }
    existenceCache.set(anonymousId, true);

    return true;
  } catch (error) {
    logError(error, null);
    throw error;
  }
}

