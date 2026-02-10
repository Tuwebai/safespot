/**
 * 🧹 CLEANUP: Eliminación de usuarios test (Fase 1) + Sin Alias
 * 
 * OBJETIVO:
 * - 16 usuarios test obvios (Tester2, Chrome3-6, asds, etc.)
 * - 20 usuarios sin alias
 * 
 * MÉTODO: Hard delete con verificación previa
 * BACKUP: Audit log con IDs eliminados
 */

const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: 'postgresql://postgres.womkvonfiwjzzatsowkl:Safespot2024Dev@aws-0-us-west-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

// 🎯 FASE 1: Usuarios test obvios (por ID exacto - 100% confirmados)
const TEST_USERS_PHASE1 = [
  // Testers explícitos
  'c2ee754a-a377-4ad2-b25f-e19eb4da419f', // Tester2
  '36af7150-e717-455f-b38d-2cb3ba896fca', // Tester3
  '46ddbd99-8300-495b-a33b-ff285ebcf303', // RunnerTest
  '7fb08e1e-f364-4a7c-9a70-a11ecb8e9206', // TestUser123
  
  // Chrome tests
  '6fae9f2c-13af-4f14-90d0-b00697c3ffce', // Chrome3
  '4970cf50-ac13-4e84-a255-b0dd6a97e488', // Chrome4
  '66d2b8cc-32e9-4f7f-814e-75b16b9125c3', // Chrome5
  '4678bacc-37f1-492c-8024-880cb1d5b35b', // Chrome6
  
  // Brave test
  '5778dcfd-7c37-4055-98a1-eaffb449decc', // Brave2
  
  // Random typing (asds, etc.)
  '25b304f7-bd5c-4d6f-8f60-4bff0dbe2a84', // asds
  '6006fbd7-3f36-47ba-886c-d7e3a8ec7d36', // asdasds
  '1b9c1ddd-ad5d-4a96-8b2b-98ac0bb5a46a', // dasdsa
  'e617b02a-8394-4f45-97d5-146607748db0', // asdas
  'c9f97774-7b1c-42dc-8734-40913cc30a5e', // adsadasdad
  '0e913c59-d374-4f8c-b62c-d943d9c0a88b', // asdea
  'c4a74e07-76ee-466f-b5f5-ab593d8b7b64', // testij
];

// Backup file
const BACKUP_FILE = `./backup_deleted_users_${Date.now()}.json`;

