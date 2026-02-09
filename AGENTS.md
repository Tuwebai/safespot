# SafeSpot Enterprise - AGENTS.md

> **Última actualización:** 2026-02-08  
> **Versión:** 2.3  
> **Propósito:** Guía definitiva para agentes de código en el proyecto SafeSpot

---

## 🎯 FILOSOFÍA DEL PROYECTO

SafeSpot es una aplicación **Enterprise Grade** con requisitos de auditoría M12 (Governance Grade).

- **Seguridad > Velocidad:** Cada acción de moderación debe dejar traza auditada
- **Tipo estricto:** Cero `any` en código nuevo, `unknown` + type guards obligatorio
- **Minimalismo:** Cambios quirúrgicos, nunca scope creep
- **Resiliencia:** Soft deletes, pre-checks, rollback automático

---

## 🏛️ REGLAS DE ORO (Inquebrantables)

### 🚫 PROHIBICIONES ABSOLUTAS

| Prohibición | Consecuencia si se rompe |
|-------------|-------------------------|
| **NO** modificar interfaces compartidas globales sin auditoría de impacto transversal | Breaking changes en múltiples módulos |
| **NO** refactorizar tipos existentes si no están directamente relacionados con el bug | Regresiones silenciosas, deuda técnica |
| **NO** expandir el scope del cambio solicitado | "Mientras estoy acá..." → 💥 |
| **NO** eliminar funciones, exports o campos existentes | APIs rotas, frontend crash |
| **NO** usar `any` en código nuevo | Pérdida de type safety, errores en runtime |
| **NO** pasarse de la raya con over-engineering | "Convertir un manejador SSE en mini-Kafka" → 💥 |
| **NO** asumir sin verificar en código | Fixes en el lugar equivocado, regresiones |

### 🧱 Regla Absoluta: Catchup & Realtime Isolation

Un sistema de catchup o replay:
- **NUNCA** puede devolver eventos, mensajes o estados que el usuario NO esté autorizado a recibir
- **NUNCA** debe confiar en que el consumidor filtre eventos incorrectos
- **DEBE** aplicar las mismas reglas de autorización que el realtime

❌ **Está prohibido:**
- Catchup global sin filtro por membresía
- "Traer todo y que el frontend descarte"
- Emitir eventos que luego producen 404 en ACKs

✅ **Regla de oro:**
> Si un evento llega al Orchestrator, ese evento DEBE ser válido, autorizable y ack‑able para ese usuario.

Cualquier bug de realtime debe analizarse primero en la **FUENTE DE DATOS** antes de aplicar fixes reactivos.

### 🆔 Regla Absoluta: ID Semántica

🚫 **`tempId` NO EXISTE**

Si un ID:
- Se genera en el cliente
- Pasa validación
- Se persiste
- Se emite por SSE

**ENTONCES es el ID FINAL.**

Nombrarlo `tempId` es un bug semántico. Si aparece `tempId` en el código:
→ El diseño está mal  
→ No se parchea, se elimina.

### 🚨 REGLA INQUEBRANTABLE: No Asumir, Siempre Verificar en Código

#### ❌ PROHIBIDO
- Declarar "ENCONTRÉ EL PROBLEMA" sin haber recorrido el flujo completo
- Proponer fixes basados en suposiciones
- Inferir causas sin confirmar:
  - Flujo backend → emitter → transporte → frontend
  - Estado en base de datos
  - Logs reales
  - Código exacto involucrado
- Aplicar cambios antes de aislar el origen real del bug

#### ✅ OBLIGATORIO
Antes de afirmar que se encontró el problema:
1. **Trazar el flujo completo**
   - Origen del evento
   - Transformaciones intermedias
   - Transporte (SSE / WS / Push)
   - Recepción
   - Procesamiento
   - Estado persistido

2. **Confirmar con código real**
   - Leer archivos involucrados
   - Verificar condiciones exactas
   - Validar nombres de eventos y filtros
   - Revisar deduplicación, guards y side effects

3. **Confirmar con evidencia**
   - Logs
   - Breakpoints
   - Estado en DB
   - Payload real

