# 🏛️ AUDITORÍA ENTERPRISE COMPLETA

## 1️⃣ Executive Summary

### Estado real del proyecto
El proyecto está en estado **Scale-Ready sólido**: tiene controles transaccionales en flujos críticos, contratos realtime endurecidos y operación de secretos formalizada. Queda deuda de mantenibilidad por tamaño de módulos y boundaries frontend.

### Score por categoría
- Arquitectura: **8.0/10**
- Performance: **7.2/10**
- Seguridad: **7.6/10**
- Escalabilidad: **7.0/10**
- UX Técnica: **7.4/10**
- Mantenibilidad: **7.8/10**

### Nivel real
**Scale-Ready alto (cercano a Enterprise-Grade en backend crítico)**.

### Top 5 riesgos críticos
1. **Gestión de secretos sin evidencia de vault/rotación** (`server/.env:1`): credenciales sensibles presentes en archivo local de entorno. Riesgo operativo alto si el host o backups quedan expuestos.
2. **Canales realtime con autorización incompleta** (`server/src/routes/realtime.js:470`, `server/src/routes/realtime.js:608`, `server/src/routes/realtime.js:312`): posible lectura no autorizada de eventos/estados de terceros. **[CORREGIDO]**
3. **Catchup con fuga de metadatos globales** (`server/src/routes/realtime.js:88`): `comment-delete` no filtra por membresía/visibilidad. **[CORREGIDO]**
4. **Módulos de dominio aún grandes con alto acoplamiento** (`server/src/routes/chats.mutations.js`, `server/src/routes/comments.mutations.js`): eleva riesgo de regresiones por cambios locales. En `reports` y `comments` el riesgo bajó tras extracción de mutaciones.
5. **Drift de capas y contratos (residual)** en rutas legacy puntuales: el riesgo P0 de mezcla transaccional en `chats/reports/comments` fue cerrado, pero persiste deuda estructural por tamaño de módulos y acoplamiento de dominio.

### Estado de hallazgos reportados (actualizado)
| Hallazgo original | Estado | Evidencia |
|---|---|---|
| AuthZ incompleto en `/api/realtime/user/:id`, `/api/realtime/chats/:roomId`, `/api/realtime/catchup` | **CORREGIDO** | `server/src/routes/realtime.js` + `tests/security/realtime-authz.test.js` en verde |
| Catchup con fuga de metadatos globales | **CORREGIDO** | Filtros de visibilidad/membresía en `catchup` (`server/src/routes/realtime.js`) + suite seguridad |
| Contratos 4xx/5xx inconsistentes en auth/realtime | **CORREGIDO** | `docs/observability/auth-realtime-error-matrix.md` + `tests/security/realtime-authz.test.js` + `tests/security/auth-error-contract.test.js` |
| Hardening de secretos (arranque inseguro) | **CORREGIDO (tecnico + operativo)** | `server/src/utils/env.js` + `tests/security/env-validation.test.js` + `docs/observability/secrets-rotation-policy.md` + `docs/observability/secrets-rotation-evidence-log.md` |
| Deriva transaccional en comments (like/flag/pin/create/edit) | **CORREGIDO** | Secciones `Post Semana 3 - P1 Consistencia Transaccional Comments (...) (DONE)` |
| Bug `/reportes` favoritos (mostraba no favoritos) | **CORREGIDO** | `server/src/routes/reports.js` (`favorites_only` con `EXISTS` + `1=0` sin identidad), `src/lib/cache-helpers.ts` (`matchesFilters`) |
| Drift de identidad en `is_liked/is_favorite` de reports | **CORREGIDO** | `server/tests/security/reports-identity-source.test.js` (**2/2 PASS**) |
| Flicker de like en reports por patch parcial | **CORREGIDO (defensa cache)** | `src/lib/cache-helpers.ts` + `src/lib/cache-helpers.report-like.test.ts` (**1/1 PASS**) |
| Acoplamiento de write-paths en `reports.js` | **CORREGIDO** | Extracción por lotes a `server/src/routes/reports.mutations.js` + suite de contrato verde |
| Acoplamiento de mutaciones en `chats.js` | **CORREGIDO** | Lote 1+2+3+4+5+6+7+8+9+10+11+12+13+14+15 aplicado: extracción completa + router puro (sin lógica inline) |

---

## 2️⃣ Arquitectura

### Análisis de separación de responsabilidades
- **Fortaleza**: existe intención de capas (routes/services/utils + hooks/query client).
- **Debilidad**: capa de transporte, dominio y persistencia están mezcladas en archivos gigantes:
  - `server/src/routes/reports.js` (857 líneas, router/wiring)
  - `server/src/routes/reports.mutations.js` (855 líneas, mutaciones de dominio)
  - `server/src/routes/chats.js` (201 líneas, router puro / wiring)
  - `server/src/routes/chats.mutations.js` (1459 líneas, lógica de mutaciones y lecturas extraídas)
  - `server/src/routes/comments.js` (311 líneas, router/wiring reducido tras extracción incremental de mutaciones)
  - `server/src/routes/comments.mutations.js` (980 líneas, mutaciones extraídas: create + update + delete + like/unlike + flag + pin/unpin)
  - `src/lib/api.ts` (1251 líneas)
- **Riesgo real**: cambios locales siguen pudiendo generar efectos laterales sistémicos, especialmente en módulos >800 líneas.

### Acoplamientos peligrosos
- Boundary UI -> API runtime en `pages/components`: **CORREGIDO** (solo `import type` permitido; acceso runtime centralizado en hooks/mutations).
- Duplicación de rutas/registro ambiguo:
  - `app.use('/api/diagnostics', ...)` duplicado en `server/src/index.js:374` y `server/src/index.js:437`.

### Violaciones SOLID
- **SRP**: rutas con múltiples responsabilidades (validación, lógica negocio, persistencia, realtime, notificaciones, audit).
- **OCP**: cambios de feature obligan tocar bloques centrales masivos.
- **DIP**: handlers dependen de implementaciones concretas (`pool`, `supabase`, `queryWithRLS`) en lugar de puertos de dominio.

### Problemas de modularidad
- Ausencia de bounded contexts claros en backend (reporting/chat/auth/realtime cruzados por utilidades globales).
- `src/App.tsx` mantiene imports eager de múltiples páginas de contenido (`src/App.tsx:63` a `src/App.tsx:74`), afectando modularidad de carga.

### Cómo debería verse en versión enterprise
- `Presentation` -> `Application Services` -> `Domain` -> `Infrastructure`.
- Handlers HTTP finos (parse/validate/map), servicios de dominio con transacciones explícitas y repositorios por agregado.
- Realtime como proyección de eventos autorizados, no como bypass de autorización.

### Diagrama textual antes / después
**Antes**
`Route gigante -> SQL directo + Supabase + RLS helper + SSE + notificaciones + logs + reglas de negocio`

**Después**
`Route -> Input DTO + AuthZ -> UseCase -> Repository (Tx) -> Domain Event -> Outbox -> SSE/Push Worker`

---

## 3️⃣ Backend

### Análisis de rutas
- Cobertura funcional alta y endpoints ricos.
- Problema: heterogeneidad de estilos y contratos de error.
- En `auth/realtime`, el contrato 4xx/5xx crítico ya está estandarizado y validado con tests de seguridad.

### Validación
- Hay middleware y Zod/Joi en partes.
- Inconsistencia: validación manual + supabase checks + validadores custom mezclados dentro de handlers.

### Manejo de errores
- Existe `AppError` y middleware global.
- Riesgo residual: mantener disciplina de `next(err)` y `AppError` en nuevas rutas para evitar regresiones de contrato.

### Idempotencia
- Bien implementada en varios puntos (`ON CONFLICT DO NOTHING` y manejo de `23505`).
- Incompleta en flujos chat/realtime con updates separados fuera de transacción.

### Concurrencia
- `transactionWithRLS` es buen paso.
- El riesgo de mezcla transaccional en flujos críticos de chat/reportes/comments fue mitigado con `transactionWithRLS` y side-effects post-commit.

### Transacciones
- Patrón transaccional ya es dominante en flujos críticos; pendiente mantenerlo como regla para todo endpoint nuevo.
- Resultado: posibilidad de estado parcial (DB ok + SSE fallido o viceversa) en algunos paths.

### Versionado de API
- Hay headers de versión (`X-API-Version`, `X-Min-Client-Version`) en `server/src/index.js`.
- Falta versionado formal (`/v1`, `/v2`) para contratos breaking.

### Qué está bien
- `transactionWithRLS` y cola de SSE post-commit (`server/src/utils/rls.js`).
- Estrategia de realtime enriquecida y dedupe.
- Integración de auditoría estructurada (`server/src/services/auditService.js`).

### Qué está mal
- Endpoints realtime con AuthZ insuficiente.
- Mezcla de drivers/patrones de persistencia.
- Contrato de errores inconsistente en auth.

### Refactor propuesto con ejemplos de código

```js
// ❌ Código actual
// server/src/routes/realtime.js
router.get('/user/:anonymousId', (req, res) => {
  const { anonymousId } = req.params;
  // ...suscribe sin verificar que req.user.anonymous_id === anonymousId
});
```

```js
// ✅ Versión Enterprise propuesta
router.get('/user/:anonymousId', requireAuthenticatedUser, async (req, res, next) => {
  const { anonymousId } = req.params;
  if (req.user.anonymous_id !== anonymousId && req.user.role !== 'admin') {
    return next(new ForbiddenError('Forbidden realtime channel'));
  }
  return attachUserStream({ req, res, anonymousId });
});
```

```js
// ❌ Código actual
// server/src/routes/auth.js
} catch (err) {
  logError(err, req);
  res.status(500).json({ error: 'Error del servidor' });
}
```

```js
// ✅ Versión Enterprise propuesta
} catch (err) {
  return next(err); // delega a AppError middleware y conserva status/código
}
```

```js
// ❌ Código actual
// server/src/middleware/auth.js
const JWT_SECRET = process.env.JWT_SECRET || 'safespot-secret-key-change-me';
```

```js
// ✅ Versión Enterprise propuesta
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required');
}
const JWT_SECRET = process.env.JWT_SECRET;
```

---

## 4️⃣ Base de Datos

### Estado de auditoría SSOT (DB real)
- **Auditoría ejecutada en vivo el 2026-02-15** conectando con `server/.env` (`DATABASE_URL`).
- Resultado real:
  - Tablas `public`: **41**
  - Índices: **207**
  - Constraints: **281**
  - Políticas RLS: **91**
  - Columnas: **449**
- RLS:
  - Activo en todas las tablas de negocio revisadas.
  - `relrowsecurity = false` solo en `spatial_ref_sys` (esperable, tabla de sistema GIS).

### Índices faltantes (por patrón de consulta observado)
- `notifications (anonymous_id, is_read, created_at DESC)` para bandeja/contador.
- `chat_messages (conversation_id, created_at DESC)` si no existe compuesto completo.
- `comments (report_id, deleted_at, created_at DESC)` para listados paginados por reporte.

### Índices innecesarios / riesgo potencial
- **Redundancias reales detectadas** en DB viva:
  - `badges_code_key` y `idx_badges_code` (misma firma en `code`).
  - `idx_user_auth_email` y `user_auth_email_key` (misma firma en `email`).
  - `idx_user_auth_anonymous_id` y `unique_anonymous_id` (misma firma en `anonymous_id`).
  - `idx_votes_user_polymorphic`, `unique_vote_per_target`, `unique_vote_per_user_target` (misma firma en `anonymous_id,target_type,target_id`).
  - Múltiples duplicados en `moderation_actions` (`created_at` y `target_id,target_type`).
