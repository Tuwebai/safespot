import pool from '../config/database.js';

/**
 * Execute query with RLS context
 * Sets app.anonymous_id before query execution for Row Level Security
 */
export async function queryWithRLS(anonymousId, queryText, params = []) {
  const client = await pool.connect();
  try {
    // CRITICAL: Validate params array
    if (!Array.isArray(params)) {
      throw new Error('Params must be an array');
    }

    // CRITICAL: Only reject undefined - null is VALID for nullable SQL columns (e.g., parent_id)
    // undefined = JavaScript concept, doesn't exist in SQL
    // null = Valid SQL value for nullable columns
    const hasUndefined = params.some(p => p === undefined);
    if (hasUndefined) {
      const undefinedIndices = params
        .map((p, i) => p === undefined ? i : -1)
        .filter(i => i !== -1);
      console.error('[RLS ERROR] Undefined params at indices:', undefinedIndices);
      throw new Error(`Params array contains undefined values at indices: ${undefinedIndices.join(', ')}`);
    }

    // Use params directly (null values are valid)
    const cleanParams = params;

    // CRITICAL: Count UNIQUE placeholders in query and validate against params
    // PostgreSQL allows reusing the same parameter ($1) multiple times
    const placeholderMatches = queryText.match(/\$\d+/g) || [];
    const uniquePlaceholders = new Set(placeholderMatches);
    const maxPlaceholderIndex = placeholderMatches.length > 0
      ? Math.max(...placeholderMatches.map(m => parseInt(m.replace('$', ''))))
      : 0;

    // CRITICAL: Params must match the highest placeholder index
    // If query has $1, $2, $3, we need at least 3 params (even if $1 is used twice)
    if (maxPlaceholderIndex > 0 && cleanParams.length < maxPlaceholderIndex) {
      const error = new Error(
        `Parameter count mismatch: query has placeholder $${maxPlaceholderIndex} but only ${cleanParams.length} params provided`
      );
      if (process.env.NODE_ENV === 'development') {
        console.error('[RLS ERROR]', error.message);
        console.error('[RLS ERROR] Query:', queryText);
        console.error('[RLS ERROR] Params:', cleanParams);
        console.error('[RLS ERROR] Placeholders found:', Array.from(uniquePlaceholders).join(', '));
      }
      throw error;
    }

    // CRITICAL: If query has no placeholders, params must be empty
    if (maxPlaceholderIndex === 0 && cleanParams.length > 0) {
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

    // FIX: Execute SET LOCAL and the main query separately.
    // The pg driver does NOT allow multiple commands in a prepared statement (one with parameters).
    if (anonymousId && anonymousId.trim() !== '') {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(anonymousId)) {
        throw new Error(`Invalid UUID format for anonymousId: ${anonymousId}`);
      }
      const escapedId = anonymousId.replace(/'/g, "''");
      await client.query(`SET LOCAL app.anonymous_id = '${escapedId}'`);
    } else {
      await client.query("SET LOCAL app.anonymous_id = ''");
    }

    // Execute the actual query with its own parameters
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

