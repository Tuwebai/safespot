# ðŸ›ï¸ AUDITORÃA ENTERPRISE COMPLETA

## 1ï¸âƒ£ Executive Summary

### Estado real del proyecto
El proyecto estÃ¡ en estado **Scale-Ready parcial**: tiene bases enterprise valiosas (RLS helper, SSE, audit service, React Query, chunking manual), pero todavÃ­a mantiene riesgos de **seguridad crÃ­tica**, **acoplamiento alto** y **consistencia incompleta** entre capas.

### Score por categorÃ­a
- Arquitectura: **6.0/10**
- Performance: **6.5/10**
- Seguridad: **4.0/10**
- Escalabilidad: **5.5/10**
- UX TÃ©cnica: **6.5/10**
- Mantenibilidad: **5.0/10**

### Nivel real
**Scale-Ready (no Enterprise-Grade)**.

### Top 5 riesgos crÃ­ticos
1. **GestiÃ³n de secretos sin evidencia de vault/rotaciÃ³n** (`server/.env:1`): credenciales sensibles presentes en archivo local de entorno. Riesgo operativo alto si el host o backups quedan expuestos.
2. **Canales realtime con autorizaciÃ³n incompleta** (`server/src/routes/realtime.js:470`, `server/src/routes/realtime.js:608`, `server/src/routes/realtime.js:312`): posible lectura no autorizada de eventos/estados de terceros.
3. **Catchup con fuga de metadatos globales** (`server/src/routes/realtime.js:88`): `comment-delete` no filtra por membresÃ­a/visibilidad.
4. **Fallback inseguro de JWT secret** (`server/src/middleware/auth.js:4`, `server/src/routes/auth.js:56`): permite tokens vÃ¡lidos con secreto por defecto si hay mala configuraciÃ³n.
5. **Drift de capas y contratos** (mix de `queryWithRLS`, `supabase.from`, `pool.query` en mismas rutas, p.ej. `server/src/routes/comments.js:283`, `server/src/routes/comments.js:1123`, `server/src/routes/chats.js:326`, `server/src/routes/chats.js:1419`): rompe predictibilidad transaccional y aumenta bugs de concurrencia.

---

## 2ï¸âƒ£ Arquitectura

### AnÃ¡lisis de separaciÃ³n de responsabilidades
- **Fortaleza**: existe intenciÃ³n de capas (routes/services/utils + hooks/query client).
- **Debilidad**: capa de transporte, dominio y persistencia estÃ¡n mezcladas en archivos gigantes:
  - `server/src/routes/reports.js` (1825 lÃ­neas)
  - `server/src/routes/chats.js` (1530 lÃ­neas)
  - `server/src/routes/comments.js` (1149 lÃ­neas)
  - `src/lib/api.ts` (1400 lÃ­neas)
- **Riesgo real**: cambios locales generan efectos laterales sistÃ©micos y regresiones silenciosas.

### Acoplamientos peligrosos
- UI consumiendo API runtime desde componentes/pÃ¡ginas:
  - `src/components/layout/Header.tsx:53`
  - `src/pages/NotificationsPage.tsx:111`
  - `src/components/chat/ChatWindow.tsx:729`
  - `src/pages/Mensajes.tsx:239`
- DuplicaciÃ³n de rutas/registro ambiguo:
  - `app.use('/api/diagnostics', ...)` duplicado en `server/src/index.js:374` y `server/src/index.js:437`.

### Violaciones SOLID
- **SRP**: rutas con mÃºltiples responsabilidades (validaciÃ³n, lÃ³gica negocio, persistencia, realtime, notificaciones, audit).
- **OCP**: cambios de feature obligan tocar bloques centrales masivos.
- **DIP**: handlers dependen de implementaciones concretas (`pool`, `supabase`, `queryWithRLS`) en lugar de puertos de dominio.

### Problemas de modularidad
- Ausencia de bounded contexts claros en backend (reporting/chat/auth/realtime cruzados por utilidades globales).
- `src/App.tsx` mantiene imports eager de mÃºltiples pÃ¡ginas de contenido (`src/App.tsx:63` a `src/App.tsx:74`), afectando modularidad de carga.

### CÃ³mo deberÃ­a verse en versiÃ³n enterprise
- `Presentation` -> `Application Services` -> `Domain` -> `Infrastructure`.
- Handlers HTTP finos (parse/validate/map), servicios de dominio con transacciones explÃ­citas y repositorios por agregado.
- Realtime como proyecciÃ³n de eventos autorizados, no como bypass de autorizaciÃ³n.