- Índices con `idx_scan = 0` (potencial sobreindexing): aparecen varios en `reports`, `notifications`, `comments`, `chat_rooms`, `votes` y `rate_limits`. Requiere pruning controlado por ventana de observación.

### Riesgos de locking
- Updates masivos potenciales en arranque/scripts y mantenimiento pueden competir con tráfico en tablas calientes (`reports`, `comments`, `chat_messages`).
- Falta evidencia de estrategia uniforme `CREATE INDEX CONCURRENTLY` en todas las evoluciones.

### Riesgos de race condition
- Flujos chat y delivery con actualizaciones fuera de transacción única.
- Mezcla de `queryWithRLS` y `pool.query` en mismo request rompe atomicidad de negocio.

### Soft delete correcto vs incorrecto
- **Correcto**: `deleted_at` en reportes/comentarios y filtros en feeds.
- **Incorrecto/parcial**: no todos los canales de catchup/realtime aplican los mismos filtros de visibilidad y pertenencia.

### Integridad referencial
- PK: **sin tablas sin PK** en `public`.
- FK: hay cobertura, pero no homogénea; varias tablas críticas no dependen de FK (ej. `audit_logs`, `rate_limits`, `global_stats`, `domain_events_log`) por diseño operativo.
- **Drift crítico detectado en chat**:
  - `chat_messages` tiene `room_id` y `conversation_id`.
  - En vivo: `total=589`, `room_id_nulls=589`, `conversation_id_nulls=0`.
  - Conclusión: `room_id` está legacy/obsoleto en datos actuales; mantener ambas columnas incrementa riesgo de inconsistencias y bugs de joins.

### Estrategia para 1M usuarios
- Particionar `chat_messages` por tiempo o hash de `conversation_id`.
- Separar lectura caliente de notificaciones en tabla/materialized view de inbox.
- Cola de eventos/outbox para desacoplar mutación transaccional de fan-out realtime/push.

### Plan de migración sin downtime
1. Agregar columnas/indexes de forma backward-compatible.
2. Backfill por lotes con job idempotente.
3. Dual-read o read-fallback temporal.
4. Dual-write acotado con métricas de divergencia.
5. Cutover con feature flag.
6. Retiro de legado después de ventana de observación.

---

## 5️⃣ Performance

### Problemas de queries
- Catchup realtime arma múltiples consultas por request con límites fijos y sin estrategia incremental robusta por actor.
- En comentarios y chats hay consultas complejas + subconsultas + operaciones post-query no siempre consolidadas.

### Problemas frontend (re-renders, hooks, cache)
- `useGlobalRealtime` reejecuta por `location`/`navigate` en dependencias (`src/hooks/useGlobalRealtime.ts:60`), causando resuscripciones no necesarias.
- Query config agresiva (`refetchOnWindowFocus/refetchOnMount`) con historial de request storm (`src/lib/queryClient.ts`).
- Direct API calls en UI (sin hooks dedicados) dificultan cache central.

### Bundle size
- Buen trabajo de manualChunks en `vite.config.ts`.
- Penalización: imports eager en `src/App.tsx:63-74` para páginas de contenido que podrían lazy-load.

### Carga inicial
- Riesgo por inicialización pesada en bootstrap (`src/main.tsx:70`, `src/main.tsx:90`) cuando hay schema mismatch.

### Tiempo de interacción
- En dispositivos limitados, recarga forzada + limpieza agresiva puede afectar TTI y estabilidad percibida.

### Estrategia de optimización real
- Mover páginas de contenido a lazy imports.
- Reducir refetch agresivo y usar invalidación/event-driven por dominio.
- Consolidar pipelines de query por caso de uso (sin `fetch` directo en UI).
- Perf budgets obligatorios por chunk y endpoint p95.

---

## 6️⃣ Seguridad

### Riesgos reales
- Secretos sensibles en `.env` local/servidor sin evidencia en este repo de gestión centralizada (vault/KMS) ni política explícita de rotación.
- Endpoints realtime con control de autorización incompleto.
- Hardening de `JWT_SECRET` aplicado (sin fallback inseguro fuera de `test`); pendiente consolidar rotación operativa continua.
- Endpoint de `message-status` sin verificación de membresía.

### Superficie de ataque
- Realtime (`/api/realtime/*`) + auth + admin gateway + rutas de chat.
- Alta por cantidad de endpoints y excepciones por contexto.

### Rate limiting
- Existe rate limiting global y granular.
- Riesgo: varios flujos sensibles dependen de identidad no unificada en todo el stack realtime.

### Validaciones insuficientes
- Validación heterogénea por ruta.
- Inconsistencia de estados HTTP en auth degrada respuesta de seguridad.

### JWT mal implementado (si aplica)
- No está “mal implementado” criptográficamente, pero sí **mal protegido operativamente** por fallback de secreto y controles de canal incompletos.

### Qué faltaría para cumplir estándar enterprise real
- Secret management fuera de repo + rotación inmediata.
- AuthZ obligatorio por canal realtime (owner/member/admin).
- Reglas unificadas de autorización en catchup/replay/sse.
- Hard fail de configuración insegura en boot.

---

## 7️⃣ Escalabilidad 10x / 100x / 1M usuarios

### Qué rompe primero
1. Fan-out realtime en Node + EventEmitter sin capa de backpressure por canal.
2. Endpoints chat/catchup con consultas crecientes y lógica post-procesamiento.
3. Cohesión débil de caché/invalidaciones en frontend bajo alta concurrencia.

### Qué sistema colapsa primero
- **Primero**: realtime/chat.
- **Segundo**: rutas monolíticas de reportes/comentarios por complejidad y acoplamiento.

### Cómo debería evolucionar la arquitectura
- Pasar de “request handler inteligente” a “use cases + outbox + workers”.
- Aislar canales realtime por ámbito (feed global, user-private, room-private) con auth central.
- Formalizar event-driven para notificaciones y reconciliación.

### Redis cluster / replicas / CDN / queues / event-driven
- Redis: migrar a cluster con partición por dominio (`presence`, `dedupe`, `rate`).
- Postgres: réplicas de lectura para listados intensivos.
- CDN: estáticos + media + hints de caché por versión de app.
- Queues: BullMQ para push/notifications/reconciliation.
- Event-driven: outbox transaccional + consumidores idempotentes.

---

## 8️⃣ UX Técnica (Engineering + Producto)

### Flujos que rompen conversión
- Respuestas 500 genéricas en auth ante errores de usuario generan abandono.
- Rehidratación/reload agresivo en boot puede percibirse como app inestable.

### Inconsistencias técnicas que afectan UX
- Rutas duplicadas (`/usuario/:alias/sugerencias`) en `src/App.tsx:198-199`.
- Estrategias mixtas de data fetching (hooks + fetch directo + imports runtime) producen comportamiento no uniforme.

### Problemas estructurales que impactan percepción
- Estados realtime potencialmente desincronizados entre tabs/sesiones en escenarios de reconnect.
- Errores de red y seguridad no siempre se traducen en feedback útil.

---

## 9️⃣ Refactor Roadmap Priorizado

| Tarea | Impacto | Esfuerzo | Riesgo | Prioridad real |
|---|---|---|---|---|
| Formalizar gestión de secretos (vault/KMS) y rotación; evitar secretos estáticos de larga vida en `.env` de servidor | Muy Alto | Medio | Alto | P0 |
| Cerrar AuthZ de realtime (`/user/:id`, `/chats/:roomId`, `/message-status`, `/catchup`) | Muy Alto | Medio | Alto | P0 |
| Eliminar fallback de `JWT_SECRET` y endurecer startup checks | Alto | Bajo | Medio | P0 |
| Unificar persistencia por caso de uso (sin mezclar `supabase` + `pool` + `queryWithRLS`) | Alto | Alto | Medio | P1 |
| Reducir tamaño de handlers (extraer servicios de dominio) | Alto | Alto | Medio | P1 |
| Estandarizar manejo de errores (4xx/5xx) en auth y rutas críticas | Alto | Medio | Bajo | P1 |
| Reestructurar `src/lib/api.ts` en módulos de dominio + hooks exclusivos | Medio | Medio | Bajo | P1 |
| Mover imports eager de contenido a lazy chunks | Medio | Bajo | Bajo | P2 |
| Eliminar acceso API directo en componentes/páginas; dejar solo hooks/services | Medio | Medio | Bajo | P2 |
| Implementar outbox para eventos post-commit (SSE/push/notificaciones) | Muy Alto | Alto | Medio | P2 |

### Estado Semana 1 (DONE)
- Realtime authorization hardened.
- Cross-user stream access prevented.
- Security tests validated.

### Semana 2 — Chat Persistence Alignment (DONE)
- `conversation_id` confirmado como SSOT en persistencia de chat.
- `room_id` declarado legacy; no se usa en writes actuales de `chat_messages`.
- Payloads de push/SSE normalizados a `conversationId` como identificador canónico.
- `roomId` mantenido como alias temporal de backward compatibility.
- Tests de contrato agregados para validar el estándar:
  - `server/tests/security/chat-payload-contract.test.js`
  - `server/tests/security/orchestrator-chat-contract.test.js`
- Verificación ejecutada:
  - Tests: `realtime-authz`, `chat-membership`, `chat-payload-contract`, `orchestrator-chat-contract` en verde.
  - Type check: `npx tsc --noEmit` en verde.
- Nota de deprecación controlada:
  - `roomId será eliminado en una futura Fase 4 cuando no existan consumidores legacy.`

### Semana 3 - Matriz Final Contrato Realtime Chat (DONE)

| Evento (SSE) | Campos obligatorios | Semantica | Emisor canonico |
|---|---|---|---|
| `chat-update` | `eventId`, `conversationId`, `serverTimestamp`, `originClientId` | Actualizacion dirigida al inbox/sidebar del usuario (estado de sala, mensaje nuevo, acciones de control) | `realtimeEvents.emitUserChatUpdate` (`server/src/utils/eventEmitter.js`) |
| `new-message` | `eventId`, `conversationId`, `serverTimestamp`, `originClientId` | Entrega de mensaje en stream de sala y/o stream de usuario (pending bootstrap) | `realtimeEvents.emitChatMessage` + adapter SSE (`server/src/routes/realtime.js`) |
| `message.delivered` | `eventId`, `conversationId`, `serverTimestamp`, `originClientId` | Confirmacion de entrega (doble tick gris) por mensaje o por reconciliacion | `realtimeEvents.emitMessageDelivered` (`server/src/utils/eventEmitter.js`) |
| `message.read` | `eventId`, `conversationId`, `serverTimestamp`, `originClientId` | Confirmacion de lectura (doble tick azul) por mensaje o batch de reconciliacion | `realtimeEvents.emitMessageRead` (`server/src/utils/eventEmitter.js`) |
| `typing` | `eventId`, `conversationId`, `serverTimestamp`, `originClientId` | Estado efimero de escritura en sala | `realtimeEvents.emitChatStatus('typing', ...)` |
| `presence` | `eventId`, `conversationId`, `serverTimestamp`, `originClientId` | Estado online/offline dentro de sala de chat | `realtimeEvents.emitChatStatus('presence', ...)` |
| `chat-rollback` | `eventId`, `conversationId`, `serverTimestamp`, `originClientId` | Reversion/compensacion de estado de chat en canal usuario | `user-chat-rollback:*` (consumido en `server/src/routes/realtime.js`) |
| `notification` (chat scope) | `eventId`, `conversationId`, `serverTimestamp`, `originClientId` | Notificacion de actividad ligada al contexto de conversacion cuando aplique | `realtimeEvents.emitUserNotification` + adapter SSE |
| `presence-update` | `eventId`, `conversationId`, `serverTimestamp`, `originClientId` | Actualizacion de presencia cruzada en canal usuario | Canal `presence-update` consumido en `server/src/routes/realtime.js` |

