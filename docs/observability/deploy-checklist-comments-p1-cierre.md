# Deploy Checklist - Comments P1 Cierre

## Objetivo
Validar cierre funcional de `comments` tras extracción de mutaciones y hardening transaccional:
- `POST /api/comments`
- `PATCH /api/comments/:id`
- `DELETE /api/comments/:id`
- `POST/DELETE /api/comments/:id/like`
- `POST /api/comments/:id/flag`
- `POST/DELETE /api/comments/:id/pin`

Sin cambios de contrato API ni schema DB.

## Gate técnico (pre-deploy)
- [ ] `npm run test --prefix server -- tests/security/comment-like-transaction.test.js`
- [ ] `npm run test --prefix server -- tests/security/comment-pin-transaction.test.js`
- [ ] `npm run test --prefix server -- tests/security/comment-edit-transaction.test.js`
- [ ] `npm run test --prefix server -- tests/security/comment-flag-transaction.test.js`
- [ ] `npm run test --prefix server -- tests/security/comment-delete-idempotency.test.js`
- [ ] `cd server && npx tsc --noEmit`

## Smoke funcional 2 usuarios (2-3 min)
1. Usuario A publica comentario nuevo en reporte visible para B.
- [ ] B ve comentario nuevo sin refresh.
- [ ] El comentario mantiene alias/avatar correctos.

2. Usuario A edita su comentario.
- [ ] Se persiste edición en A y B.
- [ ] Se mantiene badge de autor cuando corresponde.

3. Usuario A elimina su comentario.
- [ ] Respuesta API exitosa.
- [ ] El comentario desaparece en UI sin recarga.

4. Like/Unlike sobre comentario.
- [ ] Like incrementa contador en A/B.
- [ ] Unlike decrementa contador en A/B.
- [ ] Repetir unlike no rompe (idempotencia funcional).

5. Pin/Unpin por dueño del reporte.
- [ ] Dueño ve opción pin/unpin.
- [ ] No-dueño no ve opción de moderación.

6. Flag de comentario.
- [ ] Flag sobre comentario ajeno -> 201.
- [ ] Repetir flag mismo usuario/comentario -> 409.

## Monitoreo rápido post-deploy (10-15 min)
- [ ] Sin 5xx en rutas de comments.
- [ ] Sin errores repetitivos de RLS params (`undefined`, `42P18`).
- [ ] Sin eventos realtime de comments fuera de commit exitoso.

## Evidencia mínima
- [ ] Resultado de tests.
- [ ] Resultado de `tsc`.
- [ ] Captura/log de smoke 2 usuarios.
- [ ] Decisión final: `GO` o `ROLLBACK`.
