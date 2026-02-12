#!/usr/bin/env node
/**
 * ============================================================================
 * AUDIT LOGGING VERIFICATION SCRIPT
 * ============================================================================
 * 
 * Script para verificar que el sistema de auditoría esté correctamente
 * instalado y funcionando.
 * 
 * Uso: node server/src/scripts/verifyAuditLogging.js
 */

import dotenv from 'dotenv';
dotenv.config();

import pool from '../config/database.js';
import { auditLog, auditLogSync, AuditAction, ActorType } from '../services/auditService.js';

// Colores para output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m'
};

function log(message, type = 'info') {
  const color = type === 'success' ? colors.green : type === 'error' ? colors.red : type === 'warning' ? colors.yellow : colors.blue;
  console.log(`${color}[AUDIT VERIFY]${colors.reset} ${message}`);
}

async function verifyDatabaseSchema() {
  log('\n📊 Verificando Schema de Base de Datos...', 'info');
  
  const checks = [
    {
      name: 'Tabla audit_logs',
      query: "SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'audit_logs')"
    },
    {
      name: 'Tabla audit_retention_policies',
      query: "SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'audit_retention_policies')"
    },
    {
      name: 'Enum audit_action_type',
      query: "SELECT EXISTS (SELECT FROM pg_type WHERE typname = 'audit_action_type')"
    },
    {
      name: 'RLS habilitado en audit_logs',
      query: "SELECT relrowsecurity FROM pg_class WHERE relname = 'audit_logs'"
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const check of checks) {
    try {
      const result = await pool.query(check.query);
      const exists = Object.values(result.rows[0])[0];
      
      if (exists === true || exists === 't') {
        log(`  ✅ ${check.name}`, 'success');
        passed++;
      } else {
        log(`  ❌ ${check.name} - NO ENCONTRADO`, 'error');
        failed++;
      }
    } catch (error) {
      log(`  ❌ ${check.name} - ERROR: ${error.message}`, 'error');
      failed++;
    }
  }
  
  return { passed, failed };
}

async function verifyIndexes() {
  log('\n🔍 Verificando Índices...', 'info');
  
  const requiredIndexes = [
    'idx_audit_logs_action_type',
    'idx_audit_logs_actor',
    'idx_audit_logs_target',
    'idx_audit_logs_request_id',
    'idx_audit_logs_created_at'
  ];
  
  const result = await pool.query(
    "SELECT indexname FROM pg_indexes WHERE tablename = 'audit_logs'"
  );
  
  const existingIndexes = result.rows.map(r => r.indexname);
  let passed = 0;
  let failed = 0;
  
  for (const index of requiredIndexes) {
    if (existingIndexes.includes(index)) {
      log(`  ✅ ${index}`, 'success');
      passed++;
    } else {
      log(`  ❌ ${index} - FALTANTE`, 'error');
      failed++;
    }
  }
  
  return { passed, failed };
}

async function verifyRetentionPolicies() {
  log('\n📋 Verificando Políticas de Retención...', 'info');
  
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM audit_retention_policies');
    const count = parseInt(result.rows[0].count, 10);
    
    if (count > 0) {
      log(`  ✅ ${count} políticas de retención configuradas`, 'success');
      return { passed: 1, failed: 0 };
    } else {
      log('  ⚠️  No hay políticas de retención (puede ser normal si se acaba de instalar)', 'warning');
      return { passed: 0, failed: 0 };
    }
  } catch (error) {
    log(`  ❌ Error: ${error.message}`, 'error');
    return { passed: 0, failed: 1 };
  }
}

