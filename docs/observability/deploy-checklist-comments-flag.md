# Deploy Checklist - Comments FLAG (Transaccional)

## Objetivo
Desplegar con seguridad la normalizacion transaccional de:
- `POST /api/comments/:id/flag`

Sin cambios de contrato API ni schema DB.

## Pre-deploy
- [ ] `npm run test --prefix server -- tests/security/comment-flag-transaction.test.js` en verde (2/2).
- [ ] `npx tsc --noEmit` en `server/` en verde.
- [ ] Confirmar que no hay migraciones pendientes.
- [ ] Confirmar variables criticas presentes (`DATABASE_URL`, `JWT_SECRET`).
- [ ] Ventana de deploy definida y comunicada.

## Deploy
- [ ] Deploy backend aplicado.
- [ ] Healthcheck API 200 (`/health` o equivalente).
- [ ] Verificar que no hay aumento anormal de 5xx en comentarios.

## Smoke funcional (post-deploy inmediato)
- [ ] `POST /api/comments/:id/flag` (usuario A sobre comentario de B) devuelve 201 + `flag_id`.
- [ ] Repetir flag sobre mismo comentario por mismo usuario devuelve 409 (idempotencia funcional).
- [ ] Flag a comentario inexistente devuelve 404.
- [ ] Flag a comentario propio devuelve 403.

## Verificacion de consistencia
- [ ] Si ocurre error interno, no se registra `auditLog` de exito.
- [ ] No se emiten side-effects realtime/notificaciones en falla intermedia.
- [ ] No hay registros duplicados en `comment_flags` para (`anonymous_id`, `comment_id`).

## Monitoreo (15-30 min)
- [ ] Revisar tasa 5xx de `POST /api/comments/:id/flag`.
- [ ] Revisar latencia p95 de endpoint.
- [ ] Revisar logs de errores repetitivos en `comments.flag`.

## Rollback (si hay degradacion)
- [ ] Revertir a release anterior del backend.
- [ ] Verificar healthcheck y smoke minimo.
- [ ] Confirmar que flag vuelve a operar sin errores.
- [ ] Registrar incidente con timestamp y requestId.

## Evidencia a adjuntar
- [ ] Resultado de tests.
- [ ] Resultado de `tsc`.
- [ ] Capturas/logs de smoke post-deploy.
- [ ] Decision final: `GO` o `ROLLBACK`.

