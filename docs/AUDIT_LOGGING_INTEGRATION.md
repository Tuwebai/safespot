# 🔐 Audit Logging Enterprise - Guía de Integración

**Fecha:** 2026-02-11  
**Versión:** 1.0  
**Nivel:** Enterprise (M12)

---

## 📋 Resumen

El sistema de Audit Logging está diseñado para capturar **TODAS** las acciones sensibles del sistema de forma inmutable y trazable, cumpliendo con estándares de compliance (GDPR, ISO 27001).

### Componentes Implementados

| Componente | Ubicación | Descripción |
|------------|-----------|-------------|
| **Schema DB** | `database/migrations/20250211_add_audit_logging.sql` | Tablas, índices, RLS |
| **Servicio** | `server/src/services/auditService.js` | Core de auditoría con batching |
| **Middleware** | `server/src/middleware/audit.js` | Integración con Express |
| **API Admin** | `server/src/routes/adminAudit.js` | Endpoints de consulta |
| **UI Admin** | `src/admin/pages/AuditPage.tsx` | Panel de visualización |
| **Hooks** | `src/admin/hooks/useAuditLogs.ts` | React Query hooks |
| **API Client** | `src/admin/services/auditApi.ts` | Cliente tipado |

---

## 🚀 Instalación

### 1. Ejecutar Migración de Base de Datos

```bash
# Conectarse a la base de datos y ejecutar:
psql $DATABASE_URL -f database/migrations/20250211_add_audit_logging.sql
```

### 2. Verificar Integración en Servidor

Las rutas ya están integradas en `server/src/index.js`:

```javascript
// Agregado automáticamente
import adminAuditRouter from './routes/adminAudit.js';
app.use('/api/admin/audit', adminAuditRouter);
```

### 3. Verificar Panel Admin

La ruta ya está integrada en `src/admin/AdminApp.tsx`:

```typescript
const AuditPage = lazy(() => import('./pages/AuditPage'));
<Route path="audit" element={<AuditPage />} />
```

---

## 📝 Uso en Rutas

### Opción 1: Middleware Automático (Recomendado)

Para operaciones CRUD estándar:

```javascript
import { auditCrud } from '../middleware/audit.js';

router.post('/reports', 
  auditCrud({ resource: 'report', actions: { create: 'report_create' } }),
  createReportHandler
);

router.patch('/reports/:id',
  auditCrud({ resource: 'report', actions: { update: 'report_update' } }),
  updateReportHandler
);

router.delete('/reports/:id',
  auditCrud({ resource: 'report', actions: { delete: 'report_delete' } }),
  deleteReportHandler
);
```

### Opción 2: Middleware de Auditoría Manual

Para casos específicos:

```javascript
import { auditMiddleware } from '../middleware/audit.js';
import { AuditAction } from '../services/auditService.js';

router.post('/reports/:id/vote',
  auditMiddleware({
    action: AuditAction.VOTE_CREATE,
    targetType: 'report',
    getTargetId: (req) => req.params.id,
    getMetadata: (req) => ({ voteType: req.body.type })
  }),
  voteHandler
);
```

### Opción 3: Servicio Directo (Para lógica compleja)

```javascript
import { auditLog, AuditAction, ActorType } from '../services/auditService.js';

async function complexOperation(req, res) {
  // ... lógica de negocio ...
  
  // Registrar auditoría manualmente
  await auditLog({
    action: AuditAction.MODERATION_RESOLVE,
    description: `Report ${reportId} marked as resolved`,
    actorType: ActorType.ADMIN,
    actorId: req.adminUser.id,
    actorRole: req.adminUser.role,
    req,
    targetType: 'report',
    targetId: reportId,
    targetOwnerId: reportOwnerId,
    oldValues: { status: 'pending' },
    newValues: { status: 'resolved' },
    changedFields: ['status'],
    metadata: { resolution, internalNote }
  });
}
```

