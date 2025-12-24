import pool from '../config/database.js';

/**
 * Execute query with RLS context
 * Sets app.anonymous_id before query execution for Row Level Security
 */
export async function queryWithRLS(anonymousId, queryText, params = []) {
  const client = await pool.connect();
  try {
    // Set anonymous_id in session for RLS policies
    // Empty string means no RLS context (for public/system queries)
    if (anonymousId && anonymousId.trim() !== '') {
      // Use a separate parameterized query to set the variable
      await client.query('SET LOCAL app.anonymous_id = $1', [anonymousId]);
    } else {
      // For public/system queries, set to empty string
      // The current_anonymous_id() function will return NULL for empty strings
      await client.query("SET LOCAL app.anonymous_id = ''");
    }
    
    // Execute the actual query with its own parameters
    // The parameters are independent from the SET LOCAL query above
    const result = await client.query(queryText, params);
    return result;
  } catch (error) {
    // Only log errors in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`[RLS] Query failed:`, error.message);
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
    if (anonymousId && anonymousId.trim() !== '') {
      await client.query('SET LOCAL app.anonymous_id = $1', [anonymousId]);
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