### Diagrama textual antes / despuÃ©s
**Antes**
`Route gigante -> SQL directo + Supabase + RLS helper + SSE + notificaciones + logs + reglas de negocio`

**DespuÃ©s**
`Route -> Input DTO + AuthZ -> UseCase -> Repository (Tx) -> Domain Event -> Outbox -> SSE/Push Worker`

---

## 3ï¸âƒ£ Backend

### AnÃ¡lisis de rutas
- Cobertura funcional alta y endpoints ricos.
- Problema: heterogeneidad de estilos y contratos de error.
- En `auth`, errores de validaciÃ³n/autorizaciÃ³n terminan como 500 genÃ©rico (`server/src/routes/auth.js:228`, `server/src/routes/auth.js:274`, `server/src/routes/auth.js:328`, `server/src/routes/auth.js:361`).

### ValidaciÃ³n
- Hay middleware y Zod/Joi en partes.
- Inconsistencia: validaciÃ³n manual + supabase checks + validadores custom mezclados dentro de handlers.

### Manejo de errores
- Existe `AppError` y middleware global.
- Varios handlers saltan ese estÃ¡ndar y devuelven 500 genÃ©rico aunque el error es 4xx.

### Idempotencia
- Bien implementada en varios puntos (`ON CONFLICT DO NOTHING` y manejo de `23505`).
- Incompleta en flujos chat/realtime con updates separados fuera de transacciÃ³n.

### Concurrencia
- `transactionWithRLS` es buen paso.
- Se degrada al mezclar con `pool.query` fuera del mismo contexto transaccional (`server/src/routes/chats.js:326`, `server/src/routes/chats.js:1419`, `server/src/routes/chats.js:1442`).

### Transacciones
- PatrÃ³n transaccional existe, pero no es el camino Ãºnico.
- Resultado: posibilidad de estado parcial (DB ok + SSE fallido o viceversa) en algunos paths.

### Versionado de API
- Hay headers de versiÃ³n (`X-API-Version`, `X-Min-Client-Version`) en `server/src/index.js`.
- Falta versionado formal (`/v1`, `/v2`) para contratos breaking.

### QuÃ© estÃ¡ bien
- `transactionWithRLS` y cola de SSE post-commit (`server/src/utils/rls.js`).
- Estrategia de realtime enriquecida y dedupe.
- IntegraciÃ³n de auditorÃ­a estructurada (`server/src/services/auditService.js`).

### QuÃ© estÃ¡ mal
- Secreto JWT por defecto.
- Endpoints realtime con AuthZ insuficiente.
- Mezcla de drivers/patrones de persistencia.
- Contrato de errores inconsistente en auth.

### Refactor propuesto con ejemplos de cÃ³digo

```js
// âŒ CÃ³digo actual
// server/src/routes/realtime.js
router.get('/user/:anonymousId', (req, res) => {
  const { anonymousId } = req.params;
  // ...suscribe sin verificar que req.user.anonymous_id === anonymousId
});
```

```js
// âœ… VersiÃ³n Enterprise propuesta
router.get('/user/:anonymousId', requireAuthenticatedUser, async (req, res, next) => {
  const { anonymousId } = req.params;
  if (req.user.anonymous_id !== anonymousId && req.user.role !== 'admin') {
    return next(new ForbiddenError('Forbidden realtime channel'));
  }
  return attachUserStream({ req, res, anonymousId });
});
```

```js
// âŒ CÃ³digo actual
// server/src/routes/auth.js
} catch (err) {
  logError(err, req);
  res.status(500).json({ error: 'Error del servidor' });
}
```

```js
// âœ… VersiÃ³n Enterprise propuesta
} catch (err) {
  return next(err); // delega a AppError middleware y conserva status/cÃ³digo
}
```

```js
// âŒ CÃ³digo actual
// server/src/middleware/auth.js
const JWT_SECRET = process.env.JWT_SECRET || 'safespot-secret-key-change-me';
```

```js
// âœ… VersiÃ³n Enterprise propuesta
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required');
}
const JWT_SECRET = process.env.JWT_SECRET;
```

---

## 4ï¸âƒ£ Base de Datos

### Estado de auditorÃ­a SSOT (DB real)
- **AuditorÃ­a ejecutada en vivo el 2026-02-15** conectando con `server/.env` (`DATABASE_URL`).
- Resultado real:
  - Tablas `public`: **41**
  - Ãndices: **207**
  - Constraints: **281**
  - PolÃ­ticas RLS: **91**
  - Columnas: **449**