**Solo después:**
- Formular hipótesis final
- Proponer fix mínimo
- Explicar por qué ese fix resuelve el problema raíz

#### 🎯 Principio Técnico
**Nunca arreglar síntomas. Siempre encontrar la causa raíz confirmada por código y flujo real.**

#### 🧠 Regla de Oro
Si el análisis incluye frases como:
- "Probablemente..."
- "Seguramente..."
- "Puede que..."

Entonces: **El problema no está confirmado todavía.**

#### 🏗 Estándar de Calidad
Un problema solo se considera confirmado cuando:
- Se puede reproducir
- Se puede explicar con el flujo exacto
- Se puede señalar la línea específica que causa el comportamiento
- El fix está alineado con esa línea

### ✅ OBLIGACIONES EN CÓDIGO NUEVO

| Regla | Implementación | Ejemplo |
|-------|---------------|---------|
| **Tipo estricto** | `unknown` en lugar de `any` | `function parse(data: unknown)` |
| **Type guards** | Verificación antes de uso | `if (typeof data === 'object' && data !== null)` |
| **Validación Zod** | En todos los bordes de API | `schema.parse(data)` o `safeParse()` |
| **Auditoría M12** | `executeModeration()` para acciones de admin | Razón obligatoria (min 5 chars) |
| **Soft deletes** | Nunca `DELETE` hard, siempre `deleted_at` | Recuperable, trazable |

### 🏛️ ENTERPRISE GRADE (Obligatorio para todo código nuevo)

> **Todo fix o feature debe ser ENTERPRISE GRADE. Nada básico, nada a medias.**

| Categoría | Mínimo Enterprise | No Aceptable |
|-----------|-------------------|--------------|
| **Motores/Engines** | Lifecycle completo (start/stop/clear), métricas/telemetry, persistencia donde aplique, circuit breakers | Solo `clear()` o cleanup básico |
| **Caches** | LRU con límites estrictos, TTL automático, persistencia en IndexedDB, invalidación coordinada | Solo `Map` o `Set` sin límites |
| **Subscripciones** | Unsubscribe handlers guardados, cleanup en logout, BroadcastChannel para cross-tab | Solo retornar función de cleanup |
| **Resiliencia** | Retry con backoff exponencial, dead letter queues, health checks, auto-healing | Try-catch básico |
| **Métricas** | Telemetry en cada operación crítica, tracing de requests, alertas de anomalías | Solo console.log |
| **Sync entre tabs** | BroadcastChannel para coordinación de estado, leader election donde aplique | Estado aislado por tab |

**Principio:** Si no incluye métricas, persistencia y coordinación cross-tab, **NO es enterprise**.

### 📋 LEGACY (Congelado)

> **"Si funciona y no toca el bug, NO se toca."**

- Los `any` existentes se mantienen hasta refactorización planificada
- Los tipos legacy no se tocan salvo que sean el root cause del bug
- Solo correcciones quirúrgicas, nunca refactorizaciones "oportunistas"

---

## ⚖️ REGLA DE PROPORCIONALIDAD (Anti Over-Engineering)

> **"La infraestructura debe escalar con el problema real, no con el ego técnico."**

### 🚫 NO Pasarse de la Raya

| Contexto SafeSpot | Solución Correcta | Over-Engineering (Prohibido) |
|-------------------|-------------------|------------------------------|
| **< 100 eventos/minuto** | Circuit breaker simple + stats básicos | Batch ACKs, DLQ, métricas por canal/tipo |
| **1-10 reportes/minuto** | ACK individual | Batch processing, colas persistentes |
| **Single-node frontend** | BroadcastChannel para cross-tab | Kafka, Redis, infra distribuida |
| **Errores de listener** | Try-catch + telemetry | DLQ "en memoria" sin persistencia real |

### ✅ Checklist Proporcional

Antes de agregar cualquier feature enterprise, responder:

- [ ] ¿Cuál es el volumen real de operaciones/segundo?
- [ ] ¿El problema ya existe o es hipotético?
- [ ] ¿Sin esta feature, el sistema falla o solo es "menos perfecto"?
- [ ] ¿Estoy construyendo infraestructura para 10k req/s cuando tengo 10 req/min?