async function cleanupUsers() {
  const client = await pool.connect();
  
  try {
    console.log('🧹 INICIANDO LIMPIEZA DE USUARIOS');
    console.log('=====================================\n');
    
    // 1. Verificar que los usuarios existen y no tienen contenido importante
    console.log('🔍 FASE 1: Verificando usuarios test...');
    
    const verifyResult = await client.query(`
      SELECT anonymous_id, alias, total_reports, total_comments, 
             created_at, last_active_at,
             (SELECT COUNT(*) FROM reports WHERE anonymous_id = au.anonymous_id) as real_reports,
             (SELECT COUNT(*) FROM comments WHERE anonymous_id = au.anonymous_id) as real_comments,
             (SELECT COUNT(*) FROM followers WHERE follower_id = au.anonymous_id OR following_id = au.anonymous_id) as follow_connections
      FROM anonymous_users au
      WHERE anonymous_id = ANY($1)
      ORDER BY alias
    `, [TEST_USERS_PHASE1]);
    
    console.log(`   Encontrados: ${verifyResult.rows.length} usuarios`);
    
    // Verificar que no tengan contenido REAL (reportes/comments)
    // Los follows entre test users se pueden eliminar
    const withRealContent = verifyResult.rows.filter(u => 
      u.real_reports > 0 || u.real_comments > 0
    );
    
    if (withRealContent.length > 0) {
      console.log('⚠️  ALERTA: Algunos usuarios tienen contenido real:');
      withRealContent.forEach(u => {
        console.log(`   - ${u.alias}: ${u.real_reports} reportes, ${u.real_comments} comments`);
      });
      console.log('❌ ABORTANDO: Revisar manualmente');
      return;
    }
    
    // Si solo tienen follows (entre test users), proceder con limpieza de relaciones
    const withFollowsOnly = verifyResult.rows.filter(u => u.follow_connections > 0);
    if (withFollowsOnly.length > 0) {
      console.log(`   Nota: ${withFollowsOnly.length} usuarios tienen follows (serán limpiados)`);
    }
    
    console.log('   ✅ Todos los usuarios test tienen 0 contenido\n');
    
    // 2. Backup antes de eliminar
    console.log('💾 Creando backup...');
    const backup = {
      timestamp: new Date().toISOString(),
      phase: 'test_users_cleanup',
      users: verifyResult.rows
    };
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(backup, null, 2));
    console.log(`   ✅ Backup guardado: ${BACKUP_FILE}\n`);
    
    // 3. Limpiar relaciones de follows primero
    if (withFollowsOnly.length > 0) {
      console.log('🧹 Limpiando relaciones follows...');
      const cleanupFollows = await client.query(`
        DELETE FROM followers 
        WHERE follower_id = ANY($1) OR following_id = ANY($1)
        RETURNING follower_id, following_id
      `, [TEST_USERS_PHASE1]);
      console.log(`   ✅ Eliminadas: ${cleanupFollows.rows.length} relaciones follows`);
    }
    
    // 4. ELIMINAR FASE 1 (Test users)
    console.log('🗑️  Eliminando usuarios test (Fase 1)...');
    const deleteTestResult = await client.query(`
      DELETE FROM anonymous_users 
      WHERE anonymous_id = ANY($1)
      RETURNING anonymous_id, alias
    `, [TEST_USERS_PHASE1]);
    
    console.log(`   ✅ Eliminados: ${deleteTestResult.rows.length} usuarios test`);
    deleteTestResult.rows.forEach(u => console.log(`      - ${u.alias} (${u.anonymous_id})`));
    
    // 4. FASE 2: Usuarios sin alias (inactivos)
    console.log('\n🔍 FASE 2: Buscando usuarios sin alias...');
    
    const noAliasResult = await client.query(`
      SELECT anonymous_id, alias, total_reports, total_comments, created_at
      FROM anonymous_users 
      WHERE (alias IS NULL OR alias = '')
      ORDER BY created_at DESC
    `);
    
    console.log(`   Encontrados: ${noAliasResult.rows.length} usuarios sin alias`);
    
    // Verificar que no tengan contenido
    const noAliasWithContent = noAliasResult.rows.filter(u => 
      u.total_reports > 0 || u.total_comments > 0
    );
    
    if (noAliasWithContent.length > 0) {
      console.log(`   ⚠️  ${noAliasWithContent.length} tienen contenido - NO se eliminarán`);
    }
    
    // Filtrar solo los sin contenido
    const noAliasSafeToDelete = noAliasResult.rows
      .filter(u => u.total_reports === 0 && u.total_comments === 0)
      .map(u => u.anonymous_id);
    
    console.log(`   ✅ Seguros para eliminar: ${noAliasSafeToDelete.length}`);
    
    if (noAliasSafeToDelete.length > 0) {
      console.log(`   Nota: Se eliminarán solo los primeros 20 para no sobrecargar`);
      const toDelete = noAliasSafeToDelete.slice(0, 20);
      
      // Backup de estos también
      const noAliasBackup = await client.query(`
        SELECT * FROM anonymous_users 
        WHERE anonymous_id = ANY($1)
      `, [toDelete]);
      
      backup.no_alias_users = noAliasBackup.rows;
      fs.writeFileSync(BACKUP_FILE, JSON.stringify(backup, null, 2));
      
      // Limpiar dependencias primero
      console.log('   🧹 Limpiando user_auth...');
      await client.query(`
        DELETE FROM user_auth 
        WHERE anonymous_id = ANY($1)
      `, [toDelete]);
      
      // Eliminar usuarios
      const deleteNoAliasResult = await client.query(`
        DELETE FROM anonymous_users 
        WHERE anonymous_id = ANY($1)
        RETURNING anonymous_id
      `, [toDelete]);
      
      console.log(`   ✅ Eliminados: ${deleteNoAliasResult.rows.length} usuarios sin alias`);
    }
    
    // 5. Resumen final
    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMEN DE LIMPIEZA');
    console.log('='.repeat(50));
    console.log(`Usuarios test eliminados: ${deleteTestResult.rows.length}`);
    console.log(`Usuarios sin alias eliminados: ${noAliasSafeToDelete.length || 0}`);
    console.log(`Total eliminados: ${deleteTestResult.rows.length + (noAliasSafeToDelete.length || 0)}`);
    console.log(`Backup: ${BACKUP_FILE}`);
    
    // 6. Stats post-cleanup
    const postStats = await client.query(`
      SELECT COUNT(*) as total FROM anonymous_users
    `);
    console.log(`\nUsuarios restantes: ${postStats.rows[0].total}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

// Confirmación interactiva
console.log('⚠️  ESTA ACCIÓN ELIMINARÁ USUARIOS PERMANENTEMENTE');
console.log('Los usuarios eliminados:');
console.log('- 16 usuarios test confirmados');
console.log('- ~20 usuarios sin alias y sin contenido');
console.log('');
console.log('Para proceder, ejecutar con flag --confirm');
console.log('');

if (process.argv.includes('--confirm')) {
  cleanupUsers();
} else {
  console.log('Abortado. Usa: node cleanup_test_users.cjs --confirm');
  process.exit(0);
}