- RLS:
  - Activo en todas las tablas de negocio revisadas.
  - `relrowsecurity = false` solo en `spatial_ref_sys` (esperable, tabla de sistema GIS).

### Ãndices faltantes (por patrÃ³n de consulta observado)
- `notifications (anonymous_id, is_read, created_at DESC)` para bandeja/contador.
- `chat_messages (conversation_id, created_at DESC)` si no existe compuesto completo.
- `comments (report_id, deleted_at, created_at DESC)` para listados paginados por reporte.

### Ãndices innecesarios / riesgo potencial
- **Redundancias reales detectadas** en DB viva:
  - `badges_code_key` y `idx_badges_code` (misma firma en `code`).
  - `idx_user_auth_email` y `user_auth_email_key` (misma firma en `email`).
  - `idx_user_auth_anonymous_id` y `unique_anonymous_id` (misma firma en `anonymous_id`).
  - `idx_votes_user_polymorphic`, `unique_vote_per_target`, `unique_vote_per_user_target` (misma firma en `anonymous_id,target_type,target_id`).
  - MÃºltiples duplicados en `moderation_actions` (`created_at` y `target_id,target_type`).
- Ãndices con `idx_scan = 0` (potencial sobreindexing): aparecen varios en `reports`, `notifications`, `comments`, `chat_rooms`, `votes` y `rate_limits`. Requiere pruning controlado por ventana de observaciÃ³n.

### Riesgos de locking
- Updates masivos potenciales en arranque/scripts y mantenimiento pueden competir con trÃ¡fico en tablas calientes (`reports`, `comments`, `chat_messages`).
- Falta evidencia de estrategia uniforme `CREATE INDEX CONCURRENTLY` en todas las evoluciones.

### Riesgos de race condition
- Flujos chat y delivery con actualizaciones fuera de transacciÃ³n Ãºnica.
- Mezcla de `queryWithRLS` y `pool.query` en mismo request rompe atomicidad de negocio.

### Soft delete correcto vs incorrecto
- **Correcto**: `deleted_at` en reportes/comentarios y filtros en feeds.
- **Incorrecto/parcial**: no todos los canales de catchup/realtime aplican los mismos filtros de visibilidad y pertenencia.

### Integridad referencial
- PK: **sin tablas sin PK** en `public`.
- FK: hay cobertura, pero no homogÃ©nea; varias tablas crÃ­ticas no dependen de FK (ej. `audit_logs`, `rate_limits`, `global_stats`, `domain_events_log`) por diseÃ±o operativo.
- **Drift crÃ­tico detectado en chat**:
  - `chat_messages` tiene `room_id` y `conversation_id`.
  - En vivo: `total=589`, `room_id_nulls=589`, `conversation_id_nulls=0`.
  - ConclusiÃ³n: `room_id` estÃ¡ legacy/obsoleto en datos actuales; mantener ambas columnas incrementa riesgo de inconsistencias y bugs de joins.

### Estrategia para 1M usuarios
- Particionar `chat_messages` por tiempo o hash de `conversation_id`.
- Separar lectura caliente de notificaciones en tabla/materialized view de inbox.
- Cola de eventos/outbox para desacoplar mutaciÃ³n transaccional de fan-out realtime/push.

### Plan de migraciÃ³n sin downtime
1. Agregar columnas/indexes de forma backward-compatible.
2. Backfill por lotes con job idempotente.
3. Dual-read o read-fallback temporal.
4. Dual-write acotado con mÃ©tricas de divergencia.
5. Cutover con feature flag.
6. Retiro de legado despuÃ©s de ventana de observaciÃ³n.

---

## 5ï¸âƒ£ Performance

### Problemas de queries
- Catchup realtime arma mÃºltiples consultas por request con lÃ­mites fijos y sin estrategia incremental robusta por actor.
- En comentarios y chats hay consultas complejas + subconsultas + operaciones post-query no siempre consolidadas.

### Problemas frontend (re-renders, hooks, cache)
- `useGlobalRealtime` reejecuta por `location`/`navigate` en dependencias (`src/hooks/useGlobalRealtime.ts:60`), causando resuscripciones no necesarias.
- Query config agresiva (`refetchOnWindowFocus/refetchOnMount`) con historial de request storm (`src/lib/queryClient.ts`).
- Direct API calls en UI (sin hooks dedicados) dificultan cache central.

### Bundle size
- Buen trabajo de manualChunks en `vite.config.ts`.
- PenalizaciÃ³n: imports eager en `src/App.tsx:63-74` para pÃ¡ginas de contenido que podrÃ­an lazy-load.

