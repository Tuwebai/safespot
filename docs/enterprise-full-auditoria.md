# 🏛️ AUDITORÍA ENTERPRISE COMPLETA

## 1️⃣ Executive Summary

### Estado real del proyecto
El proyecto está en estado **Scale-Ready parcial**: tiene bases enterprise valiosas (RLS helper, SSE, audit service, React Query, chunking manual), pero todavía mantiene riesgos de **seguridad crítica**, **acoplamiento alto** y **consistencia incompleta** entre capas.

### Score por categoría
- Arquitectura: **6.0/10**
- Performance: **6.5/10**
- Seguridad: **4.0/10**
- Escalabilidad: **5.5/10**
- UX Técnica: **6.5/10**
- Mantenibilidad: **5.0/10**

### Nivel real
**Scale-Ready (no Enterprise-Grade)**.

### Top 5 riesgos críticos
1. **Gestión de secretos sin evidencia de vault/rotación** (`server/.env:1`): credenciales sensibles presentes en archivo local de entorno. Riesgo operativo alto si el host o backups quedan expuestos.
2. **Canales realtime con autorización incompleta** (`server/src/routes/realtime.js:470`, `server/src/routes/realtime.js:608`, `server/src/routes/realtime.js:312`): posible lectura no autorizada de eventos/estados de terceros. **[CORREGIDO]**
3. **Catchup con fuga de metadatos globales** (`server/src/routes/realtime.js:88`): `comment-delete` no filtra por membresía/visibilidad. **[CORREGIDO]**
4. **Rutas monolíticas con alto acoplamiento** (`server/src/routes/reports.js`, `server/src/routes/chats.js`, `server/src/routes/comments.js`): eleva riesgo de regresiones por cambios locales.
5. **Drift de capas y contratos** (mix de `queryWithRLS`, `supabase.from`, `pool.query` en mismas rutas, p.ej. `server/src/routes/comments.js:283`, `server/src/routes/comments.js:1123`, `server/src/routes/chats.js:326`, `server/src/routes/chats.js:1419`): rompe predictibilidad transaccional y aumenta bugs de concurrencia.

### Estado de hallazgos reportados (actualizado)
| Hallazgo original | Estado | Evidencia |
|---|---|---|
| AuthZ incompleto en `/api/realtime/user/:id`, `/api/realtime/chats/:roomId`, `/api/realtime/catchup` | **CORREGIDO** | `server/src/routes/realtime.js` + `tests/security/realtime-authz.test.js` en verde |
| Catchup con fuga de metadatos globales | **CORREGIDO** | Filtros de visibilidad/membresía en `catchup` (`server/src/routes/realtime.js`) + suite seguridad |
| Contratos 4xx/5xx inconsistentes en auth/realtime | **CORREGIDO** | `docs/observability/auth-realtime-error-matrix.md` + `tests/security/auth-realtime-error-contract.test.js` |
| Hardening de secretos (arranque inseguro) | **CORREGIDO PARCIAL** | `server/src/utils/env.js` + `tests/security/env-validation.test.js` (pendiente: operación continua de rotación) |
| Deriva transaccional en comments (like/flag/pin/create/edit) | **CORREGIDO** | Secciones `Post Semana 3 - P1 Consistencia Transaccional Comments (...) (DONE)` |
| Bug `/reportes` favoritos (mostraba no favoritos) | **CORREGIDO** | `server/src/routes/reports.js` (`favorites_only` con `EXISTS` + `1=0` sin identidad), `src/lib/cache-helpers.ts` (`matchesFilters`) |
| Drift de identidad en `is_liked/is_favorite` de reports | **CORREGIDO** | `server/tests/security/reports-identity-source.test.js` (**2/2 PASS**) |
| Flicker de like en reports por patch parcial | **CORREGIDO (defensa cache)** | `src/lib/cache-helpers.ts` + `src/lib/cache-helpers.report-like.test.ts` (**1/1 PASS**) |

---

## 2️⃣ Arquitectura

### Análisis de separación de responsabilidades
- **Fortaleza**: existe intención de capas (routes/services/utils + hooks/query client).
- **Debilidad**: capa de transporte, dominio y persistencia están mezcladas en archivos gigantes:
  - `server/src/routes/reports.js` (1825 líneas)
  - `server/src/routes/chats.js` (1530 líneas)
  - `server/src/routes/comments.js` (1149 líneas)
  - `src/lib/api.ts` (1400 líneas)