#### Reglas de contrato cerradas (Semana 3)
- `conversationId` es el identificador oficial en todos los eventos chat/realtime.
- `roomId` se mantiene solo como alias temporal de compatibilidad.
- `eventId` debe ser deterministico para un mismo hecho de dominio (sin random para eventos de negocio).
- `serverTimestamp` debe representar tiempo servidor del evento emitido.
- `originClientId` identifica origen (`backend`, `system_*` o cliente propagado) para dedupe y trazabilidad.

### Semana 3 - Runbook Dia 4 (Index Drops Controlados)

#### Regla operativa inquebrantable
- Ejecutar `DROP INDEX CONCURRENTLY` de a **un indice por comando**.
- **No** envolver en `BEGIN/COMMIT` (Postgres no lo permite para `CONCURRENTLY`).

#### Pre-checks (obligatorios antes de cada drop)
1. Salud de conexiones y sesion:
   - `SELECT now(), current_database(), current_user;`
   - `SELECT count(*) AS active_connections FROM pg_stat_activity WHERE datname = current_database();`
2. Latencia base (p95) en endpoints criticos:
   - `GET /api/chats/*`
   - `GET /api/notifications/*`
   - `GET /api/comments/*`
   - `GET /api/reports/*`
3. Locks activos en tablas objetivo:
   - `SELECT locktype, relation::regclass, mode, granted, pid FROM pg_locks WHERE relation IS NOT NULL ORDER BY relation::regclass::text, granted;`
4. Estado del indice candidato:
   - `indisvalid = true`
   - `indisready = true`
   - `indislive = true`
5. Evidencia de equivalencia exacta (definicion completa) con su par canonico:
   - comparar `pg_get_indexdef(index_oid)` completo y firma canonica normalizada.
6. Verificacion de dependencia a constraints:
   - `LEFT JOIN pg_constraint c ON c.conindid = index_oid`
   - si hay `constraint_name`, **no** hacer drop directo del indice.

#### Ejecucion por lotes (fase A - solo duplicados sin constraint)
1. Seleccionar un unico indice candidato validado.
2. Ejecutar:
   - `DROP INDEX CONCURRENTLY IF EXISTS public.<indice_candidato>;`
3. Esperar estabilizacion corta (3-5 min) y medir.
4. Repetir con el siguiente indice (batch chico, 1 por vez).

#### Post-checks (despues de cada drop)
1. Revalidar p95/p99 de endpoints criticos contra baseline.
2. Revisar actividad de indices:
   - `SELECT indexrelname, idx_scan, idx_tup_read, idx_tup_fetch FROM pg_stat_user_indexes WHERE schemaname='public' AND relname IN ('chat_messages','notifications','comments','reports','votes','moderation_actions','user_actions','user_zones') ORDER BY relname, indexrelname;`
3. Revisar locks/esperas anormales:
   - `pg_locks`, `pg_stat_activity` (queries bloqueadas, wait_event).
4. Confirmar que no aparecieron errores 5xx nuevos en rutas afectadas.

#### Rollback logico (si hay degradacion)
1. Detectar sintomas:
   - aumento sostenido de p95/p99,
   - incremento de CPU DB,
   - planes con `Seq Scan` inesperado en consultas criticas.
2. Verificar query plans de endpoints degradados (`EXPLAIN (ANALYZE, BUFFERS)` en queries representativas).
3. Revertir creando indice equivalente en bajo trafico:
   - `CREATE INDEX CONCURRENTLY <nuevo_nombre> ON <tabla> (<columnas> ...);`
4. Revalidar metricas y cerrar incidente con evidencia (antes/despues).

#### Caso `votes` (fase B - constraint dedupe, no drop directo de indice)
1. Confirmar que constraints duplicadas garantizan la misma unicidad semantica.
2. Elegir constraint canonica.
3. Dropear **constraint duplicada** (no el indice directamente):
   - `ALTER TABLE public.votes DROP CONSTRAINT <constraint_duplicada>;`
4. Verificar constraint restante + indice asociado.
5. Validar que inserts/upserts de `votes` mantienen la misma semantica de negocio.

Nota: `roomId` sera eliminado en una futura Fase 4 cuando no existan consumidores legacy.

### Semana 3 - Hardening DB (Fase A DONE / Fase B DONE)

#### Fase A (DONE) - Evidencia de ejecucion real
- Fecha de ejecucion: **2026-02-15** (ventana controlada, 1 drop por comando, `DROP INDEX CONCURRENTLY`, espera de 5 min entre drops).
- Indices eliminados:
  - `public.idx_mod_actions_created`
  - `public.idx_moderation_actions_created_at`
  - `public.idx_moderation_actions_target`
  - `public.idx_moderation_target`
  - `public.idx_user_actions_actor_id`
  - `public.idx_moderation_actor`
  - `public.idx_user_zones_anonymous_id`
- Verificacion post-ejecucion:
  - Consulta de existencia de esos 7 indices: **0 filas** (eliminados).
  - `votes` sin cambios estructurales.

#### Validacion "sin regresiones" post Fase A
- Planes/queries representativas (`EXPLAIN ANALYZE BUFFERS`) en tablas tocadas:
  - `moderation_actions`: uso de `idx_mod_actions_target` y `idx_moderation_actions_actor` confirmado.
  - `user_actions`: uso de `idx_user_actions_actor` confirmado.
  - `user_zones`: planner con `Seq Scan` en consultas de muestra por cardinalidad baja (tabla chica), sin impacto material.
- Locks/waits:
  - Dos snapshots separados (15s) sin bloqueos sostenidos ni waits anormales.
- Health DB/autovacuum/IO:
  - Sin evidencia de degradacion operativa anomala posterior a drops.

#### Fase B (`votes`) - DONE (2026-02-16)
- Estado: **DONE**.
- Ejecucion aplicada:
  - `ALTER TABLE public.votes DROP CONSTRAINT unique_vote_per_user_target;`
- Resultado post-ejecucion:
  - Se conserva `unique_vote_per_target` como constraint canonica.
  - Constraint duplicada removida.
  - Prueba funcional de unicidad valida (`23505` esperado en insercion duplicada).
- Evidencia:
  - `docs/observability/votes-phase-b-gate.md`.

### Semana 3 - Operacion (DONE)

#### Estado DONE (cerrado)
- Estandarizacion de errores `4xx/5xx` en `auth + realtime` con contrato uniforme y `requestId`.
  - Evidencia: `docs/observability/auth-realtime-error-matrix.md`.
  - Tests de contrato en verde:
    - `tests/security/auth-error-contract.test.js`
    - `tests/security/realtime-authz.test.js`
- Hardening de secretos y arranque seguro:
  - Validador centralizado: `server/src/utils/env.js`.
  - Hard-fail de secretos críticos en API + Worker.
  - `JWT_SECRET` sin fallback inseguro fuera de `test`.
  - Push condicionado por feature flag (`ENABLE_PUSH_NOTIFICATIONS`).
  - Política operativa de rotación con gate GO/NO-GO y evidencia trazable:
    - `docs/observability/secrets-rotation-policy.md`
    - `docs/observability/secrets-rotation-evidence-log.md`
  - Evidencia de pruebas:
    - `tests/security/env-validation.test.js` (2/2 verde).
    - `npx tsc --noEmit` (server) en verde.
- Runbook operativo enterprise:
  - `docs/observability/runbook-incidentes-metricas.md`.
  - `docs/observability/secrets-rotation-policy.md`.
- Observabilidad minima basada en logs (sin Grafana):
  - 4 queries guardadas: `docs/observability/log-queries-week3.md`.
  - Fire-drill manual documentado: `docs/observability/fire-drill-manual-week3.md`.
  - Runbook operativo ajustado a logs: `docs/observability/runbook-incidentes-metricas.md`.

#### Cierre formal Punto 4 (Operacion enterprise)
- Gobierno operativo documentado:
  - RACI minimo para rotacion de secretos (`owner tecnico`, `on-call`, `security owner`).
  - Politica de evidencia obligatoria por cambio/incidente (ticket, timestamp, requestId, decision GO/ROLLBACK).
- Criterios de operacion estandarizados:
  - SLO de respuesta inicial y mitigacion por severidad.
  - Regla de congelamiento de deploys ante multiples umbrales cruzados.
  - Cierre de incidente condicionado a evidencia trazable (sin evidencia = no cierre).
- Fire-drill y queries con gate operativo:
  - Plantillas de evidencia con owner/fecha/decision.
  - Umbrales y acciones GO/NO-GO definidos para auth/realtime/ack/catchup.

#### Estado DONE (scope tecnico)
- No hay pendientes tecnicos abiertos de Semana 3 en DB hardening.

#### Update Fase B (`votes`) - 2026-02-16
- Gate de pruebas backend: **PASS**.
- Equivalencia de constraints en DB real: **CONFIRMADA**.
- Ejecucion en ventana controlada: **COMPLETADA**.
- Evidencia consolidada:
  - `docs/observability/votes-phase-b-gate.md`.

### Post Semana 3 - P1 Consistencia Transaccional Comments (LIKE/UNLIKE) (DONE)

#### Scope cerrado
- Endpoint `POST /api/comments/:id/like`:
  - write + readback unificados en `transactionWithRLS`.
  - `emitCommentLike` y `emitVoteUpdate` emitidos via cola transaccional (`sse.emit`) post-commit.
- Endpoint `DELETE /api/comments/:id/like`:
  - delete + readback unificados en `transactionWithRLS`.
  - side-effects realtime emitidos solo post-commit.

#### Beneficio tecnico concreto
- Se elimina estado parcial por mezcla `supabase + queryWithRLS` en el mismo flujo.
- Se elimina riesgo de emitir eventos realtime cuando la transaccion falla (rollback).
- Se asegura idempotencia operacional en unlike (`Like not found` sin side-effects).

#### Evidencia de validacion
- Test transaccional dedicado:
  - `tests/security/comment-like-transaction.test.js` -> **4/4 PASS**.
  - Cobertura:
    - exito like (count correcto + evento).
    - rollback like (cero side-effects).
    - idempotencia unlike (sin eventos).
    - rollback unlike (cero side-effects).
- Tipado backend:
  - `npx tsc --noEmit` -> **PASS**.

#### Estado
- **DONE (scope acotado)** para `like/unlike`.

### Post Semana 3 - P1 Consistencia Transaccional Comments (FLAG) (DONE)

