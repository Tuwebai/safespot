/**
 * ============================================================================
 * DB AUDIT SCRIPT - SafeSpot Enterprise Protocol
 * ============================================================================
 * Audita el schema real de la base de datos usando la conexión real.
 * FUENTE DE VERDAD: La DB en producción (como indica AGENTS.md)
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '.env') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function auditDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 SAFESPOT DATABASE AUDIT - SSOT Verification');
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    // 1. Listar todas las tablas
    const tablesResult = await client.query(`
      SELECT 
        t.table_name,
        (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name AND c.table_schema = 'public') as column_count
      FROM information_schema.tables t
      WHERE t.table_schema = 'public' 
        AND t.table_type = 'BASE TABLE'
      ORDER BY t.table_name;
    `);
    
    console.log(`📋 TABLAS ENCONTRADAS: ${tablesResult.rows.length}\n`);
    tablesResult.rows.forEach(row => {
      console.log(`   • ${row.table_name} (${row.column_count} cols)`);
    });
    
    // 2. Verificar tablas de analytics
    console.log('\n📊 TABLAS DE ANALYTICS:');
    const analyticsTables = tablesResult.rows.filter(r => 
      r.table_name.includes('analytics') || 
      r.table_name.includes('metric') ||
      r.table_name.includes('event') ||
      r.table_name.includes('session')
    );
    
    if (analyticsTables.length === 0) {
      console.log('   ❌ NO HAY tablas de analytics o métricas\n');
    } else {
      analyticsTables.forEach(row => console.log(`   ✅ ${row.table_name}`));
    }
    
    // 3. Verificación específica de tablas requeridas
    console.log('\n🔍 VERIFICACIÓN TABLAS ANALYTICS REQUERIDAS:');
    const requiredTables = ['analytics_events', 'analytics_sessions', 'analytics_daily'];
    const tableNames = tablesResult.rows.map(r => r.table_name);
    
    requiredTables.forEach(table => {
      const exists = tableNames.includes(table);
      console.log(`   ${exists ? '✅' : '❌'} ${table}`);
    });
    
    // 4. Funciones SQL existentes
    console.log('\n⚙️  FUNCIONES SQL:');
    const functionsResult = await client.query(`
      SELECT 
        p.proname as function_name,
        pg_get_function_identity_arguments(p.oid) as arguments
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND p.proname LIKE '%analytics%' 
         OR p.proname LIKE '%metric%'
         OR p.proname LIKE '%mau%'
         OR p.proname LIKE '%daily%'
      ORDER BY p.proname;
    `);
    
    if (functionsResult.rows.length === 0) {
      console.log('   ❌ NO HAY funciones de analytics/métricas\n');
    } else {
      functionsResult.rows.forEach(row => {
        console.log(`   ✅ ${row.function_name}(${row.arguments || ''})`);
      });
    });
    
    // 5. Estructura de tablas principales (si existen)
    const mainTables = ['reports', 'anonymous_users', 'comments', 'votes'];
    console.log('\n📐 ESTRUCTURA TABLAS PRINCIPALES:');
    
    for (const table of mainTables) {
      if (tableNames.includes(table)) {
        const columnsResult = await client.query(`
          SELECT 
            column_name,
            data_type,
            is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position;
        `, [table]);
        
        console.log(`\n   📁 ${table}:`);
        columnsResult.rows.slice(0, 8).forEach(col => {
          const nullable = col.is_nullable === 'YES' ? '?' : '';
          console.log(`      • ${col.column_name}${nullable}: ${col.data_type}`);
        });
        if (columnsResult.rows.length > 8) {
          console.log(`      ... y ${columnsResult.rows.length - 8} más`);
        }
      }
    }
    
    // 6. Índices importantes
    console.log('\n🔎 ÍNDICES EN TABLAS ANALYTICS (si existen):');
    const indexesResult = await client.query(`
      SELECT 
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename LIKE '%analytics%'
      ORDER BY tablename, indexname;
    `);
    
    if (indexesResult.rows.length === 0) {
      console.log('   ❌ No hay índices en tablas analytics (tablas no existen)\n');
    } else {
      indexesResult.rows.forEach(idx => {
        console.log(`   ✅ ${idx.indexname} ON ${idx.tablename}`);
      });
    }
    
    // 7. RLS en tablas analytics
    console.log('\n🔒 ROW LEVEL SECURITY (RLS):');
    const rlsResult = await client.query(`
      SELECT 
        tablename,
        rowsecurity as rls_enabled
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename LIKE '%analytics%'
      ORDER BY tablename;
    `);
    
    if (rlsResult.rows.length === 0) {
      console.log('   ❌ No hay tablas analytics para verificar RLS\n');
    } else {
      rlsResult.rows.forEach(row => {
        console.log(`   ${row.rls_enabled ? '🔒' : '🔓'} ${row.tablename}: RLS ${row.rls_enabled ? 'ON' : 'OFF'}`);
      });
    }
    
    // 8. Conteo de registros en tablas principales
    console.log('\n📈 CONTEO DE REGISTROS:');
    for (const table of [...mainTables, 'analytics_events', 'analytics_sessions', 'analytics_daily']) {
      try {
        const countResult = await client.query(`SELECT COUNT(*) as count FROM "${table}";`);
        console.log(`   • ${table}: ${countResult.rows[0].count.toLocaleString()} registros`);
      } catch (e) {
        console.log(`   ❌ ${table}: TABLA NO EXISTE`);
      }
    }
    
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('✅ AUDITORÍA COMPLETADA');
    console.log('═══════════════════════════════════════════════════════════════');
    
  } catch (err) {
    console.error('❌ Error durante auditoría:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

auditDatabase();
