# Runbook Operativo Enterprise - Semana 3

## 0. Objetivo
Operar incidentes de `auth + realtime + push` con respuesta predecible, trazable y segura, sin improvisacion.

## 1. Alcance y guardrails
- Backend only (sin UI admin).
- Stack observabilidad: logs estructurados (sin dependencia de Grafana).
- No exponer PII en logs: nunca tokens, cookies, payloads completos ni query strings crudas.
- Correlacion obligatoria por `requestId`.
- Cierre obligatorio por evidencia: sin evidencia no hay incidente cerrado.

## 2. Metricas y SLO operativo
- `METRIC_REALTIME_AUTHZ_DENIED` (401/403 realtime)
- `METRIC_REALTIME_CATCHUP` (latencia catchup)
- `METRIC_CHAT_ACK_FAILURE` (fallos ACK delivered/read)
- `METRIC_AUTH_5XX` (errores 5xx auth)
- Base: `METRIC_HTTP_REQUEST` (requests/latencia general)

SLO de respuesta inicial:
- SEV1: ack humano <= 5 min
- SEV2: ack humano <= 15 min

SLO de mitigacion:
- SEV1: mitigacion inicial <= 30 min
- SEV2: mitigacion inicial <= 60 min

## 3. Triage inicial (primeros 5 minutos)
1. Confirmar severidad:
- SEV1: login caido masivo, auth 5xx sostenido, realtime inutilizable.
- SEV2: degradacion parcial, picos acotados, workaround disponible.
2. Identificar patron dominante por metrica.
3. Tomar `requestId` de casos reales y pivotear trazas.
4. Congelar deploys si el incidente es auth/realtime activo.
5. Abrir canal de incidente y registrar timestamp de inicio.

Salida minima del triage:
- severidad asignada (`SEV1` o `SEV2`)
- metrica dominante
- primer `requestId` ancla
- owner operativo asignado

## 4. Playbook por tipo de incidente

### 4.1 401/403 realtime anomalo
Objetivo: diferenciar fallo de autenticacion vs autorizacion esperada.

Checklist:
1. Revisar volumen y reason:
- `AUTH_REQUIRED`
- `FORBIDDEN_STREAM`
- `NOT_ROOM_MEMBER`
2. Validar si hubo deploy reciente frontend/backend.
3. Verificar expiracion de JWT y sincronizacion de reloj.
4. Confirmar que los endpoints criticos responden con contrato uniforme (`error, code, message, requestId`).
5. Si salto post-deploy: rollback del cambio de cliente/orquestador realtime.

Salida esperada:
- tasa 401/403 vuelve a baseline
- sin nuevos `FORBIDDEN` inesperados para usuarios validos

### 4.2 Catchup p95 alto
Objetivo: recuperar latencia y evitar backlog.

Checklist:
1. Confirmar `durationMs` p95 y `eventCount`.
2. Correlacionar con DB (latencia, locks, pool saturation).
3. Validar que el cliente no envie `since` roto (ventanas gigantes).
4. Aplicar mitigacion operativa:
- reducir carga concurrente
- forzar estrategia de reconexion progresiva
5. Escalar a on-call DB si persiste > 15 min.

Salida esperada:
- p95 catchup bajo umbral operativo

### 4.3 ACK failures (delivered/read)
Objetivo: evitar desincronizacion de ticks y estados.

Checklist:
1. Segmentar por flujo:
- `ack_delivered`
- `reconcile_status`
2. Si domina `NOT_FOUND_OR_NO_ACCESS`: revisar membresia/conversationId.
3. Si domina `INTERNAL_ERROR`: revisar errores DB y tiempos de respuesta.
4. Confirmar headers de identidad en ACK (`X-Anonymous-Id`, `X-Anonymous-Signature`, `Authorization` cuando aplica).
5. Validar que errores se registran sin cortar envio de mensajes.

Salida esperada:
- caida sostenida de `METRIC_CHAT_ACK_FAILURE`

### 4.4 Auth 5xx
Objetivo: restaurar login/bootstrap cuanto antes.

Checklist:
1. Identificar endpoint exacto y code.
2. Verificar estado de secretos criticos (`DATABASE_URL`, `JWT_SECRET`, `SUPABASE_*`).
3. Confirmar que no hay `ENV_VALIDATION_FAILED` en arranque.
4. Si hay regresion de release: rollback inmediato del backend.
5. Ejecutar smoke de auth despues de mitigacion.

Salida esperada:
- `METRIC_AUTH_5XX` en 0 sostenido

## 5. Playbook de secretos y rotacion
Referencia: `docs/observability/secrets-rotation-policy.md`.

Accion inmediata ante incidente de secretos:
1. Rotar secreto comprometido en gestor seguro.
2. Actualizar entorno.
3. Reiniciar proceso afectado.
4. Verificar health y pruebas de auth/realtime.
5. Revocar secreto anterior.

Validaciones post-rotacion:
- login email/password
- login Google
- `GET /api/realtime/catchup` autenticado
- flujo push segun feature flag

## 6. Modo push (feature flag operativo)
`ENABLE_PUSH_NOTIFICATIONS=false`:
- API y worker pueden arrancar sin `VAPID_*`.
- Push queda deshabilitado de forma explicita.

`ENABLE_PUSH_NOTIFICATIONS=true` (o no definido):
- en produccion se exige `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` (o legacy `VAPID_EMAIL`).

Uso recomendado en incidente:
1. Si push rompe operacion: setear `ENABLE_PUSH_NOTIFICATIONS=false`.
2. Estabilizar auth/realtime.
3. Rehabilitar push con verificacion previa de VAPID.

## 7. Rollback operativo
Prioridad de rollback:
1. Configuracion/env (secrets/flags)
2. Deploy backend
3. Cambios cliente realtime si fueron gatillo

Condiciones para declarar rollback exitoso:
- sin 5xx auth nuevos por 15 min
- catchup p95 normalizado
- 401/403 en rango esperado
- sin crecimiento de ACK failures

Decision formal:
- `GO`: metrica estabilizada + smoke OK + sin errores nuevos.
- `NO_GO`: persiste degradacion o evidencia incompleta.

## 8. Comandos de verificacion (copy/paste)
```bash
npm run test --prefix server -- tests/security/auth-realtime-error-contract.test.js
npm run test --prefix server -- tests/security/realtime-authz.test.js
npm run test --prefix server -- tests/security/env-validation.test.js
cd server && npx tsc --noEmit
```

## 9. Retencion y cumplimiento
- 14 dias: `METRIC_HTTP_REQUEST` (alto volumen)
- 30 dias: metricas criticas de seguridad/realtime/ack/auth

## 10. Cierre de incidente (obligatorio)
Checklist de cierre:
- [ ] Timeline documentado (inicio, mitigacion, cierre)
- [ ] Causa raiz confirmada (archivo/linea o config exacta)
- [ ] Evidencia con `requestId`
- [ ] Accion preventiva definida (test, alerta, guardrail)
- [ ] Estado final comunicado a equipo
- [ ] Owner y fecha comprometida para accion permanente

Plantilla minima postmortem:
- Impacto
- Causa raiz
- Mitigacion aplicada
- Leccion operativa
- Accion permanente con owner y fecha