#### Scope cerrado
- Endpoint `POST /api/comments/:id/flag`:
  - verificacion de comentario + validaciones de negocio + insert de `comment_flags` unificados en `transactionWithRLS`.
  - se elimina mezcla de write-path entre `supabase` y `queryWithRLS`.
  - `auditLog` queda como side-effect post-commit (no se dispara si falla la transaccion).

#### Beneficio tecnico concreto
- El flujo deja de tener puntos de estado parcial en validacion/insert.
- Se evita auditoria inconsistente ante fallas intermedias (sin commit -> sin audit log).
- Se mejora trazabilidad y reproducibilidad de incidentes.

#### Evidencia de validacion
- Test dedicado:
  - `tests/security/comment-flag-transaction.test.js` -> **2/2 PASS**.
  - Cobertura:
    - exito (201 + `flag_id` + `auditLog`).
    - falla intermedia de insert (500 + cero side-effects: sin `auditLog`, sin notificaciones/realtime).
- Tipado backend:
  - `npx tsc --noEmit` -> **PASS**.

#### Estado
- **DONE (scope acotado)** para `flag`.
- `pin/unpin` y `create` se cierran en bloques P1 posteriores (ver secciones siguientes).

### Post Semana 3 - P1 Consistencia Transaccional Comments (PIN/UNPIN) (DONE)

#### Scope cerrado
- Endpoint `POST /api/comments/:id/pin`:
  - verificacion `comment/report owner` + `UPDATE` unificados en `transactionWithRLS`.
  - `emitCommentUpdate` emitido via cola transaccional (`sse.emit`) post-commit.
- Endpoint `DELETE /api/comments/:id/pin`:
  - verificacion `comment/report owner` + `UPDATE` unificados en `transactionWithRLS`.
  - side-effects realtime emitidos solo post-commit.

#### Beneficio tecnico concreto
- Se elimina mezcla de drivers (`supabase + queryWithRLS`) en write-path de pin/unpin.
- Se elimina riesgo de emitir realtime cuando la transaccion falla (rollback).
- Se vuelve determinista el comportamiento ante errores intermedios.

#### Evidencia de validacion
- Test dedicado:
  - `server/tests/security/comment-pin-transaction.test.js` -> **2/2 PASS**.
  - Cobertura:
    - exito pin (evento emitido post-commit).
    - falla intermedia unpin (500 + cero side-effects realtime).
- Tipado:
  - `npx tsc --noEmit` -> **PASS**.

#### Estado
- **DONE (scope acotado)** para `pin/unpin`.

### Post Semana 3 - P1 Consistencia Transaccional Comments (CREATE) (DONE)

#### Scope cerrado
- Endpoint `POST /api/comments`:
  - prechecks de `report` y `parent` movidos al mismo `transactionWithRLS` (sin drift de driver).
  - validacion de visibilidad/moderacion (`trust_score`, `moderation_status`) ejecutada con el mismo `client` transaccional.
  - `emitNewComment` se mantiene via cola transaccional (`sse.emit`) post-commit.
  - notificaciones/auditoria/gamification se mantienen post-commit (no bloqueantes).

#### Beneficio tecnico concreto
- Se elimina race entre prechecks fuera de tx y write dentro de tx.
- Se reduce riesgo de estados parciales en alta concurrencia.
- Se preserva contrato API sin cambios de schema.

#### Evidencia de validacion
- Test dedicado:
  - `server/tests/security/comment-create-transaction.test.js` -> **2/2 PASS**.
  - Cobertura:
    - exito (201 + `emitNewComment` + side-effects post-commit).
    - falla intermedia de insert (500 + rollback + cero side-effects).
- Revalidacion de flujos relacionados:
  - `server/tests/security/comment-like-transaction.test.js` -> **4/4 PASS**.
  - `server/tests/security/comment-pin-transaction.test.js` -> **2/2 PASS**.
- Tipado:
  - `npx tsc --noEmit` -> **PASS**.

#### Estado
- **DONE (scope acotado)** para `create` de comments.

### Post Semana 3 - P1 Consistencia Transaccional Comments (EDIT) (DONE)

#### Scope cerrado
- Endpoint `PATCH /api/comments/:id`:
  - ownership check + `UPDATE` + readback unificados en `transactionWithRLS`.
  - realtime de edicion (`emitCommentUpdate`) emitido via cola transaccional (`sse.emit`) post-commit.
  - contrato HTTP preservado (`404` no existe, `403` no owner, `200` exito, `500` error real).

#### Beneficio tecnico concreto
- Se elimina drift entre check y write por ejecutarse con un mismo `client` transaccional.
- Se evita emitir eventos de edicion en escenarios de rollback.
- Se endurece una ruta sensible de ownership sin cambiar schema ni contrato.

#### Evidencia de validacion
- Test dedicado:
  - `server/tests/security/comment-edit-transaction.test.js` -> **3/3 PASS**.
  - Cobertura:
    - exito (200 + `emitCommentUpdate` post-commit).
    - falla intermedia (500 + rollback + cero side-effects realtime).
    - seguridad (403 cuando el actor no es owner).
- Gate del bloque comments:
  - `server/tests/security/comment-create-transaction.test.js` -> **2/2 PASS**.
  - `server/tests/security/comment-like-transaction.test.js` -> **4/4 PASS**.
  - `server/tests/security/comment-pin-transaction.test.js` -> **2/2 PASS**.
- Tipado:
  - `npx tsc --noEmit` -> **PASS**.

#### Estado
- **DONE (scope acotado)** para `edit` de comments.

### Post Semana 3 - P1 Reports (Favoritos + Identidad + Like Flicker) (DONE)

#### Scope cerrado
- Filtro `favorites_only` en `GET /api/reports`:
  - backend aplica `EXISTS (favorites...)` por usuario en feeds geografico y cronologico.
  - si no hay identidad valida, responde vacio funcional (`1 = 0`) y evita fuga global.
- Fuente de identidad para personalizacion (`is_liked`, `is_favorite`) normalizada a `req.anonymousId`/`resolveRequestAnonymousId`:
  - lista (`GET /api/reports`)
  - detalle (`GET /api/reports/:id`)
- Reconciliacion de cache para like:
  - `reportsCache.patch` preserva `is_liked` cuando llega patch parcial sin ese campo.
  - evita rebote visual por payload parcial en reconciliacion.

#### Beneficio tecnico concreto
- El filtro de favoritos deja de devolver reportes fuera del usuario actual.
- Se elimina drift de identidad entre lectura de feed y mutaciones like/unlike.
- Se reduce flicker de estado personal de like sin cambiar contrato API.

#### Evidencia de validacion
- Backend:
  - `tests/security/reports-identity-source.test.js` -> **2/2 PASS**.
- Frontend:
  - `src/lib/cache-helpers.report-like.test.ts` -> **1/1 PASS**.
- Gate de tipado:
  - `server`: `npx tsc --noEmit` -> **PASS**.
  - `frontend`: `npx tsc --noEmit` -> **PASS**.

#### Estado
- **DONE (scope acotado)** para favoritos + identidad + anti-flicker en cache.
- **DONE (scope acotado)** para `POST/DELETE /api/reports/:id/like` con side-effects post-commit.
- **DONE (scope acotado)** para `POST /api/reports/:id/favorite` con transaccion unica en toggle.
- **DONE (scope acotado)** para `PATCH /api/reports/:id` con side-effects realtime post-commit.
- **DONE (scope acotado)** para suite de contrato `reports` (status/shape) en rutas criticas.
- **DONE (scope acotado)** para extraccion de mutaciones `reports` a modulo dedicado sin cambios de contrato.

#### Reports - Fase A Read-Only (matriz de continuidad sin regresiones)
| Endpoint | Como escribe hoy | Riesgo real | Fix minimo sugerido |
|---|---|---|---|
| `POST /api/reports/:id/like` | `transactionWithRLS` (check + insert voto + readback) + SSE via cola transaccional | Riesgo residual bajo (acoplamiento de ruta, no de consistencia) | **DONE** |
| `DELETE /api/reports/:id/like` | `transactionWithRLS` (check + delete voto + readback) + SSE via cola transaccional | Riesgo residual bajo (acoplamiento de ruta, no de consistencia) | **DONE** |
| `POST /api/reports/:id/favorite` | Toggle en `transactionWithRLS` (check + insert/delete atomico) | Riesgo de carrera mitigado; contrato estable | **DONE** |
| `PATCH /api/reports/:id` | Ownership check + update + readback en `transactionWithRLS`; `emitReportUpdate` en cola post-commit | Evita side-effects en rollback | **DONE** |
| `POST /api/reports/:id/flag` | `transactionWithRLS` (check + dedupe + insert + status check) + SSE/audit post-commit | Riesgo residual bajo (acoplamiento de ruta, no de consistencia) | **DONE** |

**Endpoint elegido para siguiente bloque P1:** `POST /api/reports/:id/flag` (normalizado y cerrado en este ciclo).

### Post Semana 3 - P1 Reports (Favorite Toggle Transaccional) (DONE)

#### Scope cerrado
- Endpoint `POST /api/reports/:id/favorite`:
  - verificacion de reporte + check existente + insert/delete de favorito unificados en `transactionWithRLS`.
  - se mantiene idempotencia (`already_exists`) sin cambiar contrato API.
  - se conserva respuesta original (`added/removed/already_exists/404/500`).

#### Beneficio tecnico concreto
- Menor riesgo de estado parcial en toggle concurrente.
- Camino de datos mas predecible (una sola tx para el write-path).
- Cero impacto de contrato para frontend (sin regresiones de integración).

#### Evidencia de validacion
- Test dedicado:
  - `server/tests/security/report-favorite-transaction.test.js` -> **3/3 PASS**.
  - Cobertura:
    - exito add favorite.
    - falla intermedia (500 sin romper contrato).
    - `404` no encontrado.
- Revalidacion relacionada:
  - `server/tests/security/report-like-transaction.test.js` -> **2/2 PASS**.
  - `server/tests/security/reports-identity-source.test.js` -> **2/2 PASS**.
- Tipado:
  - `server`: `npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - P1 Reports (PATCH Transaccional + Realtime Post-Commit) (DONE)

#### Scope cerrado
- Endpoint `PATCH /api/reports/:id`:
  - ownership check + `UPDATE` + readback unificados en `transactionWithRLS`.
  - `emitReportUpdate` migrado a cola transaccional (`sse.emit`) para emitir solo post-commit.
  - contrato HTTP preservado (`400` no fields/strict lifecycle, `403` no owner, `404` not found, `500` error real).

#### Beneficio tecnico concreto
- Elimina riesgo de emitir `report-update` cuando la transaccion falla.
- Reduce drift entre precheck y write path al ejecutarse en un solo client transaccional.
- Mantiene contrato API estable para frontend.

#### Evidencia de validacion
- Test dedicado:
  - `server/tests/security/report-patch-transaction.test.js` -> **3/3 PASS**.
  - Cobertura:
    - exito (200 + evento post-commit).
    - falla intermedia (500 + cero side-effects realtime).
    - seguridad (403 no owner).
- Revalidacion bloque reports:
  - `server/tests/security/report-favorite-transaction.test.js` -> **3/3 PASS**.
  - `server/tests/security/report-like-transaction.test.js` -> **2/2 PASS**.
  - `server/tests/security/reports-identity-source.test.js` -> **2/2 PASS**.
- Tipado:
  - `server`: `npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - P1 Reports (Contrato Status/Shape) (DONE)