- **Riesgo real**: cambios locales generan efectos laterales sistémicos y regresiones silenciosas.

### Acoplamientos peligrosos
- UI consumiendo API runtime desde componentes/páginas:
  - `src/components/layout/Header.tsx:53`
  - `src/pages/NotificationsPage.tsx:111`
  - `src/components/chat/ChatWindow.tsx:729`
  - `src/pages/Mensajes.tsx:239`
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
- En `auth`, errores de validación/autorización terminan como 500 genérico (`server/src/routes/auth.js:228`, `server/src/routes/auth.js:274`, `server/src/routes/auth.js:328`, `server/src/routes/auth.js:361`).

### Validación
- Hay middleware y Zod/Joi en partes.
- Inconsistencia: validación manual + supabase checks + validadores custom mezclados dentro de handlers.

### Manejo de errores
- Existe `AppError` y middleware global.
- Varios handlers saltan ese estándar y devuelven 500 genérico aunque el error es 4xx.

### Idempotencia
- Bien implementada en varios puntos (`ON CONFLICT DO NOTHING` y manejo de `23505`).
- Incompleta en flujos chat/realtime con updates separados fuera de transacción.

### Concurrencia
- `transactionWithRLS` es buen paso.
- Se degrada al mezclar con `pool.query` fuera del mismo contexto transaccional (`server/src/routes/chats.js:326`, `server/src/routes/chats.js:1419`, `server/src/routes/chats.js:1442`).

### Transacciones
- Patrón transaccional existe, pero no es el camino único.
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
    - `tests/security/auth-realtime-error-contract.test.js`
    - `tests/security/realtime-authz.test.js`
- Hardening de secretos y arranque seguro:
  - Validador centralizado: `server/src/utils/env.js`.
  - Hard-fail de secretos críticos en API + Worker.
  - `JWT_SECRET` sin fallback inseguro fuera de `test`.
  - Push condicionado por feature flag (`ENABLE_PUSH_NOTIFICATIONS`).
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

#### Estado PENDING (scope tecnico)
- No hay pendientes tecnicos de Semana 3 en DB hardening.

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
- Siguiente objetivo de consistencia: endpoints `comments` restantes + `reports` (fuera de este cambio).

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

### Post Semana 3 - P1 Reports (Favoritos + Identidad + Like Flicker) (DONE PARCIAL)

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
- **PENDIENTE (siguiente bloque P1 de reports, sin regresiones):**
  - extraer modulo de mutaciones `reports` para reducir acoplamiento sin cambiar contratos.

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

---

## 🔟 Score Final

### Score 1–10 por categoría
- Arquitectura: **6.0**
- Performance: **6.5**
- Seguridad: **4.0**
- Escalabilidad: **5.5**
- UX Técnica: **6.5**
- Mantenibilidad: **5.0**

### Nivel real del proyecto
**Scale-Ready parcial**.

### Recomendación estratégica
- **Tocar primero**:
  1. Consolidar tests de contrato `reports` (status + shape) para blindaje anti-regresión.
  2. Normalización de capa de datos frontend para evitar drift residual en reconciliaciones realtime.
  3. Reducir acoplamiento en rutas monolíticas (extracción incremental por dominio).
- **No tocar ahora**:
  1. Rewrites cosméticos de UI.
  2. Sobreingeniería de microservicios antes de cerrar seguridad/consistencia.
  3. Refactors masivos sin métricas de regresión.

---

## Evidencia técnica mínima usada
- `server/src/index.js:219`
- `server/src/index.js:374`
- `server/src/index.js:437`
- `server/src/routes/realtime.js:36`
- `server/src/routes/realtime.js:88`
- `server/src/routes/realtime.js:312`
- `server/src/routes/realtime.js:470`
- `server/src/routes/realtime.js:608`
- `server/src/middleware/auth.js:4`
- `server/src/routes/auth.js:56`
- `server/src/routes/auth.js:228`
- `server/src/routes/comments.js:283`
- `server/src/routes/comments.js:576`
- `server/src/routes/comments.js:1123`
- `server/src/routes/chats.js:326`
- `server/src/routes/chats.js:1419`
- `src/components/layout/Header.tsx:53`
- `src/components/chat/ChatWindow.tsx:729`
- `src/pages/NotificationsPage.tsx:111`
- `src/pages/Mensajes.tsx:239`
- `src/App.tsx:63`
- `src/App.tsx:198`
- `src/main.tsx:70`
- `src/main.tsx:90`
- `src/hooks/useGlobalRealtime.ts:60`