### 🔴 Señales de Over-Engineering

```
❌ "Por si acaso cuando tengamos 1M usuarios..."
❌ "Es más limpio/mantenible así..." (sin problema real)
❌ "Así es como lo hacen en Netflix/Google..."
❌ Agregar complejidad que "no duele ahora"
```

### 🟢 Señales de Proporcionalidad Correcta

```
✅ "Esto resuelve un bug/fallo actual"
✅ "Sin esto, el sistema colapsa con el volumen actual"
✅ "Es más simple de mantener que la alternativa básica"
✅ "El costo de complejidad se justifica por el riesgo"
```

---

## 🏗️ ENTERPRISE PROMPT TEMPLATE V2 — MULTI-IA ORCHESTRATION

> **USO OBLIGATORIO** para toda solicitud de implementación

### 0️⃣ MODO DE EJECUCIÓN (OBLIGATORIO)

Este prompt se ejecuta en **dos fases**:

```
FASE A → Auditoría Sistémica
FASE B → Generación de Prompt para Implementador
```

**NO saltar fases.**  
**NO asumir estado del sistema.**  
**NO generar código hasta terminar auditoría.**

---

### 1️⃣ CONTEXTO DEL PROYECTO

Usuario debe proporcionar:
- Stack tecnológico
- Arquitectura (microservicios/monolito)
- Rutas críticas
- Contratos DTO existentes
- Entorno (dev/staging/prod)
- Estado actual del sistema

---

## 🔍 FASE A — AUDITORÍA OBLIGATORIA

### A.1 Auditoría de Arquitectura

Validar exhaustivamente:

| Ítem | ¿Qué buscar? |
|------|--------------|
| Rutas existentes | Evitar colisiones, 404s |
| Endpoints backend | GET/POST/PATCH/DELETE correctos |
| Hooks frontend | React Query keys, invalidaciones |
| Contratos DTO | Consistencia tipos ↔ API |
| Dependencias implícitas | Imports circulares, side effects |
| Columnas DB | Que existan, tipos correctos |
| Eventos SSE / realtime | Emisores y listeners |
| **Anti-patrones:** | |
| 404 ocultos | Rutas que parecen funcionar pero no |
| Columnas inexistentes | `SELECT columna_que_no_existe` |
| `r.*` peligrosos | SELECT sin proyección explícita |
| Divergencias GET/POST/PATCH | Mismos campos, diferentes tipos |

### A.2 Auditoría de Riesgo

Clasificar cada hallazgo:

| Nivel | Descripción | Ejemplo |
|-------|-------------|---------|
| **SAFE** | Cambio aislado, bajo impacto | Agregar campo opcional |
| **RISK DETECTED** | Requiere cuidado, pero manejable | Modificar query usada en 2 lugares |
| **BREAKING RISK** | Puede romper producción | Cambiar enum usado en frontend y backend |

**Formato de reporte:**
```
Archivo: src/lib/api.ts
Línea: 45
Impacto: Hook useReports depende de este tipo
Severidad: BREAKING RISK
```

### A.3 Confirmación Pre-Implementación

Antes de generar el prompt final, responder sí/no:

- [ ] ¿Se puede implementar sin migración DB?
- [ ] ¿Se requiere migración? (ALTER TABLE, ADD VALUE a enum)
- [ ] ¿Se requiere refactor? (cambio arquitectónico)
- [ ] ¿Existe deuda técnica previa que bloquea?
- [ ] ¿Hay inconsistencias de contrato detectadas?

---

## 🏗️ FASE B — GENERACIÓN DE PROMPT PARA IMPLEMENTADOR

Solo después de terminar auditoría:

### 2️⃣ OBJETIVO FUNCIONAL
Qué se quiere logar a nivel producto (no técnico)

**Ejemplo:** *"El admin puede filtrar reportes eliminados desde el panel"*

### 3️⃣ ALCANCE

**Incluye:**
- Backend: endpoint + query
- Frontend: filtro + UI

**Excluye:**
- Exportación CSV
- Bulk actions
- Notificaciones realtime

### 4️⃣ TAREAS A REALIZAR

Separado por capa:

#### Backend
```markdown
- [ ] Modificar validación de status en adminReports.js
- [ ] Agregar 'deleted' a validStatuses
- [ ] Verificar filtro not('deleted_at', 'is', null) funciona
```

#### Frontend
```markdown
- [ ] Opción "Eliminados" ya existe en dropdown
- [ ] Badge "Eliminado" ya renderiza
```

#### Database
```markdown
- [ ] No requiere migración
```

### 5️⃣ REGLAS ESTRICTAS (Checklist para implementador)

Implementador debe verificar:

- [ ] No romper contratos existentes
- [ ] No modificar endpoints existentes (salvo bugfix)
- [ ] No introducir columnas inexistentes
- [ ] No usar `r.*` en queries
- [ ] No usar `any` (usar `unknown` + type guard)
- [ ] No introducir deuda técnica nueva
- [ ] No hacer refactors innecesarios

### 6️⃣ VALIDACIONES

Verificar en:

| Capa | Validación |
|------|------------|
| Backend | Endpoint responde 200, no 500 |
| Frontend | Hook refetch correctamente |
| DB | Query usa índices (EXPLAIN) |
| Seguridad | Solo admins acceden |
| Realtime | No emitir eventos innecesarios |

### 7️⃣ CRITERIOS DE ENTREGA

Definición de "terminado":

- [ ] Sin errores 404
- [ ] Sin "column does not exist"
- [ ] Sin contrato roto (tipos ↔ API)
- [ ] Sin regresiones (lo que funcionaba sigue funcionando)
- [ ] `npx tsc --noEmit` pasa
- [ ] Sin warnings nuevos
- [ ] Logs correctos (no errores en consola)

### 8️⃣ CHECKLIST FINAL

Lista verificable antes de marcar como done:

```markdown
- [ ] Código commiteado
- [ ] PR creado con descripción
- [ ] Review propio (self-review)
- [ ] Tests pasan (si existen)
- [ ] QA manual en local
- [ ] Documentación actualizada (si aplica)
```

---

## 🧩 ESTRUCTURA DE PROMPTS (Versión Simple)

Para tareas menores (fix rápido, ajuste de UI):

### Template: Corrección de Bug

```markdown
## 🐛 Bug Report
**Descripción:** [Qué pasa y cuándo]
**Error:** [Mensaje exacto]
**Archivo:** `ruta/al/archivo.ts:linea`

## 🔍 Diagnóstico
[Root cause en 1-2 líneas]

## ✅ Solución
```typescript
// ❌ ANTES (línea X)
código problemático

// ✅ DESPUÉS  
código corregido
```

## ⚠️ Restricciones
- Solo modificar [archivo específico]
- No tocar [interfaz relacionada]
- Verificar que [X] siga funcionando
```

---

## 🎭 PATRONES DE CÓDIGO

### Backend (Node + Express + Supabase)

#### 1. Endpoint Admin (M12 Governance)

```javascript
// ✅ CORRECTO
router.delete('/:id', verifyAdminToken, async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    
    // Validación
    if (!reason || reason.trim().length < 5) {
        return res.status(400).json({ 
            error: 'Reason required for audit trail' 
        });
    }
    
    // Pre-check
    const { data: existing } = await supabaseAdmin
        .from('reports')
        .select('deleted_at')
        .eq('id', id)
        .single();
    
    if (existing?.deleted_at) {
        return res.status(400).json({ error: 'Already deleted' });
    }
    
    // Ejecución con auditoría
    await executeModeration({
        actorId: req.adminUser.id,
        targetType: 'report',
        targetId: id,
        actionType: 'ADMIN_HIDE', // o ADMIN_DELETE si existe en enum
        updateQuery: 'UPDATE reports SET deleted_at = NOW() WHERE id = $1',
        updateParams: [id],
        reason: reason.trim()
    });
    
    res.json({ success: true });
});
```

#### 2. Query Supabase (Select Explícito)