### Opción 4: Auditoría Síncrona (Crítico)

Para operaciones que NO pueden fallar silenciosamente:

```javascript
import { auditLogSync, AuditAction } from '../services/auditService.js';

async function deleteUser(req, res) {
  // Auditoría SÍNCRONA - bloquea hasta completar
  await auditLogSync({
    action: AuditAction.USER_DELETE,
    actorType: ActorType.ADMIN,
    actorId: req.adminUser.id,
    req,
    targetType: 'user',
    targetId: userId,
    oldValues: userData, // Backup completo antes de eliminar
    metadata: { reason: req.body.reason }
  });
  
  // Luego ejecutar la acción
  await deleteUserFromDB(userId);
}
```

---

## 🎯 Acciones a Auditar (Checklist)

### CRÍTICO - Siempre auditar:

- [x] `user_delete` - Eliminación de usuarios
- [x] `user_ban` / `user_unban` - Baneos
- [x] `user_shadow_ban` - Shadow bans
- [x] `report_delete` - Eliminación de reportes
- [x] `admin_login` / `admin_logout` - Sesiones admin
- [x] `auth_failed` - Intentos fallidos de login
- [x] `moderation_resolve` - Decisiones de moderación

### ALTO - Auditar:

- [x] `report_create` / `report_update` - CRUD de reportes
- [x] `comment_delete` - Eliminación de comentarios
- [x] `system_config_change` - Cambios de configuración
- [x] `api_key_created` / `api_key_revoked` - API keys

### MEDIO - Auditar si aplica:

- [x] `vote_create` / `vote_delete` - Votos
- [x] `report_flag` - Flags de contenido
- [x] `chat_message_delete` - Eliminación de mensajes

---

## 🔒 Seguridad

### RLS (Row Level Security)

```sql
-- Solo admins pueden leer logs
CREATE POLICY audit_logs_select ON audit_logs
    FOR SELECT
    USING (current_setting('app.is_admin', TRUE)::BOOLEAN = TRUE);

-- Solo sistema puede insertar
CREATE POLICY audit_logs_insert ON audit_logs
    FOR INSERT
    WITH CHECK (current_setting('app.audit_system', TRUE)::BOOLEAN = TRUE);
```

### Sanitización Automática

El servicio automáticamente enmascara campos sensibles:

```javascript
const SENSITIVE_FIELDS = [
  'password', 'token', 'secret', 'api_key', 'private_key',
  'credit_card', 'ssn', 'document_number', 'phone', 'email'
];

// En el log aparecerá:
// { password: '[REDACTED]', name: 'Juan' }
```

---

## 📊 Panel de Auditoría

### Acceso

URL: `/admin/audit`

### Features

1. **Lista de Logs**
   - Filtros por actor, target, acción, fecha
   - Paginación (50 por página)
   - Indicadores de éxito/error
   - Colores por tipo de acción

2. **Detalle de Log**
   - Actor completo (IP, User-Agent)
   - Valores antes/después
   - Campos modificados
   - Metadata adicional
   - Error info (si falló)

3. **Estadísticas**
   - Acciones por tipo
   - Actividad diaria
   - Top actores

4. **User Timeline**
   - `/api/admin/audit/user/:id/timeline`
   - Acciones POR el usuario
   - Acciones SOBRE el usuario

---

## 🔧 Configuración

### Políticas de Retención

```sql
-- Ver políticas actuales
SELECT * FROM audit_retention_policies;

-- Modificar retención
UPDATE audit_retention_policies 
SET retention_days = 1095  -- 3 años
WHERE action_type = 'report_create';
```

### Limpieza Manual (solo super_admin)

```bash
# POST /api/admin/audit/cleanup
# Elimina logs antiguos según políticas
```

### Variables de Entorno

```bash
# Opcional: Nivel de logging de auditoría
LOG_LEVEL=info  # trace, debug, info, warn, error
```

---

## 🧪 Testing

### Verificar Instalación

