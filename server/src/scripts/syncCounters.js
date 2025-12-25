/**
 * Script to synchronize counters in the database
 * 
 * This script calls SQL functions to recalculate and fix desynchronized counters:
 * - reports.upvotes_count
 * - reports.comments_count
 * - comments.upvotes_count
 * - anonymous_users.total_reports
 * - anonymous_users.total_comments
 * - anonymous_users.total_votes
 * 
 * Usage:
 *   npm run sync:counters
 * 
 * Or directly:
 *   node server/src/scripts/syncCounters.js
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
// Try multiple paths for .env file
const envPaths = [
  join(__dirname, '../../../.env'),
  join(__dirname, '../../.env'),
  join(process.cwd(), '.env'),
  join(process.cwd(), 'server', '.env'),
];

for (const envPath of envPaths) {
  try {
    dotenv.config({ path: envPath });
    break;
  } catch (e) {
    // Continue to next path
  }
}

// Fallback to default dotenv.config() if no file found
if (!process.env.DATABASE_URL) {
  dotenv.config();
}

const isSupabase = process.env.DATABASE_URL?.includes('supabase.co') || 
                   process.env.DATABASE_URL?.includes('pooler.supabase.com');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isSupabase || process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false }
    : false,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,
});

/**
 * Synchronize all counters in the database
 */
async function syncCounters() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting counter synchronization...\n');
    
    // Check if functions exist
    const checkFunctions = await client.query(`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_name IN ('sync_all_counters', 'sync_report_counters', 'sync_user_counters')
    `);
    
    if (checkFunctions.rows.length === 0) {
      console.error('❌ Error: Sync functions not found in database.');
      console.error('   Please run the migration: database/migration_add_sync_counters_functions.sql');
      process.exit(1);
    }
    
    // Call sync_all_counters function
    const result = await client.query('SELECT * FROM sync_all_counters()');
    
    let totalFixed = 0;
    const results = {};
    
    // Process results
    for (const row of result.rows) {
      const tableName = row.table_name;
      const recordsFixed = parseInt(row.records_fixed, 10) || 0;
      const details = row.details || [];
      
      totalFixed += recordsFixed;
      results[tableName] = {
        fixed: recordsFixed,
        details: details
      };
      
      if (recordsFixed > 0) {
        console.log(`✅ ${tableName}: Fixed ${recordsFixed} record(s)`);
        
        // Show details for first few records (if any)
        if (Array.isArray(details) && details.length > 0) {
          const previewCount = Math.min(3, details.length);
          console.log(`   Preview (${previewCount} of ${details.length}):`);
          for (let i = 0; i < previewCount; i++) {
            const detail = details[i];
            if (detail.old_count !== undefined && detail.new_count !== undefined) {
              console.log(`   - ID ${detail.id}: ${detail.old_count} → ${detail.new_count}`);
            } else if (detail.reports || detail.comments || detail.votes) {
              const changes = [];
              if (detail.reports) changes.push(`reports: ${detail.reports.old} → ${detail.reports.new}`);
              if (detail.comments) changes.push(`comments: ${detail.comments.old} → ${detail.comments.new}`);
              if (detail.votes) changes.push(`votes: ${detail.votes.old} → ${detail.votes.new}`);
              console.log(`   - User ${detail.anonymous_id}: ${changes.join(', ')}`);
            }
          }
          if (details.length > previewCount) {
            console.log(`   ... and ${details.length - previewCount} more`);
          }
        }
      } else {
        console.log(`✓ ${tableName}: All counters are synchronized`);
      }
    }
    
    console.log(`\n📊 Summary: ${totalFixed} total record(s) fixed`);
    
    if (totalFixed > 0) {
      console.log('\n✅ Synchronization completed successfully!');
    } else {
      console.log('\n✅ All counters are already synchronized!');
    }
    
    return results;
    
  } catch (error) {
    console.error('\n❌ Error during synchronization:');
    console.error(error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    client.release();
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    await syncCounters();
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { syncCounters };