#### Scope cerrado
- Se agrego suite de contrato para rutas criticas de `reports` enfocada en:
  - status codes esperados.
  - shape de respuesta estable (`success/data/message` o `error` segun caso).
- Cobertura incluida:
  - `PATCH /api/reports/:id` success + forbidden.
  - `POST /api/reports/:id/favorite` `already_exists`.
  - `POST /api/reports/:id/like` not found.

#### Beneficio tecnico concreto
- Previene regresiones silenciosas de contrato al endurecer internamente la capa transaccional.
- Reduce riesgo de rotura en frontend por cambios involuntarios de shape/estado HTTP.

#### Evidencia de validacion
- Test dedicado:
  - `server/tests/security/reports-contract-shape.test.js` -> **4/4 PASS**.
- Revalidacion bloque reports:
  - `server/tests/security/report-patch-transaction.test.js` -> **3/3 PASS**.
  - `server/tests/security/report-favorite-transaction.test.js` -> **3/3 PASS**.
  - `server/tests/security/report-like-transaction.test.js` -> **2/2 PASS**.
  - `server/tests/security/reports-identity-source.test.js` -> **2/2 PASS**.
- Tipado:
  - `server`: `npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - P1 Reports (FLAG Transaccional + Side-Effects Post-Commit) (DONE)

#### Scope cerrado
- Endpoint `POST /api/reports/:id/flag`:
  - verificacion de reporte + ownership guard + dedupe + insert de `report_flags` en `transactionWithRLS`.
  - verificacion de auto-hide (`reports.is_hidden`) dentro de la misma tx.
  - `emitReportDelete` en cola transaccional (`sse.emit`) para emitir solo post-commit.
  - `auditLog` ejecutado post-commit (no bloqueante).
  - contrato HTTP preservado (`400`, `403`, `404`, `200 already_exists`, `201`, `500`).

#### Beneficio tecnico concreto
- Elimina riesgo de side-effects (realtime/audit) si falla la transaccion de flag.
- Reduce estados parciales en flujo de moderacion por flag.
- Mantiene compatibilidad de contrato para clientes existentes.

#### Evidencia de validacion
- Test dedicado:
  - `server/tests/security/report-flag-transaction.test.js` -> **2/2 PASS**.
  - Cobertura:
    - exito (201 + side-effects post-commit).
    - falla intermedia (500 + cero side-effects).
- Revalidacion bloque reports:
  - `server/tests/security/report-patch-transaction.test.js` -> **3/3 PASS**.
  - `server/tests/security/report-favorite-transaction.test.js` -> **3/3 PASS**.
  - `server/tests/security/report-like-transaction.test.js` -> **2/2 PASS**.
  - `server/tests/security/reports-contract-shape.test.js` -> **7/7 PASS**.
- Tipado:
  - `server`: `npx tsc --noEmit` -> **PASS**.

---

### Post Semana 3 - P1 Reports (Extraccion Mutaciones por Lotes) (DONE)

#### Scope cerrado en este ciclo
- Se extrajeron a `server/src/routes/reports.mutations.js` (sin cambios funcionales):
  - `toggleFavorite`
  - `likeReport`
  - `unlikeReport`
  - `patchReport`
  - `flagReport`
  - `deleteReport`
  - `createReport`
  - `shareReport`
  - `uploadReportImages`
- `server/src/routes/reports.js` quedo como router/wiring para esas rutas.
- En `share` se corrigio el servicio usado para `notifyActivity`:
  - antes: `NotificationService` externo (sin metodo `notifyActivity`)
  - ahora: `AppNotificationService` (metodo correcto)

#### Contrato preservado
- Paths y orden de middlewares sin cambios.
- Status codes y shape JSON preservados.
- Side-effects mantenidos como fire-and-forget con `catch`.
- Sin cambios de schema ni de contratos API.

#### Evidencia de validacion
- `server/tests/security/reports-contract-shape.test.js` -> **7/7 PASS** (incluye `POST /api/reports/:id/share` y `POST /api/reports` 201/200 idempotent).
- `server/tests/security/report-favorite-transaction.test.js` -> **3/3 PASS**.
- `server/tests/security/report-like-transaction.test.js` -> **2/2 PASS**.
- `server`: `npx tsc --noEmit` -> **PASS**.

#### Estado
- **DONE**: write-paths de `reports` extraidos a `reports.mutations.js` con contratos preservados.
- `reports.js` queda como router/wiring para mutaciones de dominio.

### Estado Actual Consolidado (Post cierre bloque reports)

#### Verificacion operativa (sin push, gate local)
- `server/tests/security/reports-contract-shape.test.js` -> **PASS**
- `server/tests/security/report-favorite-transaction.test.js` -> **PASS**
- `server/tests/security/report-like-transaction.test.js` -> **PASS**
- `server`: `npx tsc --noEmit` -> **PASS**

#### Estado real de la app hoy
- `reports` queda en estado **estable y cerrable** para este ciclo: contratos preservados, mutaciones modularizadas y regresiones criticas cubiertas.
- `comments` en estado **cerrado P1** para flujos sensibles (`create/edit/like/flag/pin`).
- Pendientes de mayor riesgo fuera de `reports`: consolidacion operativa de secretos y reduccion de acoplamiento en `chats`.

### Post Semana 3 - P1 Chats (SEND pipeline determinista) (DONE)

#### Scope cerrado
- Endpoint `POST /api/chats/rooms/:roomId/messages`:
  - todos los writes se ejecutan en una unica `transactionWithRLS`.
  - respuesta HTTP (`201`) se mantiene sin cambios de contrato.
  - fan-out realtime (`emitUserChatUpdate`, `emitChatMessage`, `emitMessageDelivered`) se encola via `TransactionalSSE` dentro de la tx y se flushea solo post-commit.
  - push queue (`NotificationQueue.enqueue`) queda diferida fuera de tx y no bloquea el HTTP.

#### Beneficio tecnico concreto
- Se blinda el write-path critico de chat contra side-effects realtime antes de commit.
- Se mantiene latencia/contrato actual sin introducir cambios de schema.
- Se mejora trazabilidad del pipeline (`SEND_HTTP -> DB_INSERT -> OUTBOX_QUEUE_ENQUEUE`) y se agrega cobertura explicita de rollback sin efectos colaterales.

#### Evidencia de validacion
- `server/tests/security/chat-offline-push.test.js` -> **3/3 PASS** (incluye rollback sin side-effects).
- `server/tests/security/chat-membership.test.js` -> **11/11 PASS**.
- `server/tests/security/chat-ack-signature.test.js` -> **2/2 PASS**.
- `server`: `npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - P1 Chats (READ tx unica + side-effects post-commit) (DONE)

#### Scope cerrado
- Endpoint `POST /api/chats/rooms/:roomId/read`:
  - `SELECT DISTINCT sender_id` + `UPDATE is_read/is_delivered` unificados en `transactionWithRLS`.
  - side-effects realtime encolados con `sse.emit` dentro de la tx (flush post-commit).
  - contrato HTTP preservado (`200 { success, count }` / `500`).

#### Beneficio tecnico concreto
- Elimina drift de consistencia por uso de `queryWithRLS` separado en un flujo de ack critico.
- Reduce riesgo de efectos colaterales sobre estado no confirmado.
- Mantiene idempotencia del endpoint sin cambios funcionales visibles.

#### Evidencia de validacion
- Test dedicado nuevo:
  - `server/tests/security/chat-read-transaction.test.js` -> **2/2 PASS**.
  - cobertura: exito con side-effects + falla intermedia con rollback y cero side-effects.
- Revalidacion del bloque chat:
  - `server/tests/security/chat-offline-push.test.js` -> **3/3 PASS**.
  - `server/tests/security/chat-membership.test.js` -> **11/11 PASS**.
  - `server/tests/security/chat-ack-signature.test.js` -> **2/2 PASS**.
- Tipado:
  - `server`: `npx tsc --noEmit` -> **PASS**.

#### Smoke funcional manual (2 usuarios)
- B online: A envia mensaje y B recibe en tiempo real.
- B offline: A envia mensaje, se encola push y A mantiene `201`.

### Post Semana 3 - P1 Chats (REACTION con side-effects post-commit) (DONE)

#### Scope cerrado
- Endpoint `POST /api/chats/rooms/:roomId/messages/:messageId/react`:
  - read + write de `reactions` en `transactionWithRLS`.
  - evento realtime `message-reaction` encolado con `sse.emit` dentro de la tx.
  - contrato HTTP preservado (`200 { success, reactions, action }`, `404`, `500`).

#### Beneficio tecnico concreto
- Evita emitir `message-reaction` si la transaccion hace rollback.
- Mantiene consistencia entre estado persistido y estado realtime.

#### Evidencia de validacion
- `server/tests/security/chat-mutations-sql.test.js` -> **26/26 PASS** (incluye rollback sin side-effects para reaction).
- `server/tests/security/chat-membership.test.js` -> **11/11 PASS**.
- `server/tests/security/chat-offline-push.test.js` -> **3/3 PASS**.
- `server/tests/security/chat-read-transaction.test.js` -> **2/2 PASS**.
- `server/tests/security/chat-ack-signature.test.js` -> **2/2 PASS**.
- `server`: `npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - P1 Chats (Extraccion Mutaciones Lote 1) (DONE)

#### Scope cerrado
- Se extrajeron a `server/src/routes/chats.mutations.js` (sin cambios funcionales):
  - `POST /api/chats/rooms/:roomId/pin`
  - `DELETE /api/chats/rooms/:roomId/pin`
  - `POST /api/chats/rooms/:roomId/archive`
  - `DELETE /api/chats/rooms/:roomId/archive`
  - `PATCH /api/chats/rooms/:roomId/unread`
- `server/src/routes/chats.js` mantiene el mismo wiring/middleware para esas rutas y delega ejecución al módulo extraído.

#### Contrato preservado
- Mismos status codes y shape (`{ success: true }` / `500 { error: 'Internal server error' }`).
- Mismo orden funcional por endpoint: update DB -> `emitUserChatUpdate` -> response.
- Sin cambios de schema ni de contrato API.

#### Evidencia de validacion
- `server/tests/security/chat-membership.test.js` -> **11/11 PASS**.
- `server/tests/security/chat-offline-push.test.js` -> **2/2 PASS**.
- `server/tests/security/chat-ack-signature.test.js` -> **2/2 PASS**.
- `server/tests/security/chat-read-transaction.test.js` -> **2/2 PASS**.
- `server`: `npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - P1 Chats (Hotfixes de Contrato y UX no leidos) (DONE)

#### Scope cerrado
- `DELETE /api/chats/rooms/:roomId/pin` y `DELETE /api/chats/rooms/:roomId/archive`:
  - correccion de placeholders SQL en mutaciones extraidas (sin parametro fantasma `$1`).
- `PATCH /api/chats/rooms/:roomId/unread`:
  - compatibilidad de contrato `unread` (canónico frontend) + `isUnread` (legacy).
  - normalizacion para evitar `undefined` en RLS.
- Flujo WhatsApp de no leidos:
  - al abrir chat y ejecutar `POST /api/chats/rooms/:roomId/read`, backend limpia `is_manually_unread`.
  - cache frontend limpia `is_manually_unread` junto con `unread_count`.