```javascript
// ✅ CORRECTO - Nunca usar r.*
const { data } = await supabaseAdmin
    .from('reports')
    .select(`
        id, title, description, category, status,
        created_at, deleted_at, is_hidden,
        anonymous_users!inner (alias, avatar_url)
    `)
    .eq('id', id)
    .single();

// Transformación a interfaz del frontend
const report = {
    ...data,
    author: {
        alias: data.anonymous_users?.alias || null,
        avatar_url: data.anonymous_users?.avatar_url || null
    }
};
```

### Frontend (React 18 + TypeScript + TanStack Query)

#### 1. Hook de React Query

```typescript
// ✅ CORRECTO
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/admin/services/adminApi';
import type { ReportModerationDetail } from '@/admin/types/reports';

export const useReportModerationDetail = (reportId?: string) => {
    return useQuery<ReportModerationDetail>({
        queryKey: ['admin', 'reports', 'detail', reportId],
        queryFn: async () => {
            if (!reportId) throw new Error('Report ID required');
            const { data } = await adminApi.get<{
                success: boolean;
                data: ReportModerationDetail;
            }>(`/reports/${reportId}`);
            return data.data;
        },
        enabled: !!reportId,
        staleTime: 60000
    });
};
```

#### 2. Manejo de Errores (unknown, no any)

```typescript
// ✅ CORRECTO
try {
    await mutateAsync(data);
} catch (err: unknown) {
    const message = err instanceof Error 
        ? err.message 
        : 'Error desconocido';
    addToast(message, 'error');
}

// ❌ INCORRECTO
catch (err: any) {
    addToast(err.message, 'error'); // err podría no ser Error
}
```

#### 3. Modales (Sin window.alert/confirm/prompt)

```typescript
// ✅ CORRECTO
const { confirm, prompt } = useConfirm();

const onDelete = async () => {
    const confirmed = await confirm({
        title: '¿Eliminar?',
        description: 'Esta acción no se puede deshacer',
        variant: 'danger'
    });
    if (!confirmed) return;
    
    const reason = await prompt({
        title: 'Motivo',
        minLength: 10,
        variant: 'danger'
    });
    if (!reason) return;
    
    await deleteReport.mutateAsync({ reason });
};

// ❌ INCORRECTO
if (!window.confirm('¿Eliminar?')) return;
const reason = window.prompt('Motivo:');
```

---

## 🗄️ ESTRUCTURA DE ARCHIVOS CLAVE

```
src/
├── admin/                    # Panel de administración (M12)
│   ├── pages/               # Reportes, Moderación, Historial
│   ├── hooks/               # useAdminReports, useModeration
│   ├── types/               # AdminReport, ModerationAction
│   └── services/            # adminApi (con query params)
├── lib/                     # Core compartido
│   ├── schemas.ts           # Zod schemas + tipos
│   ├── adapters.ts          # Transformaciones API→UI
│   ├── cache-helpers.ts     # React Query cache utils
│   ├── queryKeys.ts         # Centralized query keys
│   └── errors.ts            # Error handling
├── components/ui/           # Componentes base
│   ├── confirmation-manager.tsx  # Modales (NO nativos)
│   └── toast/               # Notificaciones
└── pages/                   # Rutas públicas

server/
├── src/
│   ├── routes/
│   │   ├── adminReports.js      # GET /api/admin/reports
│   │   ├── adminModeration.js   # Moderation actions
│   │   └── reports.js           # API pública
│   ├── utils/
│   │   └── governance.js        # executeModeration()
│   └── middleware/
│       └── adminMiddleware.js   # verifyAdminToken
```

---

## 🔧 COMANDOS ÚTILES

```bash
# Verificar TypeScript
npx tsc --noEmit

# Lint específico
npx eslint src/admin/pages/ReportModerationPage.tsx

# Test relacionado
npm test -- ReportModeration

# Verificar build
npm run build

# Check enum PostgreSQL
cd server && node check_enum_values.js
```

---

## 🚨 CHECKLIST PRE-COMMIT

Antes de finalizar cualquier tarea:

- [ ] `npx tsc --noEmit` pasa sin errores
- [ ] No hay `any` nuevo en el código modificado
- [ ] Los hooks invalidan queries correctamente
- [ ] Las acciones de admin usan `executeModeration`
- [ ] Soft delete (no hard) para eliminaciones
- [ ] Razón obligatoria en acciones de moderación
- [ ] No se rompió navegación ni filtros