### Carga inicial
- Riesgo por inicializaciÃ³n pesada en bootstrap (`src/main.tsx:70`, `src/main.tsx:90`) cuando hay schema mismatch.

### Tiempo de interacciÃ³n
- En dispositivos limitados, recarga forzada + limpieza agresiva puede afectar TTI y estabilidad percibida.

### Estrategia de optimizaciÃ³n real
- Mover pÃ¡ginas de contenido a lazy imports.
- Reducir refetch agresivo y usar invalidaciÃ³n/event-driven por dominio.
- Consolidar pipelines de query por caso de uso (sin `fetch` directo en UI).
- Perf budgets obligatorios por chunk y endpoint p95.

---

## 6ï¸âƒ£ Seguridad

### Riesgos reales
- Secretos sensibles en `.env` local/servidor sin evidencia en este repo de gestiÃ³n centralizada (vault/KMS) ni polÃ­tica explÃ­cita de rotaciÃ³n.
- Endpoints realtime con control de autorizaciÃ³n incompleto.
- Secret fallback en JWT.
- Endpoint de `message-status` sin verificaciÃ³n de membresÃ­a.

### Superficie de ataque
- Realtime (`/api/realtime/*`) + auth + admin gateway + rutas de chat.
- Alta por cantidad de endpoints y excepciones por contexto.

### Rate limiting
- Existe rate limiting global y granular.
- Riesgo: varios flujos sensibles dependen de identidad no unificada en todo el stack realtime.

### Validaciones insuficientes
- ValidaciÃ³n heterogÃ©nea por ruta.
- Inconsistencia de estados HTTP en auth degrada respuesta de seguridad.

### JWT mal implementado (si aplica)
- No estÃ¡ â€œmal implementadoâ€ criptogrÃ¡ficamente, pero sÃ­ **mal protegido operativamente** por fallback de secreto y controles de canal incompletos.

### QuÃ© faltarÃ­a para cumplir estÃ¡ndar enterprise real
- Secret management fuera de repo + rotaciÃ³n inmediata.
- AuthZ obligatorio por canal realtime (owner/member/admin).
- Reglas unificadas de autorizaciÃ³n en catchup/replay/sse.
- Hard fail de configuraciÃ³n insegura en boot.

---

## 7ï¸âƒ£ Escalabilidad 10x / 100x / 1M usuarios

### QuÃ© rompe primero
1. Fan-out realtime en Node + EventEmitter sin capa de backpressure por canal.
2. Endpoints chat/catchup con consultas crecientes y lÃ³gica post-procesamiento.
3. CohesiÃ³n dÃ©bil de cachÃ©/invalidaciones en frontend bajo alta concurrencia.

### QuÃ© sistema colapsa primero
- **Primero**: realtime/chat.
- **Segundo**: rutas monolÃ­ticas de reportes/comentarios por complejidad y acoplamiento.

### CÃ³mo deberÃ­a evolucionar la arquitectura
- Pasar de â€œrequest handler inteligenteâ€ a â€œuse cases + outbox + workersâ€.
- Aislar canales realtime por Ã¡mbito (feed global, user-private, room-private) con auth central.
- Formalizar event-driven para notificaciones y reconciliaciÃ³n.

### Redis cluster / replicas / CDN / queues / event-driven
- Redis: migrar a cluster con particiÃ³n por dominio (`presence`, `dedupe`, `rate`).
- Postgres: rÃ©plicas de lectura para listados intensivos.
- CDN: estÃ¡ticos + media + hints de cachÃ© por versiÃ³n de app.
- Queues: BullMQ para push/notifications/reconciliation.
- Event-driven: outbox transaccional + consumidores idempotentes.

---

## 8ï¸âƒ£ UX TÃ©cnica (Engineering + Producto)

### Flujos que rompen conversiÃ³n
- Respuestas 500 genÃ©ricas en auth ante errores de usuario generan abandono.
- RehidrataciÃ³n/reload agresivo en boot puede percibirse como app inestable.

### Inconsistencias tÃ©cnicas que afectan UX
- Rutas duplicadas (`/usuario/:alias/sugerencias`) en `src/App.tsx:198-199`.
- Estrategias mixtas de data fetching (hooks + fetch directo + imports runtime) producen comportamiento no uniforme.

### Problemas estructurales que impactan percepciÃ³n
- Estados realtime potencialmente desincronizados entre tabs/sesiones en escenarios de reconnect.
- Errores de red y seguridad no siempre se traducen en feedback Ãºtil.

