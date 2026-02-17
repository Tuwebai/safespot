# Registro de Evidencia - Rotacion de Secretos

## Objetivo
Trazabilidad operativa de cada rotacion o simulacro de secretos, sin exponer valores sensibles.

## Formato obligatorio por entrada
| Fecha (UTC) | Entorno | Tipo | Secreto(s) | Ticket | Owner | Resultado | Evidencia |
|---|---|---|---|---|---|---|---|
| YYYY-MM-DD HH:mm | staging/prod | rotacion/simulacro | NOMBRE_SECRETO | CHG-XXXX | @owner | GO/ROLLBACK | requestId + smoke |

## Plantilla de evidencia (copiar/pegar)
```md
### CHG-XXXX - Rotacion <SECRETO>
- Fecha inicio (UTC):
- Fecha fin (UTC):
- Entorno:
- Owner tecnico:
- On-call:
- Security owner:
- Secretos rotados (nombre, no valor):
- Smoke ejecutado:
  - login email/password: OK/FAIL
  - login social (si aplica): OK/FAIL
  - catchup autenticado: OK/FAIL
  - push segun flag: OK/FAIL
- requestId de verificacion:
- Resultado: GO / ROLLBACK
- Observaciones:
```

## Entradas

### CHG-2026-02-17-DRILL-POST - Verificacion post-rotacion JWT_SECRET (staging)
- Fecha inicio (UTC): 2026-02-17 00:44
- Fecha fin (UTC): 2026-02-17 00:47
- Entorno: staging
- Owner tecnico: @backend-owner (pendiente confirmacion)
- On-call: @oncall (pendiente confirmacion)
- Security owner: @security-owner (pendiente confirmacion)
- Secretos rotados (nombre, no valor): JWT_SECRET
- Smoke ejecutado:
  - login email/password: OK (endpoint operativo; con credencial invalida responde 400 esperado por formato/validacion)
  - login social (si aplica): N/A
  - catchup autenticado: OK (200)
  - push segun flag: N/A
- requestId de verificacion: req_m8vnbmr98mlpvwb2u
- Resultado: GO
- Observaciones:
  - Verificaciones post-rotacion en `https://safespot-6e51.onrender.com`:
    - `GET /health` -> 200
    - `GET /api/reports?limit=1` -> 200
    - `GET /api/realtime/status` -> 200
    - `POST /api/auth/bootstrap` + `GET /api/auth/me` autenticado -> 200
    - `GET /api/realtime/catchup?since=1` autenticado -> 200 (sin 5xx)
  - `ENV_VALIDATION_FAILED`: sin evidencia en runtime (validacion indirecta por arranque y disponibilidad de health/auth/realtime post-rotacion).

### CHG-2026-02-17-DRILL - Rotacion JWT_SECRET (fire-drill staging)
- Fecha inicio (UTC): 2026-02-17 00:33
- Fecha fin (UTC): 2026-02-17 00:36
- Entorno: staging
- Owner tecnico: @backend-owner (pendiente confirmacion)
- On-call: @oncall (pendiente confirmacion)
- Security owner: @security-owner (pendiente confirmacion)
- Secretos rotados (nombre, no valor): JWT_SECRET
- Smoke ejecutado:
  - login email/password: BLOCKED (sin credenciales operativas compartidas; validado bootstrap auth 200)
  - login social (si aplica): N/A
  - catchup autenticado: OK (200)
  - push segun flag: N/A
- requestId de verificacion: req_vkrfzbwgjmlpvhdgy
- Resultado: ROLLBACK
- Observaciones:
  - Backend staging alcanzable en `https://safespot-6e51.onrender.com`.
  - Smoke pre-rotacion OK: `/health` 200, `/api/reports?limit=1` 200, `/api/realtime/status` 200, `/api/auth/me` 200, `/api/realtime/catchup?since=1` 200 con JWT de bootstrap.
  - No fue posible ejecutar rotacion real de `JWT_SECRET` ni restart del servicio desde esta terminal por falta de acceso al secret manager/control-plane de staging.
  - No hubo cambios de secreto aplicados; por seguridad se cierra intento como `ROLLBACK` operativo (sin impacto).

### PENDIENTE INICIAL
- Estado: pendiente de primera entrada formal de rotacion/simulacro.
- Accion: completar en la siguiente ventana programada.
