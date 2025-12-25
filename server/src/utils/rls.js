import pool from '../config/database.js';

/**
 * Execute query with RLS context
 * Sets app.anonymous_id before query execution for Row Level Security
 */
export async function queryWithRLS(anonymousId, queryText, params = []) {
  const client = await pool.connect();
  try {
    // CRITICAL: Validate params array - ensure no undefined/null values
    if (!Array.isArray(params)) {
      throw new Error('Params must be an array');
    }
    
    // CRITICAL: Filter out any undefined/null values and validate
    const cleanParams = params.filter(p => p !== undefined && p !== null);
    if (cleanParams.length !== params.length) {
      throw new Error('Params array contains undefined or null values');
    }
    
    // CRITICAL: Count placeholders in query and validate against params
    const placeholderMatches = queryText.match(/\$\d+/g) || [];
    const placeholderCount = placeholderMatches.length;
    
    // CRITICAL: If query has placeholders, params must match exactly
    if (placeholderCount > 0 && cleanParams.length !== placeholderCount) {
      const error = new Error(
        `Parameter count mismatch: query has ${placeholderCount} placeholders (${placeholderMatches.join(', ')}) but ${cleanParams.length} params provided`
      );
      if (process.env.NODE_ENV === 'development') {
        console.error('[RLS ERROR]', error.message);
        console.error('[RLS ERROR] Query:', queryText);
        console.error('[RLS ERROR] Params:', cleanParams);
      }
      throw error;
    }
    
    // CRITICAL: If query has no placeholders, params must be empty
    if (placeholderCount === 0 && cleanParams.length > 0) {
      const error = new Error(
        `Query has no placeholders but ${cleanParams.length} params provided`
      );
      if (process.env.NODE_ENV === 'development') {
        console.error('[RLS ERROR]', error.message);
        console.error('[RLS ERROR] Query:', queryText);
        console.error('[RLS ERROR] Params:', cleanParams);
      }
      throw error;
    }
    
    // CRITICAL FIX: Set anonymous_id using safe literal interpolation
    // We CANNOT use $1 here because it conflicts with $1 in the main query
    // Since anonymousId is a validated UUID that we control, we can safely interpolate it
    if (anonymousId && anonymousId.trim() !== '') {
      // Validate it's a UUID format for safety (extra check)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(anonymousId)) {
        throw new Error(`Invalid UUID format for anonymousId: ${anonymousId}`);
      }
      // Escape single quotes in UUID (though UUIDs shouldn't have them, this is defensive)
      // Replace single quotes with double single quotes (SQL standard escaping)
      const escapedId = anonymousId.replace(/'/g, "''");
      // Use direct interpolation with single quotes - safe because we validated UUID format
      // This prevents parameter conflict with $1, $2, etc. in the main query
      await client.query(`SET LOCAL app.anonymous_id = '${escapedId}'`);
    } else {
      // For public/system queries, set to empty string
      // The current_anonymous_id() function will return NULL for empty strings
      await client.query("SET LOCAL app.anonymous_id = ''");
    }
    
    // Execute the actual query with its own parameters
    // Now $1, $2, etc. in the main query work correctly because SET LOCAL doesn't use parameters
    const result = await client.query(queryText, cleanParams);
    return result;
  } catch (error) {
    // Enhanced error logging for SQL syntax errors
    if (process.env.NODE_ENV === 'development') {
      console.error(`[RLS] Query failed:`, error.message);
      console.error(`[RLS] Query was:`, queryText);
      console.error(`[RLS] Params were:`, params);
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Execute transaction with RLS context
 */
export async function transactionWithRLS(anonymousId, callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Set anonymous_id in session for RLS policies
    // CRITICAL FIX: Use literal interpolation, not parameters, to avoid conflict with main query
    if (anonymousId && anonymousId.trim() !== '') {
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(anonymousId)) {
        throw new Error(`Invalid UUID format for anonymousId: ${anonymousId}`);
      }
      // Escape single quotes (defensive, UUIDs shouldn't have them)
      const escapedId = anonymousId.replace(/'/g, "''");
      await client.query(`SET LOCAL app.anonymous_id = '${escapedId}'`);
    } else {
      await client.query("SET LOCAL app.anonymous_id = ''");
    }
    
    // Execute callback
    const result = await callback(client);
    
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

