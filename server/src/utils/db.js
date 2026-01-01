/**
 * Unified Database Access Layer
 * 
 * This module provides a consistent interface for database operations
 * that properly handles Row Level Security (RLS) context.
 * 
 * STRATEGY:
 * - Operations that require RLS context (INSERT/UPDATE/DELETE with ownership checks)
 *   MUST use queryWithRLS (SQL raw) to set app.anonymous_id
 * - Public SELECT operations (where RLS policy allows NULL) can use Supabase Client
 * - This ensures RLS policies work consistently across all endpoints
 * 
 * IMPORTANT: Supabase Client uses HTTP/REST and CANNOT set app.anonymous_id.
 * Therefore, any operation that depends on current_anonymous_id() in RLS policies
 * MUST use queryWithRLS, not Supabase Client.
 */

import { queryWithRLS } from './rls.js';
import supabase from '../config/supabase.js';

/**
 * Get a Supabase-like query builder that respects RLS
 * For operations that need RLS context, we use queryWithRLS
 * For public operations, we can use Supabase Client directly
 */
export class DB {
  constructor(anonymousId = null) {
    this.anonymousId = anonymousId;
  }

  /**
   * Create a DB instance with anonymous_id context
   */
  static withContext(anonymousId) {
    return new DB(anonymousId);
  }

  /**
   * Create a DB instance for public operations (no RLS context needed)
   */
  static public() {
    return new DB(null);
  }

  /**
   * SELECT operation with RLS context
   */
  async select(table, options = {}) {
    const {
      columns = '*',
      where = {},
      orderBy = null,
      limit = null,
      single = false
    } = options;

    // Build WHERE clause
    let whereClause = '';
    const params = [];
    let paramIndex = 1;

    const whereConditions = [];
    for (const [key, value] of Object.entries(where)) {
      if (value !== undefined && value !== null) {
        whereConditions.push(`${key} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
    }

    if (whereConditions.length > 0) {
      whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    }

    // Build ORDER BY clause
    let orderClause = '';
    if (orderBy) {
      if (typeof orderBy === 'string') {
        orderClause = `ORDER BY ${orderBy} ASC`;
      } else if (Array.isArray(orderBy)) {
        // Check if it's an array of objects [{ column: 'a', direction: 'desc' }] or simple [col, dir]
        if (orderBy.length > 0 && typeof orderBy[0] === 'object' && orderBy[0] !== null) {
          const parts = orderBy.map(o => `${o.column} ${(o.direction || 'ASC').toUpperCase()}`);
          orderClause = `ORDER BY ${parts.join(', ')}`;
        } else {
          // Legacy: [column, direction]
          const [column, direction = 'ASC'] = orderBy;
          orderClause = `ORDER BY ${column} ${direction.toUpperCase()}`;
        }
      }
    }

    // Build LIMIT clause (use parameterized query for safety)
    let limitClause = '';
    if (limit) {
      // Validate limit is a positive integer
      const limitNum = parseInt(limit, 10);
      if (isNaN(limitNum) || limitNum <= 0) {
        throw new Error('LIMIT must be a positive integer');
      }
      params.push(limitNum);
      limitClause = `LIMIT $${paramIndex}`;
      paramIndex++;
    }

    // Build query
    const query = `
      SELECT ${columns}
      FROM ${table}
      ${whereClause}
      ${orderClause}
      ${limitClause}
    `.trim();

    const result = await queryWithRLS(this.anonymousId, query, params);

    if (single) {
      return result.rows[0] || null;
    }

    return result.rows;
  }

  /**
   * INSERT operation with RLS context
   */
  async insert(table, data) {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    const query = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;

    const result = await queryWithRLS(this.anonymousId, query, values);
    return result.rows[0];
  }

  /**
   * UPDATE operation with RLS context
   */
  async update(table, data, where) {
    const setClause = Object.keys(data)
      .map((key, i) => `${key} = $${i + 1}`)
      .join(', ');

    const values = Object.values(data);
    let paramIndex = values.length + 1;

    const whereConditions = [];
    for (const [key, value] of Object.entries(where)) {
      whereConditions.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    const query = `
      UPDATE ${table}
      SET ${setClause}
      ${whereClause}
      RETURNING *
    `.trim();

    const result = await queryWithRLS(this.anonymousId, query, values);
    return result.rows;
  }

  /**
   * DELETE operation with RLS context
   */
  async delete(table, where) {
    const params = [];
    const whereConditions = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(where)) {
      whereConditions.push(`${key} = $${paramIndex}`);
      params.push(value);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0
      ? `WHERE ${whereConditions.join(' AND ')}`
      : '';

    const query = `
      DELETE FROM ${table}
      ${whereClause}
      RETURNING *
    `.trim();

    const result = await queryWithRLS(this.anonymousId, query, params);
    return result.rows;
  }

  /**
   * Execute raw SQL query with RLS context
   */
  async query(queryText, params = []) {
    return await queryWithRLS(this.anonymousId, queryText, params);
  }
}

/**
 * Export Supabase client for public operations (where RLS allows NULL)
 * Use this only for operations that don't require RLS context
 */
export { supabase };

/**
 * Export supabaseAdmin for storage operations (bypasses RLS)
 */
export { supabaseAdmin } from '../config/supabase.js';

