import supabase from '../config/supabase.js';
import { logError, logSuccess } from './logger.js';

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

  try {
    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
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
      return true;
    }

    // User doesn't exist, create it
    const { data: newUser, error: insertError } = await supabase
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
        return true;
      }
      
      logError(insertError, null);
      throw new Error(`Failed to create anonymous user: ${insertError.message}`);
    }

    logSuccess('Anonymous user created', { anonymousId });
    return true;
  } catch (error) {
    logError(error, null);
    throw error;
  }
}

