import pool from '../config/database.js';
import { realtimeEvents } from './eventEmitter.js';

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

    // PERFORMANCE FIX: Reduced from 5 roundtrips to 2
    // Original: BEGIN → SET timeout → SET RLS → query → COMMIT = 5 roundtrips
    // Now: SET config → query = 2 roundtrips
    // Note: PostgreSQL doesn't allow multiple statements with parameters

    // Prepare RLS context value
    let rlsValue = '';
    if (anonymousId && anonymousId.trim() !== '') {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(anonymousId)) {
        throw new Error(`Invalid UUID format for anonymousId: ${anonymousId}`);
      }
      rlsValue = anonymousId.replace(/'/g, "''");
    }

    // Query 1: Set config (no parameters, so can use multi-statement)
    await client.query(`
      SELECT set_config('statement_timeout', '15000', true),
             set_config('app.anonymous_id', '${rlsValue}', true)
    `);

    // Query 2: Execute actual query with parameters
    const result = await client.query(queryText, cleanParams);

    return result;
  } catch (error) {
    // No ROLLBACK needed - we no longer use explicit transactions

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
 * SSE Event Queue for transactional emission
 * Events are accumulated during transaction and only emitted after COMMIT
 */
class TransactionalSSE {
  constructor() {
    this.queue = [];
  }

  /**
   * Queue an SSE event to be emitted after commit
   * @param {string} method - realtimeEvents method name (e.g., 'emitNewComment')
   * @param  {...any} args - Arguments to pass to the method
   */
  emit(method, ...args) {
    if (typeof realtimeEvents[method] !== 'function') {
      console.error(`[TransactionalSSE] Invalid method: ${method}`);
      return;
    }
    this.queue.push({ method, args });
  }

  /**
   * Flush all queued events (call after COMMIT)
   */
  flush() {
    for (const event of this.queue) {
      try {
        realtimeEvents[event.method](...event.args);
      } catch (err) {
        console.error(`[TransactionalSSE] Failed to emit ${event.method}:`, err);
      }
    }
    this.queue = [];
  }

  /**
   * Discard all queued events (call on ROLLBACK)
   */
  discard() {
    const count = this.queue.length;
    this.queue = [];
    if (count > 0) {
      console.log(`[TransactionalSSE] Discarded ${count} events due to rollback`);
    }
  }
}

/**
 * Execute transaction with RLS context and transactional SSE support
 * 
 * @param {string} anonymousId - User identity for RLS
 * @param {function} callback - Async function receiving (client, sse)
 *   - client: PostgreSQL client for queries
 *   - sse: TransactionalSSE instance for queueing events
 * @returns {Promise<any>} Result from callback
 * 
 * @example
 * await transactionWithRLS(anonymousId, async (client, sse) => {
 *   const result = await client.query('INSERT INTO comments ...');
 *   sse.emit('emitNewComment', reportId, result.rows[0], clientId);
 *   return result.rows[0];
 * });
 * // SSE only emitted if transaction commits successfully
 */
export async function transactionWithRLS(anonymousId, callback) {
  const client = await pool.connect();
  const sse = new TransactionalSSE();

  try {
    await client.query('BEGIN');
    await client.query('SET statement_timeout = 30000'); // 30s for complex transactions

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

    // Execute callback with client AND sse queue
    const result = await callback(client, sse);

    await client.query('COMMIT');

    // ✅ P3 FIX: Only emit SSE events AFTER successful COMMIT
    sse.flush();

    return result;
  } catch (error) {
    await client.query('ROLLBACK');

    // ✅ P3 FIX: Discard all queued events on ROLLBACK
    sse.discard();

    throw error;
  } finally {
    client.release();
  }
}

// Export TransactionalSSE class for testing/advanced use cases
export { TransactionalSSE };

