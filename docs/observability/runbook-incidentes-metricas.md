# Runbook de Incidentes - Observabilidad Semana 3

## Alcance
- Backend only (sin UI admin).
- Stack: Loki + Grafana.
- Metricas permitidas:
  - `METRIC_REALTIME_AUTHZ_DENIED` (401/403 realtime)
  - `METRIC_REALTIME_CATCHUP` (latencia catchup)
  - `METRIC_CHAT_ACK_FAILURE` (fallos ACK delivered/read)
  - `METRIC_AUTH_5XX` (errores 5xx en auth)
  - Base: `METRIC_HTTP_REQUEST` (requests + latency)

## Guardrails de PII (obligatorio)
- Nunca loggear payloads completos, tokens JWT, emails, headers Authorization, cookies, ni query strings crudas.
- Endpoint en logs debe ser path saneado (`/api/...`) sin query params.
- `requestId` es el correlativo unico para trazabilidad.
- Si se requiere investigacion profunda, usar `requestId` para pivotear en logs de app y DB; no ampliar logs con datos sensibles.

## Retencion
- 14 dias: `METRIC_HTTP_REQUEST` (alto volumen).
- 30 dias: `METRIC_REALTIME_AUTHZ_DENIED`, `METRIC_REALTIME_CATCHUP`, `METRIC_CHAT_ACK_FAILURE`, `METRIC_AUTH_5XX`.

## Alertas (4)
1. `ALERT_REALTIME_AUTH_REJECTIONS_SPIKE`
- Query: suma de 401+403 realtime en 5 minutos.
- Umbral: `> 40` eventos / 5m por 10m.
- Severidad: Warning.

2. `ALERT_REALTIME_CATCHUP_P95_HIGH`
- Query: p95 `durationMs` de `METRIC_REALTIME_CATCHUP`.
- Umbral: `> 1000ms` por 10m.
- Severidad: Critical.

3. `ALERT_CHAT_ACK_FAILURES`
- Query: suma `METRIC_CHAT_ACK_FAILURE`.
- Umbral: `> 5` / 5m por 10m.
- Severidad: Critical.

4. `ALERT_AUTH_5XX_PRESENT`
- Query: suma `METRIC_AUTH_5XX`.
- Umbral: `> 0` por 5m.
- Severidad: Critical.

## Respuesta por metrica
### 1) 401/403 realtime
- Confirmar si incremento es por deploy reciente o cambios de token/session.
- Filtrar por `endpoint` y `reason` para detectar patron (AUTH_REQUIRED vs FORBIDDEN_STREAM vs NOT_ROOM_MEMBER).
- Si hay salto abrupto post-deploy: rollback frontend realtime que genera URL/token.
- Verificar expiracion JWT y clock skew.

### 2) p95 catchup alto
- Revisar volumen de eventos (`eventCount`) y correlacion con p95.
- Chequear salud DB (latencia, locks, pool saturation).
- Validar que `since` enviado por cliente no este reiniciando a ventanas masivas.
- Si degradacion persiste: activar mitigacion temporal de limite en catchup y escalar a on-call DB.

### 3) ACK failures
- Separar por `flow` (`ack_delivered` vs `reconcile_status`) y `reason`.
- Si predomina `NOT_FOUND_OR_NO_ACCESS`: revisar membresia/conversation drift en cliente.
- Si predomina `INTERNAL_ERROR`: revisar errores DB, deadlocks o tiempo de respuesta.
- Verificar que no haya release reciente en chat orchestration.

### 4) Auth 5xx
- Revisar endpoint exacto y `code` de error.
- Confirmar estado de secretos obligatorios (`JWT_SECRET`, DB, providers) y conectividad.
- Si hay 5xx continuos: freeze deploys de auth y rollback a ultima version estable.
- Prioridad P0: auth 5xx rompe login/bootstrap.

## Fire-Drill (obligatorio, semanal)
Objetivo: validar deteccion + respuesta en <= 15 minutos.

1. Simular 401/403 realtime
- Forzar token invalido en entorno staging para un grupo de prueba.
- Esperado: alerta 1 dispara dentro de 10 minutos.

2. Simular catchup lento
- Introducir delay controlado en staging para endpoint catchup.
- Esperado: alerta 2 dispara y panel de p95 cruza umbral.

3. Simular ACK failures
- En staging, enviar ACK con mensaje inexistente para generar errores controlados.
- Esperado: alerta 3 dispara.

4. Simular auth 5xx
- Romper temporalmente variable de entorno en staging (sin impacto prod).
- Esperado: alerta 4 dispara en <= 5 minutos.

### Checklist de cierre fire-drill
- [ ] Las 4 alertas dispararon.
- [ ] On-call recibio notificacion.
- [ ] Se documento MTTA y MTTR.
- [ ] Se restauraron condiciones normales.
- [ ] Se archivaron evidencias con requestId.

## Comandos utiles Loki (referencia)
- Realtime deny:
  - `{app="safespot-backend"} | json | message="METRIC_REALTIME_AUTHZ_DENIED"`
- Catchup:
  - `{app="safespot-backend"} | json | message="METRIC_REALTIME_CATCHUP"`
- ACK failures:
  - `{app="safespot-backend"} | json | message="METRIC_CHAT_ACK_FAILURE"`
- Auth 5xx:
  - `{app="safespot-backend"} | json | message="METRIC_AUTH_5XX"`
