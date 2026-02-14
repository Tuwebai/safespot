#!/usr/bin/env node
/**
 * 🔍 SafeSpot Database Audit Script
 * 
 * Audits the real database to verify schema, indexes, and RLS policies.
 * 
 * @usage: node scripts/db-audit.js
 */

import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✅${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}❌${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.cyan}${msg}${colors.reset}\n${'='.repeat(60)}`)
};

async function auditDatabase() {
  log.header('🔍 SAFESPOT DATABASE AUDIT - NOTIFICATIONS SYSTEM');
  
  if (!process.env.DATABASE_URL) {
    log.error('DATABASE_URL not found in environment');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    log.info('Connecting to database...');
    const client = await pool.connect();
    log.success('Connected to database\n');

    // ==========================================
    // 1. TABLES
    // ==========================================
    log.header('1. NOTIFICATION TABLES STATUS');
    
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const tables = tablesResult.rows.map(r => r.table_name);
    const requiredTables = ['notifications', 'notification_settings', 'push_subscriptions'];
    
    requiredTables.forEach(table => {
      if (tables.includes(table)) {
        log.success(`${table} table EXISTS`);
      } else {
        log.error(`${table} table NOT FOUND`);
      }
    });

    // ==========================================
    // 2. NOTIFICATIONS TABLE STRUCTURE
    // ==========================================
    log.header('2. NOTIFICATIONS TABLE STRUCTURE');
    
    const columnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'notifications'
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    console.log(`Found ${columnsResult.rows.length} columns:\n`);
    columnsResult.rows.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
      log.info(`${col.column_name}: ${col.data_type} ${nullable}${defaultVal}`);
    });

    // Check for expected columns
    const columnNames = columnsResult.rows.map(r => r.column_name);
    const expectedColumns = ['push_sent_at', 'updated_at', 'metadata'];
    
    console.log('');
    expectedColumns.forEach(col => {
      if (columnNames.includes(col)) {
        log.success(`Column ${col} EXISTS`);
      } else {
        log.warning(`Column ${col} NOT FOUND (recommended)`);
      }
    });

    // ==========================================
    // 3. NOTIFICATIONS INDEXES
    // ==========================================
    log.header('3. NOTIFICATIONS INDEXES');
    
    const indexesResult = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'notifications'
      AND schemaname = 'public'
    `);
    
    if (indexesResult.rows.length === 0) {
      log.error('No indexes found on notifications table');
    } else {
      log.success(`Found ${indexesResult.rows.length} index(es):`);
      indexesResult.rows.forEach(idx => {
        log.info(`• ${idx.indexname}`);
      });
      
      // Check for composite index
      const hasCompositeIndex = indexesResult.rows.some(r => 
        r.indexname.includes('anonymous_id') && r.indexname.includes('is_read') && r.indexname.includes('created')
      );
      
      if (!hasCompositeIndex) {
        log.warning('\nMissing recommended composite index:');
        log.warning('CREATE INDEX idx_notifications_user_read_created');
        log.warning('ON notifications(anonymous_id, is_read, created_at DESC);');
      }
    }

    // ==========================================
    // 4. RLS STATUS
    // ==========================================
    log.header('4. ROW LEVEL SECURITY (RLS)');
    
    const rlsResult = await client.query(`
      SELECT relrowsecurity 
      FROM pg_class 
      WHERE relname = 'notifications'
    `);
    
    const rlsEnabled = rlsResult.rows[0]?.relrowsecurity === true;
    
    if (rlsEnabled) {
      log.success('RLS is ENABLED on notifications table');
    } else {
      log.error('RLS is NOT ENABLED on notifications table');
      log.warning('CRITICAL: All users can access all notifications');
    }

    // ==========================================
    // 5. NOTIFICATIONS STATISTICS
    // ==========================================
    log.header('5. NOTIFICATIONS STATISTICS');
    
    const statsResult = await client.query(`
      SELECT 
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE is_read = false) as unread_count,
        COUNT(DISTINCT anonymous_id) as unique_users,
        MIN(created_at) as oldest_notification,
        MAX(created_at) as newest_notification
      FROM notifications
    `);
    
    const stats = statsResult.rows[0];
    log.info(`Total notifications: ${stats.total_count}`);
    log.info(`Unread notifications: ${stats.unread_count}`);
    log.info(`Unique users with notifications: ${stats.unique_users}`);
    log.info(`Oldest: ${stats.oldest_notification}`);
    log.info(`Newest: ${stats.newest_notification}`);

    // Check for old notifications (TTL issue)
    const oldNotifsResult = await client.query(`
      SELECT COUNT(*) 
      FROM notifications 
      WHERE created_at < NOW() - INTERVAL '90 days'
    `);
    
    const oldCount = oldNotifsResult.rows[0].count;
    if (parseInt(oldCount) > 0) {
      log.warning(`\n${oldCount} notifications older than 90 days (no TTL cleanup)`);
    } else {
      log.success('No old notifications (good TTL hygiene)');
    }

    // ==========================================
    // 6. NOTIFICATION_SETTINGS TABLE
    // ==========================================
    log.header('6. NOTIFICATION_SETTINGS STRUCTURE');
    
    const settingsColsResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'notification_settings'
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    settingsColsResult.rows.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
      log.info(`${col.column_name}: ${col.data_type} ${nullable}${defaultVal}`);
    });

    // ==========================================
    // 7. PUSH_SUBSCRIPTIONS TABLE
    // ==========================================
    log.header('7. PUSH_SUBSCRIPTIONS STRUCTURE');
    
    const pushColsResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'push_subscriptions'
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    pushColsResult.rows.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      log.info(`${col.column_name}: ${col.data_type} ${nullable}`);
    });

    // Check for inactive subscriptions
    const inactiveResult = await client.query(`
      SELECT COUNT(*) 
      FROM push_subscriptions 
      WHERE is_active = false OR expired = true
    `);
    
    const inactiveCount = inactiveResult.rows[0].count;
    if (parseInt(inactiveCount) > 0) {
      log.warning(`\n${inactiveCount} inactive/expired push subscriptions (cleanup opportunity)`);
    }

    // ==========================================
    // 8. FOREIGN KEY CONSTRAINTS
    // ==========================================
    log.header('8. FOREIGN KEY CONSTRAINTS');
    
    const fkResult = await client.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table,
        ccu.column_name AS foreign_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name IN ('notifications', 'notification_settings', 'push_subscriptions')
    `);
    
    if (fkResult.rows.length === 0) {
      log.warning('No foreign key constraints found on notification tables');
      log.warning('Risk: Orphaned records if users are deleted');
    } else {
      log.success(`Found ${fkResult.rows.length} FK constraint(s):`);
      fkResult.rows.forEach(fk => {
        log.info(`• ${fk.table_name}.${fk.column_name} → ${fk.foreign_table}.${fk.foreign_column}`);
      });
    }

    // ==========================================
    // 9. SUMMARY
    // ==========================================
    log.header('9. AUDIT SUMMARY & RECOMMENDATIONS');
    
    const issues = [];
    const recommendations = [];
    
    if (!columnNames.includes('push_sent_at')) {
      issues.push('Column push_sent_at missing (needed for push deduplication)');
    }
    
    if (!rlsEnabled) {
      issues.push('CRITICAL: RLS not enabled on notifications');
    }
    
    const hasCompositeIndex = indexesResult.rows.some(r => 
      r.indexname.includes('anonymous_id') && r.indexname.includes('is_read')
    );
    
    if (!hasCompositeIndex) {
      recommendations.push('Add composite index: (anonymous_id, is_read, created_at)');
    }
    
    if (parseInt(oldCount) > 1000) {
      recommendations.push(`Archive ${oldCount} old notifications (>90 days)`);
    }
    
    if (fkResult.rows.length === 0) {
      recommendations.push('Add FK constraints for data integrity');
    }
    
    if (issues.length === 0) {
      log.success('No critical issues found');
    } else {
      issues.forEach(issue => log.error(issue));
    }
    
    if (recommendations.length > 0) {
      log.warning('\nRecommendations:');
      recommendations.forEach(rec => log.warning(`• ${rec}`));
    }

    client.release();
    
    log.header('AUDIT COMPLETE');
    
  } catch (err) {
    log.error(`Database error: ${err.message}`);
    console.error(err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

auditDatabase();