#### Evidencia de validacion
- `server/tests/security/chat-mutations-sql.test.js` -> **5/5 PASS**.
- `server/tests/security/chat-read-transaction.test.js` -> **2/2 PASS**.
- `server/tests/security/chat-membership.test.js` -> **11/11 PASS**.
- `server`: `npx tsc --noEmit` -> **PASS**.
- `frontend`: `npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - P1 Chats (Extraccion Mutaciones Lote 2) (DONE)

#### Scope cerrado
- Se extrajeron adicionalmente a `server/src/routes/chats.mutations.js` (sin cambios funcionales):
  - `DELETE /api/chats/rooms/:roomId` (`deleteRoom`)
  - `DELETE /api/chats/rooms/:roomId/messages/:messageId` (`deleteRoomMessage`)
  - `PATCH /api/chats/rooms/:roomId/messages/:messageId` (`editRoomMessage`)
  - `PATCH /api/chats/rooms/:roomId/messages/:messageId/pin` (`pinRoomMessage`)
  - `DELETE /api/chats/rooms/:roomId/messages/:messageId/pin` (`unpinRoomMessage`)
  - `POST /api/chats/rooms/:roomId/messages/:messageId/star` (`starRoomMessage`)
  - `DELETE /api/chats/rooms/:roomId/messages/:messageId/star` (`unstarRoomMessage`)
- `server/src/routes/chats.js` conserva rutas + middlewares y delega ejecución.

#### Contrato preservado
- Status codes y shape JSON sin cambios.
- Mismos side-effects y semántica de negocio.
- Sin cambios de schema ni de rutas.

#### Evidencia de validacion
- `server/tests/security/chat-membership.test.js` -> **11/11 PASS**.
- `server/tests/security/chat-offline-push.test.js` -> **2/2 PASS**.
- `server/tests/security/chat-ack-signature.test.js` -> **2/2 PASS**.
- `server/tests/security/chat-mutations-sql.test.js` -> **5/5 PASS**.
- `server`: `npx tsc --noEmit` -> **PASS**.
- `frontend`: `npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - P1 Chats (Extraccion Mutaciones Lote 3) (DONE)

#### Scope cerrado
- Se extrajo adicionalmente a `server/src/routes/chats.mutations.js` (sin cambios funcionales):
  - `POST /api/chats/rooms/:roomId/messages` (`sendRoomMessage`)
- `server/src/routes/chats.js` conserva el mismo middleware (`requireRoomMembership`) y delega la ejecución al módulo de mutaciones.

#### Contrato preservado
- Mismo contrato HTTP del endpoint:
  - `201` con el mensaje persistido.
  - `400 { error: 'Content is required' }`.
  - `500 { error: 'Internal server error' }`.
- Misma semántica de pipeline:
  - write-path dentro de `transactionWithRLS`.
  - fan-out SSE + enqueue push solo post-commit (fire-and-forget).
- Sin cambios de schema ni de rutas.

#### Evidencia de validacion
- `server/tests/security/chat-mutations-sql.test.js` -> **5/5 PASS**.
- `server/tests/security/chat-read-transaction.test.js` -> **2/2 PASS**.
- `server/tests/security/chat-membership.test.js` -> **11/11 PASS**.
- `server`: `npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - P1 Chats (Extraccion Mutaciones Lote 4) (DONE)

#### Scope cerrado
- Se extrajo adicionalmente a `server/src/routes/chats.mutations.js` (sin cambios funcionales):
  - `POST /api/chats/rooms/:roomId/read` (`markRoomRead`)
- `server/src/routes/chats.js` mantiene misma ruta y mismo middleware (`requireRoomMembership`), delegando el handler al módulo de mutaciones.

#### Contrato preservado
- Mismo shape de respuesta: `{ success: true, count }`.
- Misma semántica de negocio:
  - actualización read/delivered en `chat_messages`.
  - limpieza de `is_manually_unread`.
  - side-effects post-commit (`emitMessageRead`, `emitUserChatUpdate`, `emitChatStatus`) sólo cuando corresponde.
- Sin cambios de schema ni de contratos API.

#### Evidencia de validacion
- `server/tests/security/chat-read-transaction.test.js` -> **2/2 PASS**.
- `server/tests/security/chat-mutations-sql.test.js` -> **5/5 PASS**.
- `server`: `npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - P1 Chats (Extraccion Mutaciones Lote 5) (DONE)

#### Scope cerrado
- Se extrajo adicionalmente a `server/src/routes/chats.mutations.js` (sin cambios funcionales):
  - `POST /api/chats/rooms/:roomId/delivered` (`markRoomDelivered`)
- `server/src/routes/chats.js` mantiene misma ruta y mismo middleware (`requireRoomMembership`), delegando el handler al módulo de mutaciones.

#### Contrato preservado
- Mismo shape de respuesta: `{ success: true, count }`.
- Misma semántica de negocio:
  - update transaccional de `is_delivered`.
  - emisión de side-effects post-update (`emitChatStatus('delivered')` + `emitMessageDelivered` por sender).
- Sin cambios de schema ni contratos API.

#### Evidencia de validacion
- `server/tests/security/chat-read-transaction.test.js` -> **2/2 PASS**.
- `server/tests/security/chat-mutations-sql.test.js` -> **5/5 PASS**.
- `server/tests/security/chat-membership.test.js` -> **11/11 PASS**.
- `server`: `npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - P1 Chats (Extraccion Mutaciones Lote 6) (DONE)

#### Scope cerrado
- Se extrajo adicionalmente a `server/src/routes/chats.mutations.js` (sin cambios funcionales):
  - `POST /api/chats/messages/:messageId/ack-delivered` (`ackDeliveredMessage`)
- `server/src/routes/chats.js` mantiene la misma ruta y delega al módulo de mutaciones.

#### Contrato preservado
- Mismos status y shape:
  - `400` -> `{ error: 'MessageId and X-Anonymous-Id are required' }`
  - `404` -> `{ error: 'Message not found or access denied' }`
  - `200` -> `{ success: true }`
  - `500` -> `{ error: 'Internal server error' }`
- Misma semántica:
  - tx con `transactionWithRLS`,
  - side-effects (`emitMessageDelivered`, `emitChatStatus`) solo cuando aplica,
  - telemetría `logChatAckFailure` y `CHAT_PIPELINE` intacta.

#### Evidencia de validacion
- `server/tests/security/chat-ack-signature.test.js` -> **2/2 PASS**.
- `server/tests/security/chat-membership.test.js` -> **11/11 PASS**.
- `server/tests/security/chat-read-transaction.test.js` -> **2/2 PASS**.
- `server`: `npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - P1 Chats (Extraccion Mutaciones Lote 7) (DONE)

#### Scope cerrado
- Se extrajo adicionalmente a `server/src/routes/chats.mutations.js` (sin cambios funcionales):
  - `POST /api/chats/rooms/:roomId/typing` (`emitTypingStatus`)
- `server/src/routes/chats.js` mantiene la misma ruta y middleware (`requireRoomMembership`), delegando al módulo de mutaciones.

#### Contrato preservado
- Mismo shape de respuesta: `{ success: true }` inmediata.
- Misma semántica:
  - emisión realtime a room (`emitChatStatus('typing')`) en camino crítico.
  - fan-out diferido a inbox (`emitUserChatUpdate`) con `queryWithRLS`.
  - falla diferida silenciosa (`console.warn`) preservada.
- Sin cambios de schema, rutas ni contrato API.

#### Evidencia de validacion
- `server/tests/security/chat-membership.test.js` -> **11/11 PASS**.
- `server/tests/security/chat-ack-signature.test.js` -> **2/2 PASS**.
- `server`: `npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - P1 Chats (Extraccion Mutaciones Lote 8) (DONE)

#### Scope cerrado
- Se extrajo adicionalmente a `server/src/routes/chats.mutations.js` (sin cambios funcionales):
  - `POST /api/chats/:roomId/images` (`uploadRoomImage`)
- `server/src/routes/chats.js` conserva el mismo wiring:
  - `imageUploadLimiter`, `requireAnonymousId`, `requireRoomMembership`, `upload.single('image')`.

#### Contrato preservado
- Mismo comportamiento y shape:
  - `400` -> `{ error: 'No image provided' }`
  - `403` -> `{ error: 'Forbidden: You are not a member of this conversation' }`
  - `500` -> `{ error: 'Storage service not configured' }` o `{ error: err.message || 'Internal server error' }`
  - `200` -> `{ success: true, url }`
- Misma integración con `supabaseAdmin.storage` y validación `validateImageBuffer`.

#### Evidencia de validacion
- `server/tests/security/chat-membership.test.js` -> **11/11 PASS**.
- `server/tests/security/chat-ack-signature.test.js` -> **2/2 PASS**.
- `server`: `npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - P1 Chats (Extraccion Mutaciones Lote 9) (DONE)

#### Scope cerrado
- Se extrajo adicionalmente a `server/src/routes/chats.mutations.js` (sin cambios funcionales):
  - `POST /api/chats/:roomId/messages/:messageId/react` (`toggleMessageReaction`)
- `server/src/routes/chats.js` mantiene misma ruta + middleware (`requireRoomMembership`) y delega la ejecución.

#### Contrato preservado
- Mismos status y shape:
  - `400` -> `{ error: 'emoji is required' }`
  - `404` -> `{ error: 'Message not found' }`
  - `200` -> `{ success: true, reactions, action }`
  - `500` -> `{ error: 'Internal server error' }`
- Misma semántica:
  - toggle único por usuario (remove de reacciones previas + add/remove objetivo),
  - persistencia en `chat_messages.reactions`,
  - SSE `emitChatStatus('message-reaction')` con estado completo.

#### Evidencia de validacion
- `server/tests/security/chat-membership.test.js` -> **11/11 PASS**.
- `server/tests/security/chat-mutations-sql.test.js` -> **5/5 PASS**.
- `server`: `npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - P1 Chats (Extraccion Mutaciones Lote 10) (DONE)

#### Scope cerrado
- Se extrajo adicionalmente a `server/src/routes/chats.mutations.js` (sin cambios funcionales):
  - `POST /api/chats/rooms` (`createRoom`)
- `server/src/routes/chats.js` mantiene ruta y contrato, delegando ejecución al módulo de mutaciones.

#### Contrato preservado
- Mismos status y shape:
  - `400` -> `{ error: 'Anonymous ID required' }` / `{ error: 'Cannot start a chat with yourself' }`
  - `404` -> `{ error: 'Report not found' }`
  - `201` -> `fullRoom` con metadata del otro participante.
  - `500` -> `{ error: 'Internal server error' }`
- Misma lógica de deduplicación de conversación existente y creación de miembros.
- Sin cambios de schema, rutas ni reglas de negocio.

#### Evidencia de validacion
- `server/tests/security/chat-membership.test.js` -> **11/11 PASS**.
- `server/tests/security/chat-mutations-sql.test.js` -> **5/5 PASS**.
- `server/tests/security/chat-offline-push.test.js` -> **2/2 PASS**.
- `server`: `npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - P1 Chats (Extraccion Mutaciones Lote 11) (DONE)

#### Scope cerrado
- Se extrajo adicionalmente a `server/src/routes/chats.mutations.js` (sin cambios funcionales):
  - `POST /api/chats/messages/reconcile-status` (`reconcileMessageStatus`)
- `server/src/routes/chats.js` conserva ruta y contrato, delegando ejecución.

