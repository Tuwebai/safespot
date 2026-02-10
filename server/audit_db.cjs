const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.womkvonfiwjzzatsowkl:Safespot2024Dev@aws-0-us-west-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function audit() {
  try {
    console.log('🔍 AUDITORÍA DB SAFE-SPOT (SSOT)');
    console.log('=====================================\n');
    
    // 1. Listar todas las tablas
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log('📋 TABLAS EN DB:');
    tables.rows.forEach(r => console.log('   • ' + r.table_name));
    
    // 2. Verificar si user_personal_aliases existe
    const check = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'user_personal_aliases'
      ) as exists
    `);
    
    console.log('\n🔎 user_personal_aliases existe?:', check.rows[0].exists);
    
    // 3. Si existe, mostrar estructura completa
    if (check.rows[0].exists) {
      const cols = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'user_personal_aliases'
        ORDER BY ordinal_position
      `);
      console.log('\n📊 ESTRUCTURA user_personal_aliases:');
      cols.rows.forEach(c => console.log(`   ${c.column_name}: ${c.data_type} (${c.is_nullable})`));
      
      // Índices
      const idx = await pool.query(`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'user_personal_aliases'
      `);
      console.log('\n📑 ÍNDICES:');
      idx.rows.forEach(i => console.log('   • ' + i.indexname));
      
      // RLS
      const rls = await pool.query(`
        SELECT relrowsecurity 
        FROM pg_class 
        WHERE relname = 'user_personal_aliases'
      `);
      console.log('\n🔐 RLS Habilitado?:', rls.rows[0]?.relrowsecurity || false);
      
    } else {
      console.log('   ⚠️  Tabla NO existe - Requiere creación');
    }
    
    // 4. Verificar anonymous_users
    const auCols = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'anonymous_users'
      ORDER BY ordinal_position
    `);
    console.log('\n📊 anonymous_users (columnas relevantes):');
    auCols.rows.slice(0, 15).forEach(c => console.log(`   ${c.column_name}: ${c.data_type}`));
    
    // 5. Verificar followers
    const folCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'followers'
      ) as exists
    `);
    console.log('\n👥 Tabla followers existe?:', folCheck.rows[0].exists);
    
    // 6. Verificar RLS en tablas principales
    const rlsCheck = await pool.query(`
      SELECT relname, relrowsecurity 
      FROM pg_class 
      WHERE relname IN ('anonymous_users', 'followers', 'reports', 'comments')
      AND relkind = 'r'
    `);
    console.log('\n🔐 RLS Status en tablas principales:');
    rlsCheck.rows.forEach(r => console.log(`   ${r.relname}: ${r.relrowsecurity ? '✅ ON' : '❌ OFF'}`));
    
    // 7. Contar registros en tablas clave
    const counts = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM anonymous_users) as total_users,
        (SELECT COUNT(*) FROM followers) as total_follows,
        (SELECT COUNT(*) FROM reports WHERE deleted_at IS NULL) as total_reports
    `);
    console.log('\n📈 ESTADÍSTICAS:');
    console.log(`   Usuarios: ${counts.rows[0].total_users}`);
    console.log(`   Follows: ${counts.rows[0].total_follows}`);
    console.log(`   Reportes: ${counts.rows[0].total_reports}`);
    
  } catch(e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  } finally {
    pool.end();
  }
}

audit();
