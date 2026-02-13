const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function auditDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('SAFESPOT DATABASE AUDIT - SSOT Verification');
    console.log('============================================================\n');
    
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
    
    console.log('TABLAS ENCONTRADAS: ' + tablesResult.rows.length + '\n');
    tablesResult.rows.forEach(row => {
      console.log('  - ' + row.table_name + ' (' + row.column_count + ' cols)');
    });
    
    // 2. Verificar tablas de analytics
    console.log('\nTABLAS DE ANALYTICS:');
    const analyticsTables = tablesResult.rows.filter(r => 
      r.table_name.includes('analytics') || 
      r.table_name.includes('metric') ||
      r.table_name.includes('event') ||
      r.table_name.includes('session')
    );
    
    if (analyticsTables.length === 0) {
      console.log('  X NO HAY tablas de analytics o metricas\n');
    } else {
      analyticsTables.forEach(row => console.log('  OK ' + row.table_name));
    }
    
    // 3. Verificacion especifica de tablas requeridas
    console.log('\nVERIFICACION TABLAS ANALYTICS REQUERIDAS:');
    const requiredTables = ['analytics_events', 'analytics_sessions', 'analytics_daily'];
    const tableNames = tablesResult.rows.map(r => r.table_name);
    
    requiredTables.forEach(table => {
      const exists = tableNames.includes(table);
      console.log('  ' + (exists ? 'OK' : 'X') + ' ' + table);
    });
    
    // 4. Funciones SQL existentes
    console.log('\nFUNCIONES SQL:');
    const functionsResult = await client.query(`
      SELECT 
        p.proname as function_name,
        pg_get_function_identity_arguments(p.oid) as arguments
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public'
        AND (p.proname LIKE '%analytics%' 
         OR p.proname LIKE '%metric%'
         OR p.proname LIKE '%mau%'
         OR p.proname LIKE '%daily%')
      ORDER BY p.proname;
    `);
    
    if (functionsResult.rows.length === 0) {
      console.log('  X NO HAY funciones de analytics/metricas\n');
    } else {
      functionsResult.rows.forEach(row => {
        console.log('  OK ' + row.function_name + '(' + (row.arguments || '') + ')');
      });
    }
    
    // 5. Conteo de registros
    console.log('\nCONTEO DE REGISTROS:');
    const tablesToCheck = ['reports', 'anonymous_users', 'comments', 'votes', 'analytics_events', 'analytics_sessions', 'analytics_daily'];
    
    for (const table of tablesToCheck) {
      try {
        const countResult = await client.query('SELECT COUNT(*) as count FROM "' + table + '"');
        console.log('  ' + table + ': ' + countResult.rows[0].count + ' registros');
      } catch (e) {
        console.log('  X ' + table + ': NO EXISTE');
      }
    }
    
    // 6. Check admin_users
    console.log('\nTABLAS ADMIN:');
    try {
      const adminResult = await client.query('SELECT COUNT(*) as count FROM admin_users');
      console.log('  admin_users: ' + adminResult.rows[0].count + ' registros');
    } catch (e) {
      console.log('  X admin_users: NO EXISTE');
    }
    
    console.log('\n============================================================');
    console.log('AUDITORIA COMPLETADA');
    console.log('============================================================');
    
  } catch (err) {
    console.error('Error durante auditoria:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

auditDatabase();