---

## 📞 CONTEXTO ESPECÍFICO DEL PROYECTO

### Estado Actual (Nivel 2 Completado)

- ✅ Backend: CRUD completo con auditoría M12
- ✅ Frontend: Lista, filtros, paginación
- ✅ Detalle: ReportModerationPage con acciones
- ✅ Modales: Personalizados (no nativos)
- ✅ Soft delete: Implementado con restore
- ⚠️ Deuda técnica: ~120 `any` en legacy (no críticos)

### Enums Importantes (PostgreSQL)

```sql
report_status_enum: ('abierto', 'en_progreso', 'resuelto', 'verificado', 'rechazado', 'archivado')
moderation_action_type: ('ADMIN_RESTORE', 'ADMIN_HIDE', 'ADMIN_BAN', ...)
```

### Interfaces Críticas

```typescript
// Nunca modificar sin auditoría:
- AdminReport (src/admin/types/reports.ts)
- ReportModerationDetail
- GamificationBadge (src/lib/schemas.ts)
```

---

## 💬 EJEMPLOS DE INTERACCIÓN

### ✅ Usuario hace bien:
> "Corrige el error 400 en el filtro deleted de adminReports.js"

Respuesta: Prompt quirúrgico, una línea cambiada.

### ❌ Usuario hace mal:
> "Mejora el código de gamificación"

Respuesta: "Necesito más detalle. ¿Bug específico o feature? ¿Qué archivo?"

### ✅ Usuario pide auditoría:
> "Audita todos los any de src/lib/"

Respuesta: Lista priorizada, Fase 1 (críticos), Fase 2 (mejora), Fase 3 (polish).

---

## 🎯 POLÍTICA DE LOGGING (Producción vs Desarrollo)

### ✅ SIEMPRE EN PRODUCCIÓN

| Nivel | Cuándo usar | Ejemplo |
|-------|-------------|---------|
| **`error`** | Fallos críticos del sistema | DB caída, 500, contrato roto, error de seguridad |
| **`warn`** | Issues operacionales recuperables | 401/403, validaciones fallidas, rate limits |
| **`info`** | Eventos de negocio importantes | Usuario creado, reporte enviado, moderación aplicada |

```typescript
// ✅ PRODUCCIÓN - Siempre visibles
console.error('[Database] Connection failed:', err);
console.warn('[Auth] Token expired for user:', userId);
console.info('[Moderation] Report resolved:', { reportId, action, adminId });
```

### ❌ NUNCA EN PRODUCCIÓN

| Tipo | Ejemplo | Razón |
|------|---------|-------|
| **Debug de payloads** | `console.log('Request body:', body)` | Expone datos sensibles (PII) |
| **Trazas de ejecución** | `console.log('Entering function X')` | Ruido, innecesario |
| **Logs de infraestructura** | `console.log('[Mount] Route hit')` | No aporta valor de negocio |
| **Diagnóstico interno** | `console.debug('[PDF] Processing...')` | Detalle de librería, irrelevante |

```typescript
// ❌ SOLO DESARROLLO
console.debug('[PDF] Starting generation...');
console.log('[Mount] /api/admin/profile hit');
console.log('Full request:', req.body); // ¡Expone PII!
```

### 🛠️ IMPLEMENTACIÓN

```typescript
// Pattern condicional
if (process.env.NODE_ENV === 'development') {
    console.debug('Debug info:', data);  // Solo dev
}
console.info('Business event:', data);    // Siempre
```

### 📋 CHECKLIST PRE-DEPLOY

- [ ] ¿Este log aporta valor si el sistema falla en producción?
- [ ] ¿No expone datos sensibles (PII, tokens, passwords)?
- [ ] ¿Es accionable? (¿alguien hará algo con este log?)
- [ ] ¿No es ruido de infraestructura?

> **Regla de oro:** *"Si no lo mirarías a las 3 AM durante un incidente, no va a producción."*

---

**FIN DEL DOCUMENTO**

> "Código enterprise no es código perfecto. Es código predecible, trazable y mantenible."