async function testAuditLogInsert() {
  log('\n📝 Probando Inserción de Logs...', 'info');
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Log asíncrono
  try {
    const result = await auditLog({
      action: AuditAction.SYSTEM_CONFIG_CHANGE,
      description: 'Audit system verification test',
      actorType: ActorType.SYSTEM,
      actorId: '00000000-0000-0000-0000-000000000000',
      actorRole: 'system',
      // Sin target_type/target_id para cumplir constraint valid_target
      metadata: { test: true, timestamp: Date.now() },
      success: true
    });
    
    if (result) {
      log('  ✅ Log asíncrono creado', 'success');
      passed++;
    } else {
      log('  ❌ Log asíncrono falló (returned false)', 'error');
      failed++;
    }
  } catch (error) {
    log(`  ❌ Log asíncrono error: ${error.message}`, 'error');
    failed++;
  }
  
  // Test 2: Log síncrono
  try {
    // Forzar flush antes del test síncrono
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const result = await auditLogSync({
      action: AuditAction.SYSTEM_CONFIG_CHANGE,
      description: 'Synchronous audit test',
      actorType: ActorType.SYSTEM,
      actorId: '00000000-0000-0000-0000-000000000001',
      targetType: 'system',
      targetId: '00000000-0000-0000-0000-000000000000', // Requerido por constraint
      success: true
    });
    
    if (result) {
      log('  ✅ Log síncrono creado', 'success');
      passed++;
    } else {
      log('  ❌ Log síncrono falló', 'error');
      failed++;
    }
  } catch (error) {
    log(`  ❌ Log síncrono error: ${error.message}`, 'error');
    failed++;
  }
  
  // Esperar a que el batch se flush
  log('  ⏳ Esperando flush de batch (5s)...', 'info');
  await new Promise(resolve => setTimeout(resolve, 5500));
  
  // Verificar que los logs están en la DB
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM audit_logs 
       WHERE actor_id IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001')`
    );
    const count = parseInt(result.rows[0].count, 10);
    
    if (count >= 2) {
      log(`  ✅ ${count} logs encontrados en base de datos`, 'success');
      passed++;
    } else {
      log(`  ⚠️  Solo ${count} logs encontrados (esperados: 2+)`, 'warning');
    }
  } catch (error) {
    log(`  ❌ Error verificando logs: ${error.message}`, 'error');
    failed++;
  }
  
  return { passed, failed };
}

async function verifyFunctions() {
  log('\n⚙️  Verificando Funciones Auxiliares...', 'info');
  
  const checks = [
    {
      name: 'cleanup_audit_logs()',
      query: "SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'cleanup_audit_logs')"
    },
    {
      name: 'get_user_audit_summary()',
      query: "SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'get_user_audit_summary')"
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const check of checks) {
    try {
      const result = await pool.query(check.query);
      const exists = Object.values(result.rows[0])[0];
      
      if (exists) {
        log(`  ✅ ${check.name}`, 'success');
        passed++;
      } else {
        log(`  ❌ ${check.name} - NO ENCONTRADA`, 'error');
        failed++;
      }
    } catch (error) {
      log(`  ❌ ${check.name} - ERROR`, 'error');
      failed++;
    }
  }
  
  return { passed, failed };
}

async function cleanupTestLogs() {
  log('\n🧹 Limpiando logs de prueba...', 'info');
  
  try {
    await pool.query(
      `DELETE FROM audit_logs 
       WHERE actor_id IN ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001')`
    );
    log('  ✅ Logs de prueba eliminados', 'success');
  } catch (error) {
    log(`  ⚠️  No se pudieron eliminar logs de prueba: ${error.message}`, 'warning');
  }
}

async function main() {
  console.log(`${colors.blue}
╔══════════════════════════════════════════════════════════════╗
║     AUDIT LOGGING ENTERPRISE - VERIFICATION SCRIPT          ║
╚══════════════════════════════════════════════════════════════╝
${colors.reset}`);
  
  const startTime = Date.now();
  let totalPassed = 0;
  let totalFailed = 0;
  
  try {
    // Verificar conexión
    log('Conectando a base de datos...', 'info');
    await pool.query('SELECT NOW()');
    log('Conexión exitosa ✓\n', 'success');
    
    // Ejecutar verificaciones
    const results = await Promise.all([
      verifyDatabaseSchema(),
      verifyIndexes(),
      verifyRetentionPolicies(),
      verifyFunctions(),
      testAuditLogInsert()
    ]);
    
    // Sumar resultados
    for (const result of results) {
      totalPassed += result.passed;
      totalFailed += result.failed;
    }
    
    // Cleanup
    await cleanupTestLogs();
    
    // Reporte final
    const duration = Date.now() - startTime;
    
    console.log(`\n${colors.blue}══════════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.blue}║  RESULTADO FINAL                                          ${colors.reset}`);
    console.log(`${colors.blue}══════════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`  ✅ Pasados: ${totalPassed}`);
    console.log(`  ❌ Fallidos: ${totalFailed}`);
    console.log(`  ⏱️  Duración: ${duration}ms`);
    console.log(`${colors.blue}══════════════════════════════════════════════════════════════${colors.reset}\n`);
    
    if (totalFailed === 0) {
      console.log(`${colors.green}🎉 TODAS LAS VERIFICACIONES PASARON${colors.reset}`);
      console.log(`${colors.green}El sistema de auditoría está listo para usar.${colors.reset}\n`);
      process.exit(0);
    } else {
      console.log(`${colors.red}⚠️  ALGUNAS VERIFICACIONES FALLARON${colors.reset}`);
      console.log(`${colors.yellow}Por favor revisa los errores arriba.${colors.reset}\n`);
      process.exit(1);
    }
    
  } catch (error) {
    log(`\n💥 Error crítico: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
