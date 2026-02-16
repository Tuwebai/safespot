# Deploy Checklist - Comments LIKE/UNLIKE (Transaccional)

## Objetivo
Desplegar con seguridad la unificacion transaccional de:
- `POST /api/comments/:id/like`
- `DELETE /api/comments/:id/like`

Sin cambios de contrato API ni schema DB.

## Pre-deploy
- [ ] `npm run test --prefix server -- tests/security/comment-like-transaction.test.js` en verde (4/4).
- [ ] `npx tsc --noEmit` en `server/` en verde.
- [ ] Confirmar que no hay migraciones pendientes.
- [ ] Confirmar variables criticas presentes (`DATABASE_URL`, `JWT_SECRET`).
- [ ] Ventana de deploy definida y comunicada.

## Deploy
- [ ] Deploy backend aplicado.
- [ ] Healthcheck API 200 (`/health` o endpoint operativo equivalente).
- [ ] Verificar que no hay aumento anormal de 5xx en los primeros 5 minutos.

## Smoke funcional (post-deploy inmediato)
- [ ] `POST /api/comments/:id/like` devuelve 200 y `data.liked = true`.
- [ ] `DELETE /api/comments/:id/like` devuelve 200 y `data.liked = false`.
- [ ] Repetir `DELETE /like` (idempotente): 200 + `message = "Like not found"`.
- [ ] Realtime: al like/unlike, clientes suscriptos reciben actualizacion de contador.

## Verificacion de consistencia
- [ ] No hay eventos realtime emitidos si ocurre error interno en transaccion.
- [ ] No hay desalineacion visible entre contador en DB y contador emitido.
- [ ] Logs sin errores repetitivos en `comments.like` / `comments.unlike`.

## Monitoreo (15-30 min)
- [ ] Revisar tasa de 5xx en rutas de comments.
- [ ] Revisar latencia p95 de `POST/DELETE /api/comments/:id/like`.
- [ ] Revisar warnings/errors de `realtimeEvents.emitCommentLike` y `emitVoteUpdate`.

## Rollback (si hay degradacion)
- [ ] Revertir a release anterior del backend.
- [ ] Verificar healthcheck y smoke minimo.
- [ ] Confirmar que likes/unlikes vuelven a operar sin errores.
- [ ] Registrar incidente con timestamp y requestId de evidencia.

## Evidencia a adjuntar
- [ ] Resultado de tests.
- [ ] Resultado de `tsc`.
- [ ] Capturas/logs de smoke post-deploy.
- [ ] Decision final: `GO` o `ROLLBACK`.