#### Contrato preservado
- Mismos status y shape:
  - `400` -> `{ error: 'X-Anonymous-Id required' }`
  - `200` -> `{ success: true, results, summary }`
  - `500` -> `{ error: 'Internal server error' }`
- Misma semántica batch:
  - reconciliación `delivered` y `read`,
  - acumulación de `failed/already/reconciled`,
  - telemetría `logChatAckFailure` (`207` parcial) y `CHAT_PIPELINE`.
- Se preserva el mismo patrón de acceso DB actual del endpoint (`pool.query`).

#### Evidencia de validacion
- `server/tests/security/chat-membership.test.js` -> **11/11 PASS**.
- `server/tests/security/chat-ack-signature.test.js` -> **2/2 PASS**.
- `server/tests/security/chat-offline-push.test.js` -> **2/2 PASS**.
- `server`: `npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - P1 Chats (Extraccion Mutaciones Lote 12) (DONE)

#### Scope cerrado
- Se extrajo adicionalmente a `server/src/routes/chats.mutations.js` (sin cambios funcionales):
  - `GET /api/chats/starred` (`getStarredMessages`)
- `server/src/routes/chats.js` conserva ruta y delega al módulo de mutaciones.

#### Contrato preservado
- Mismo status/shape:
  - `200` -> array de mensajes destacados con `sender_alias`, `sender_avatar`, `conversation_id`.
  - `500` -> `{ error: 'Internal server error' }`.
- Misma query SQL y orden (`ORDER BY sm.created_at DESC`).

#### Evidencia de validacion
- `server/tests/security/chat-membership.test.js` -> **11/11 PASS**.
- `server/tests/security/chat-mutations-sql.test.js` -> **5/5 PASS**.
- `server`: `npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - P1 Chats (Extraccion Mutaciones Lote 13) (DONE)

#### Scope cerrado
- Se extrajo adicionalmente a `server/src/routes/chats.mutations.js` (sin cambios funcionales):
  - `GET /api/chats/rooms` (`getRooms`)
- `server/src/routes/chats.js` conserva la ruta y delega al módulo de mutaciones.

#### Contrato preservado
- Mismo comportamiento:
  - retorna lista de rooms con metadata + `unread_count`.
  - hidrata `is_online` vía `presenceTracker`.
  - límite de 20 y orden por `is_pinned` + `last_message_at`.
- Mismos status:
  - `401` si falta `anonymousId`.
  - `500` en error interno.
- Misma SQL de consulta y misma forma de respuesta.

#### Evidencia de validacion
- `server/tests/security/chat-membership.test.js` -> **11/11 PASS**.
- `server/tests/security/chat-offline-push.test.js` -> **2/2 PASS**.
- `server/tests/security/chat-ack-signature.test.js` -> **2/2 PASS**.
- `server`: `npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - P1 Chats (Extraccion Mutaciones Lote 14) (DONE)

#### Scope cerrado
- Se extrajo adicionalmente a `server/src/routes/chats.mutations.js` (sin cambios funcionales):
  - `GET /api/chats/rooms/:roomId/messages` (`getRoomMessages`)
- `server/src/routes/chats.js` mantiene ruta + middleware (`requireRoomMembership`) y delega la ejecución.

#### Contrato preservado
- Mismos status/shape:
  - `403` -> `{ error: 'Access denied: Not a member of this conversation' }`
  - `410` -> `{ error, code: 'REF_GONE', retry_strategy: 'full_resync' }` para gap inválido.
  - `200` -> array de mensajes con enriquecimiento (`reply_to_*`, `is_starred`).
  - `500` -> `{ error: 'Internal server error' }`
- Misma semántica:
  - gap recovery por `since`,
  - auto-mark delivered al leer historial,
  - emisión `emitMessageDelivered` para sincronizar ticks.

#### Evidencia de validacion
- `server/tests/security/chat-membership.test.js` -> **11/11 PASS**.
- `server/tests/security/chat-offline-push.test.js` -> **2/2 PASS**.
- `server/tests/security/chat-mutations-sql.test.js` -> **5/5 PASS**.
- `server`: `npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - P1 Chats (Extraccion Mutaciones Lote 15 - Router Puro) (DONE)

#### Scope cerrado
- `server/src/routes/chats.js` se normalizó a router puro:
  - rutas declaradas con handler directo (`router.get('/x', handler)`),
  - wrappers `async (req, res) => handler(req, res)` removidos.
- se removieron imports no usados del router (`queryWithRLS`, `transactionWithRLS`, `logError`, `logInfo`, `realtimeEvents`, `logChatAckFailure`).

#### Contrato preservado
- Sin cambios de rutas, middlewares, status codes ni shape de respuesta.
- Sin cambios de lógica de negocio (toda lógica permanece en `chats.mutations.js`).

#### Evidencia de validacion
- `server/tests/security/chat-membership.test.js` -> **11/11 PASS**.
- `server/tests/security/chat-offline-push.test.js` -> **2/2 PASS**.
- `server/tests/security/chat-ack-signature.test.js` -> **2/2 PASS**.
- `server`: `npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - P1 Chats (Hotfix UX Orden Inbox Nuevo Chat) (DONE)

#### Scope cerrado
- Ajuste puntual en `server/src/routes/chats.mutations.js` (`getRooms`) para priorizar conversaciones nuevas sin mensajes.

#### Root cause confirmado
- El orden de inbox y el campo `last_message_at` usaban solo `lm.created_at`/`c.last_message_at`.
- Conversaciones recién creadas podían quedar con ambos campos nulos y caer al final (orden efectivo por `NULL`/`0`).

#### Fix aplicado (mínimo)
- `last_message_at` ahora se calcula con fallback explícito:
  - `COALESCE(lm.created_at, c.last_message_at, c.created_at) as last_message_at`
- `ORDER BY` usa el mismo fallback:
  - `COALESCE(lm.created_at, c.last_message_at, c.created_at) DESC`

#### Evidencia de validación
- `server/tests/security/chat-membership.test.js` -> **11/11 PASS**.

### Post Semana 3 - P1 Chats (PIN/UNREAD transaccional homogéneo) (DONE)

- Endpoints estabilizados sin cambio de contrato:
  - `POST /api/chats/rooms/:roomId/pin`
  - `DELETE /api/chats/rooms/:roomId/pin`
  - `PATCH /api/chats/rooms/:roomId/unread`
- Ajuste aplicado en `server/src/routes/chats.mutations.js`:
  - write path movido a `transactionWithRLS` (tx única por request),
  - emisión realtime mantenida únicamente después del commit exitoso.
- Contrato preservado:
  - mismos `status codes`,
  - mismo shape de respuesta (`{ success: true }`),
  - mismo payload/eventId determinístico en `emitUserChatUpdate`.

**Gate**
- `server/tests/security/chat-mutations-sql.test.js` -> **5/5 PASS**.
- `server/tests/security/chat-membership.test.js` -> **11/11 PASS**.
- `cd server && npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - P1 Chats (ARCHIVE/UNARCHIVE transaccional homogéneo) (DONE)

- Endpoints estabilizados sin cambio de contrato:
  - `POST /api/chats/rooms/:roomId/archive`
  - `DELETE /api/chats/rooms/:roomId/archive`
- Ajuste aplicado en `server/src/routes/chats.mutations.js`:
  - write path normalizado a `transactionWithRLS`,
  - emisión realtime preservada y ejecutada post-commit.
- Contrato preservado:
  - mismos status codes y mismas respuestas JSON (`{ success: true }`),
  - mismo payload de `emitUserChatUpdate` (`action: 'archive'`).

**Gate**
- `server/tests/security/chat-mutations-sql.test.js` -> **6/6 PASS**.
- `server/tests/security/chat-membership.test.js` -> **11/11 PASS**.
- `cd server && npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - P1 Chats (DELETE ROOM transaccional homogéneo) (DONE)

- Endpoint estabilizado sin cambio de contrato:
  - `DELETE /api/chats/:roomId`
- Ajuste aplicado en `server/src/routes/chats.mutations.js`:
  - write path migrado a `transactionWithRLS`,
  - emisión realtime (`action: 'delete'`) preservada post-commit.
- Contrato preservado:
  - misma respuesta JSON (`{ success: true }`),
  - mismo `eventId` determinístico (`delete:${roomId}:${anonymousId}`).

**Gate**
- `server/tests/security/chat-mutations-sql.test.js` -> **7/7 PASS**.
- `server/tests/security/chat-membership.test.js` -> **11/11 PASS**.
- `cd server && npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - P1 Chats (DELETE MESSAGE transaccional + side-effects post-commit) (DONE)

- Endpoint estabilizado sin cambio de contrato:
  - `DELETE /api/chats/rooms/:roomId/messages/:messageId`
- Ajuste aplicado en `server/src/routes/chats.mutations.js`:
  - validación de ownership + delete + readback de miembros bajo `transactionWithRLS`,
  - side-effects realtime ejecutados exclusivamente post-commit.
- Contrato preservado:
  - `404` -> `{ error: 'Message not found' }`
  - `403` -> `{ error: 'Forbidden: You can only delete your own messages' }`
  - `200` -> `{ success: true }`
  - mismo payload realtime (`action: 'message-deleted'` + `eventId` determinístico).

**Gate**
- `server/tests/security/chat-mutations-sql.test.js` -> **9/9 PASS**.
- `server/tests/security/chat-membership.test.js` -> **11/11 PASS**.
- `cd server && npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - P1 Chats (EDIT MESSAGE transaccional + broadcast post-commit) (DONE)

- Endpoint estabilizado sin cambio de contrato:
  - `PATCH /api/chats/rooms/:roomId/messages/:messageId`
- Ajuste aplicado en `server/src/routes/chats.mutations.js`:
  - ownership/type/window check + update bajo `transactionWithRLS`,
  - `realtimeEvents.broadcast` ejecutado exclusivamente post-commit.
- Contrato preservado:
  - `401` -> `{ error: 'Anonymous ID required' }`
  - `400` -> `{ error: 'Content is required' }` / `{ error: 'Only text messages can be edited' }` / `{ error: 'Message can only be edited within 24 hours' }`
  - `403` -> `{ error: 'You can only edit your own messages' }`
  - `404` -> `{ error: 'Message not found' }`
  - `200` -> `{ success: true, message: <updatedMessage> }`

**Gate**
- `server/tests/security/chat-mutations-sql.test.js` -> **11/11 PASS**.
- `server/tests/security/chat-membership.test.js` -> **11/11 PASS**.
- `cd server && npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - P1 Chats (PIN/UNPIN MESSAGE transaccional + side-effects post-commit) (DONE)

- Endpoints estabilizados sin cambio de contrato:
  - `PATCH /api/chats/rooms/:roomId/messages/:messageId/pin`
  - `DELETE /api/chats/rooms/:roomId/messages/:messageId/pin`
- Ajuste aplicado en `server/src/routes/chats.mutations.js`:
  - validación + update bajo `transactionWithRLS`,
  - `emitChatStatus('message-pinned', ...)` mantenido y ejecutado post-commit.
- Contrato preservado:
  - `404` pin -> `{ error: 'Message not found in this conversation' }`
  - `200` pin -> `{ success: true, pinnedMessageId: <id> }`
  - `200` unpin -> `{ success: true, pinnedMessageId: null }`