---

## 9ï¸âƒ£ Refactor Roadmap Priorizado

| Tarea | Impacto | Esfuerzo | Riesgo | Prioridad real |
|---|---|---|---|---|
| Formalizar gestiÃ³n de secretos (vault/KMS) y rotaciÃ³n; evitar secretos estÃ¡ticos de larga vida en `.env` de servidor | Muy Alto | Medio | Alto | P0 |
| Cerrar AuthZ de realtime (`/user/:id`, `/chats/:roomId`, `/message-status`, `/catchup`) | Muy Alto | Medio | Alto | P0 |
| Eliminar fallback de `JWT_SECRET` y endurecer startup checks | Alto | Bajo | Medio | P0 |
| Unificar persistencia por caso de uso (sin mezclar `supabase` + `pool` + `queryWithRLS`) | Alto | Alto | Medio | P1 |
| Reducir tamaÃ±o de handlers (extraer servicios de dominio) | Alto | Alto | Medio | P1 |
| Estandarizar manejo de errores (4xx/5xx) en auth y rutas crÃ­ticas | Alto | Medio | Bajo | P1 |
| Reestructurar `src/lib/api.ts` en mÃ³dulos de dominio + hooks exclusivos | Medio | Medio | Bajo | P1 |
| Mover imports eager de contenido a lazy chunks | Medio | Bajo | Bajo | P2 |
| Eliminar acceso API directo en componentes/pÃ¡ginas; dejar solo hooks/services | Medio | Medio | Bajo | P2 |
| Implementar outbox para eventos post-commit (SSE/push/notificaciones) | Muy Alto | Alto | Medio | P2 |

### Estado Semana 1 (DONE)
- Realtime authorization hardened.
- Cross-user stream access prevented.
- Security tests validated.

### Semana 2 â€” Chat Persistence Alignment (DONE)
- `conversation_id` confirmado como SSOT en persistencia de chat.
- `room_id` declarado legacy; no se usa en writes actuales de `chat_messages`.
- Payloads de push/SSE normalizados a `conversationId` como identificador canÃ³nico.
- `roomId` mantenido como alias temporal de backward compatibility.
- Tests de contrato agregados para validar el estÃ¡ndar:
  - `server/tests/security/chat-payload-contract.test.js`
  - `server/tests/security/orchestrator-chat-contract.test.js`
- VerificaciÃ³n ejecutada:
  - Tests: `realtime-authz`, `chat-membership`, `chat-payload-contract`, `orchestrator-chat-contract` en verde.
  - Type check: `npx tsc --noEmit` en verde.
- Nota de deprecaciÃ³n controlada:
  - `roomId serÃ¡ eliminado en una futura Fase 4 cuando no existan consumidores legacy.`

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

### Semana 3 - Hardening DB (Fase A DONE / Fase B PENDING)

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

#### Fase B (`votes`) - PENDING (bloqueado por gate)
- Estado: **PENDING**.
- Razon:
  - Existen 2 constraints UNIQUE con misma semantica en `votes`:
    - `unique_vote_per_target`
    - `unique_vote_per_user_target`
  - No se ejecuta drop de indice directo; corresponde dedupe por `ALTER TABLE ... DROP CONSTRAINT ...`.
- Gate obligatorio antes de ejecutar:
  1. Suite de tests de aplicacion en verde (no solo seguridad).
  2. Verificacion final de constraints equivalentes (`pg_get_constraintdef`) y ausencia de duplicados en datos.
  3. Ventana de ejecucion controlada + rollback definido.

---

## 🔟 Score Final

### Score 1â€“10 por categorÃ­a
- Arquitectura: **6.0**
- Performance: **6.5**
- Seguridad: **4.0**
- Escalabilidad: **5.5**
- UX TÃ©cnica: **6.5**
- Mantenibilidad: **5.0**

### Nivel real del proyecto
**Scale-Ready parcial**.

### RecomendaciÃ³n estratÃ©gica
- **Tocar primero**:
  1. Seguridad operativa (secretos + realtime AuthZ + JWT hardening).
  2. Consistencia transaccional/persistencia en chat/comments/reports.
  3. NormalizaciÃ³n de capa de datos frontend para evitar drift.
- **No tocar ahora**:
  1. Rewrites cosmÃ©ticos de UI.
  2. SobreingenierÃ­a de microservicios antes de cerrar seguridad/consistencia.
  3. Refactors masivos sin mÃ©tricas de regresiÃ³n.

---

## Evidencia tÃ©cnica mÃ­nima usada
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