```bash
# 1. Verificar tabla creada
psql $DATABASE_URL -c "\dt audit_logs"

# 2. Verificar enums
psql $DATABASE_URL -c "\dT audit_action_type"

# 3. Crear log de prueba
psql $DATABASE_URL -c "
SET app.audit_system = 'true';
INSERT INTO audit_logs (action_type, actor_type, actor_id, success)
VALUES ('system_config_change', 'system', '00000000-0000-0000-0000-000000000000', true);
"

# 4. Verificar desde admin
# Acceder a /admin/audit y confirmar que aparece el log
```

### Test de Integración

```javascript
// tests/audit.test.js
import { auditLog, AuditAction, ActorType } from '../services/auditService.js';

describe('Audit Logging', () => {
  it('should create audit log entry', async () => {
    const result = await auditLog({
      action: AuditAction.REPORT_CREATE,
      actorType: ActorType.ANONYMOUS,
      actorId: 'test-uuid',
      targetType: 'report',
      targetId: 'report-uuid',
      newValues: { title: 'Test' }
    });
    
    expect(result).toBe(true);
  });
});
```

---

## 📈 Performance

### Batching

Los logs se agrupan en batches de 50 o cada 5 segundos:

```javascript
const BATCH_CONFIG = {
    maxSize: 50,
    flushIntervalMs: 5000,
    maxRetries: 3
};
```

### Índices

Se crearon índices optimizados para queries comunes:

```sql
-- Por tipo de acción
CREATE INDEX idx_audit_logs_action_type ON audit_logs(action_type, created_at DESC);

-- Por actor
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id, actor_type, created_at DESC);

-- Por target
CREATE INDEX idx_audit_logs_target ON audit_logs(target_type, target_id, created_at DESC);

-- Por request_id (trazabilidad)
CREATE INDEX idx_audit_logs_request_id ON audit_logs(request_id);
```

### Graceful Shutdown

```javascript
// En caso de SIGTERM/SIGINT
process.on('SIGTERM', async () => {
    await flushAuditLogs(); // Flush pendientes antes de cerrar
});
```

---

## 🆘 Troubleshooting

### Problema: Logs no aparecen en la UI

**Checklist:**
1. ¿Se ejecutó la migración SQL?
2. ¿El admin tiene rol correcto (admin/super_admin)?
3. ¿Hay logs en la DB? `SELECT COUNT(*) FROM audit_logs;`
4. ¿RLS está configurado correctamente?

### Problema: Error "permission denied"

```sql
-- Verificar RLS
SELECT relrowsecurity FROM pg_class WHERE relname = 'audit_logs';

-- Debe retornar 'true'
```

### Problema: Performance lenta

```sql
-- Verificar índices
SELECT indexname FROM pg_indexes WHERE tablename = 'audit_logs';

-- Si faltan, recrear:
CREATE INDEX CONCURRENTLY idx_audit_logs_created_at ON audit_logs(created_at DESC);
```

### Problema: Logs duplicados

El sistema tiene deduplicación implícita por `request_id` + `action_type`. Verificar que el `correlationMiddleware` esté activo.

---

## 📚 Referencias

- **OpenAPI Docs:** `/api-docs` (en desarrollo)
- **Schema SQL:** `database/migrations/20250211_add_audit_logging.sql`
- **Servicio:** `server/src/services/auditService.js`
- **Middleware:** `server/src/middleware/audit.js`

---

## ✅ Checklist de Implementación

- [x] Schema de base de datos creado
- [x] Servicio de auditoría implementado
- [x] Middleware de auditoría creado
- [x] API de consulta para admin
- [x] UI de panel de auditoría
- [x] RLS configurado
- [x] Índices creados
- [x] Documentación completa
- [ ] Integrar en rutas existentes (ejemplos provistos)
- [ ] Tests de integración

---

**Fin del Documento**

*SafeSpot Enterprise Protocol v1.0*