**Gate**
- `server/tests/security/chat-mutations-sql.test.js` -> **14/14 PASS**.
- `server/tests/security/chat-membership.test.js` -> **11/11 PASS**.
- `cd server && npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - P1 Chats (STAR/UNSTAR MESSAGE transaccional) (DONE)

- Endpoints estabilizados sin cambio de contrato:
  - `POST /api/chats/rooms/:roomId/messages/:messageId/star`
  - `DELETE /api/chats/rooms/:roomId/messages/:messageId/star`
- Ajuste aplicado en `server/src/routes/chats.mutations.js`:
  - validación de acceso + insert/delete bajo `transactionWithRLS`,
  - sin side-effects adicionales (comportamiento preservado).
- Contrato preservado:
  - `404` star -> `{ error: 'Message not found or access denied' }`
  - `200` star -> `{ success: true, starred: true }`
  - `200` unstar -> `{ success: true, starred: false }`

**Gate**
- `server/tests/security/chat-mutations-sql.test.js` -> **17/17 PASS**.
- `server/tests/security/chat-membership.test.js` -> **11/11 PASS**.
- `cd server && npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - P1 Chats (CREATE ROOM transaccional homogéneo) (DONE)

- Endpoint estabilizado sin cambio de contrato:
  - `POST /api/chats/rooms`
- Ajuste aplicado en `server/src/routes/chats.mutations.js`:
  - report lookup, dedupe de conversación, create members y readback final bajo `transactionWithRLS`,
  - sin side-effects adicionales (comportamiento preservado).
- Contrato preservado:
  - `400` -> `{ error: 'Anonymous ID required' }` / `{ error: 'Cannot start a chat with yourself' }`
  - `404` -> `{ error: 'Report not found' }`
  - `201` -> `room` con shape previo (incluye `unread_count`, metadata de participante y reporte).

**Gate**
- `server/tests/security/chat-mutations-sql.test.js` -> **19/19 PASS**.
- `server/tests/security/chat-membership.test.js` -> **11/11 PASS**.
- `cd server && npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - P1 Chats (TOGGLE REACTION transaccional + side-effects post-commit) (DONE)

- Endpoint estabilizado sin cambio de contrato:
  - `POST /api/chats/:roomId/messages/:messageId/react`
- Ajuste aplicado en `server/src/routes/chats.mutations.js`:
  - `SELECT reactions` + `UPDATE reactions` bajo `transactionWithRLS`,
  - `emitChatStatus('message-reaction', ...)` preservado y ejecutado post-commit.
- Contrato preservado:
  - `400` -> `{ error: 'emoji is required' }`
  - `404` -> `{ error: 'Message not found' }`
  - `200` -> `{ success: true, reactions, action }`

**Gate**
- `server/tests/security/chat-mutations-sql.test.js` -> **21/21 PASS**.
- `server/tests/security/chat-membership.test.js` -> **11/11 PASS**.
- `cd server && npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - P1 Chats (RECONCILE STATUS transaccional por mensaje) (DONE)

- Endpoint estabilizado sin cambio de contrato:
  - `POST /api/chats/messages/reconcile-status`
- Ajuste aplicado en `server/src/routes/chats.mutations.js`:
  - eliminación de `pool.query` directo,
  - reconciliación `delivered/read` bajo `transactionWithRLS` por mensaje (mantiene semántica de éxito parcial),
  - emisiones `emitMessageDelivered/emitMessageRead` preservadas post-commit por ítem reconciliado.
- Contrato preservado:
  - `400` -> `{ error: 'X-Anonymous-Id required' }`
  - `200` -> `{ success: true, results, summary }` con estructura previa.
  - logging parcial `207` (métrica) se mantiene cuando hay fallos por ítem.

**Gate**
- `server/tests/security/chat-mutations-sql.test.js` -> **23/23 PASS**.
- `server/tests/security/chat-membership.test.js` -> **11/11 PASS**.
- `cd server && npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - P1 Chats (GET ROOM MESSAGES sin mezcla de driver en auto-delivered) (DONE)

- Endpoint estabilizado sin cambio de contrato:
  - `GET /api/chats/:roomId/messages`
- Ajuste aplicado en `server/src/routes/chats.mutations.js`:
  - se elimina `pool.query` directo para marcado automático `is_delivered`,
  - el update pasa a `transactionWithRLS` (mismo comportamiento funcional),
  - emisión `emitMessageDelivered` preservada.
- Contrato preservado:
  - mismo shape de lista de mensajes,
  - misma semántica de gap-recovery (`410 REF_GONE` cuando aplica),
  - mismo auto-mark delivered para mensajes recibidos.

**Gate**
- `server/tests/security/chat-mutations-sql.test.js` -> **25/25 PASS**.
- `server/tests/security/chat-membership.test.js` -> **11/11 PASS**.
- `cd server && npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - Cierre P1 Consistencia Transaccional Chat (DONE)

- Estado final del dominio `chat`:
  - write-paths críticos normalizados a `transactionWithRLS`,
  - side-effects realtime en mutaciones ejecutados post-commit,
  - sin cambios de contrato público en rutas/shape/status.
- Verificación de drift de driver:
  - no quedan writes críticos en `chats.mutations.js` usando `pool.query` directo,
  - `queryWithRLS` restante en chat corresponde a lecturas/membership (`typing`, `upload image`, `getStarred`, `getRooms`, `getRoomMessages`).

**Resultado**
- Riesgo de estados parciales y race conditions en mutaciones chat reducido a nivel operativo.

### Post Semana 3 - P1 Comments (PATCH transaccional homogéneo) (DONE)

- Endpoint estabilizado sin cambio de contrato:
  - `PATCH /api/comments/:id`
- Ajuste aplicado en `server/src/routes/comments.js`:
  - ownership check + update/readback unificados en `transactionWithRLS`,
  - se preservan mensajes de error y semántica (`404` not found, `403` forbidden, `200` success).
  - hotfix de contrato: PATCH devuelve `is_author` (join a `reports`) para no perder badge de autor en UI tras editar.
- Contrato preservado:
  - `200` -> `{ success: true, data, message: 'Comment updated successfully' }`
  - `404` -> `Comment not found`
  - `403` -> `You do not have permission to edit this comment`

**Gate**
- `server/tests/security/comment-edit-transaction.test.js` -> **2/2 PASS**.
- `server/tests/security/comment-pin-transaction.test.js` -> **2/2 PASS**.
- `server/tests/security/comment-like-transaction.test.js` -> **4/4 PASS**.
- `cd server && npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - P1 Comments (DELETE idempotente sin side-effects duplicados) (DONE)

- Endpoint estabilizado sin cambio de contrato:
  - `DELETE /api/comments/:id`
- Ajuste aplicado en `server/src/routes/comments.js`:
  - se conserva `executeUserAction` (tx governance),
  - realtime (`emitCommentDelete`) y `auditLog` solo cuando `rowCount > 0 && !idempotent`,
  - en delete idempotente mantiene `200 success` pero evita re-emisión/re-auditoría duplicada.

**Gate**
- `server/tests/security/comment-delete-idempotency.test.js` -> **2/2 PASS**.
- `server/tests/security/comment-edit-transaction.test.js` -> **2/2 PASS**.
- `server/tests/security/comment-pin-transaction.test.js` -> **2/2 PASS**.
- `server/tests/security/comment-like-transaction.test.js` -> **4/4 PASS**.
- `cd server && npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - Cierre Operativo Comments (DONE)

- Estado final del dominio `comments`:
  - router reducido y mutaciones extraidas a `server/src/routes/comments.mutations.js`,
  - write-paths sensibles cerrados bajo transaccion y side-effects post-commit,
  - contratos API preservados (`status`, `shape`, mensajes) sin cambios breaking.
- Checklist formal de deploy/smoke consolidado:
  - `docs/observability/deploy-checklist-comments-p1-cierre.md`

### Post Semana 3 - P1 Realtime (Catchup dedupe por eventId) (DONE)

- Endpoint estabilizado sin cambio de contrato:
  - `GET /api/realtime/catchup`
- Ajuste aplicado en `server/src/routes/realtime.js`:
  - deduplicación server-side por `eventId` antes de responder catchup,
  - evita replay doble del mismo `message.delivered` cuando el evento aparece por múltiples fuentes (messages + delivery acks).
- Contrato preservado:
  - mismo shape de evento (`eventId`, `serverTimestamp`, `type`, `payload`, `isReplay`),
  - misma semántica de catchup (solo sin duplicados).

**Gate**
- `server/tests/security/realtime-catchup-delivery-consistency.test.js` -> **2/2 PASS** (incluye no-duplicación).
- `cd server && npx tsc --noEmit` -> **PASS**.
- `server`: `npx tsc --noEmit` -> **PASS**.

### Post Semana 3 - P2 Frontend (Boundary API en Notificaciones) (DONE)

- Alcance:
  - `src/pages/NotificationsPage.tsx`
  - `src/hooks/queries/useNotificationsQuery.ts`
  - `src/components/notifications/NotificationItem.tsx`
- Cambio aplicado (sin cambio funcional):
  - se eliminó import runtime directo de `@/lib/api` en `NotificationsPage` para delete diferido;
  - se incorporó `useDeleteNotificationMutation` en hook de queries para centralizar acceso API;
  - `NotificationItem` pasó a `import type` para `Notification` (sin import runtime).
- Beneficio real:
  - cumple boundary enterprise UI -> hooks/mutations (sin bypass de capa de datos),
  - reduce riesgo de drift de cache/credenciales al centralizar mutaciones en React Query,
  - mantiene contrato y comportamiento visual/funcional intactos.

**Gate**
- `npx tsc --noEmit` (root) -> **PASS**.

---

## 🔟 Score Final

### Score 1–10 por categoría
- Arquitectura: **8.0**
- Performance: **7.2**
- Seguridad: **7.6**
- Escalabilidad: **7.0**
- UX Técnica: **7.4**
- Mantenibilidad: **7.8**

### Nivel real del proyecto
**Scale-Ready alto**.

### Recomendación estratégica
- **Tocar primero**:
  1. Reducir acoplamiento en `chats` (modularización interna de `chats.mutations.js`) manteniendo contratos actuales.
  2. Mantener hardening operativo de secretos (rotación continua, evidencia periódica y drill de recuperación).
  3. Normalizar reconciliación realtime/frontend en dominios no cerrados para evitar drift de estado en cache.
- **No tocar ahora**:
  1. Rewrites cosméticos de UI.
  2. Sobreingeniería de microservicios antes de cerrar seguridad/consistencia.
  3. Refactors masivos sin métricas de regresión.

---

## Evidencia técnica mínima usada
- `server/src/index.js:219`
- `server/src/index.js:374`
- `server/src/index.js:437`
- `server/src/routes/realtime.js`
- `server/tests/security/realtime-authz.test.js`
- `server/tests/security/realtime-catchup-delivery-consistency.test.js`
- `server/src/routes/auth.js`
- `server/tests/security/env-validation.test.js`
- `server/src/routes/comments.js`
- `server/src/routes/comments.mutations.js`
- `server/src/routes/reports.js`
- `server/src/routes/reports.mutations.js`
- `server/src/routes/chats.js`
- `server/src/routes/chats.mutations.js`
- `src/components/layout/Header.tsx`
- `src/components/chat/ChatWindow.tsx`
- `src/pages/NotificationsPage.tsx`
- `src/pages/Mensajes.tsx`
- `src/hooks/useGlobalRealtime.ts`


