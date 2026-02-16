# Votes Fase B - Gate de Ejecucion y Evidencia SSOT

## Estado
- Gate tecnico: **PASS**
- Ejecucion de cambio: **DONE** (2026-02-16)

## Gate de tests (backend)
Ejecuciones:
- `tests/security/auth-realtime-error-contract.test.js` -> PASS
- `tests/security/realtime-authz.test.js` -> PASS
- `tests/security/env-validation.test.js` -> PASS
- `tests/security/chat-membership.test.js` -> PASS
- `npx tsc --noEmit` (server) -> PASS

## Evidencia DB SSOT (`public.votes`)
Consulta de constraints UNIQUE:
- `unique_vote_per_target` -> `UNIQUE (anonymous_id, target_type, target_id)`
- `unique_vote_per_user_target` -> `UNIQUE (anonymous_id, target_type, target_id)`

Consulta de definiciones de indice asociadas:
- `CREATE UNIQUE INDEX unique_vote_per_target ON public.votes (anonymous_id, target_type, target_id)`
- `CREATE UNIQUE INDEX unique_vote_per_user_target ON public.votes (anonymous_id, target_type, target_id)`

Resultado de equivalencia:
- Ambas constraints son semanticamente equivalentes (misma clave unica exacta).

Chequeo de datos duplicados actuales:
- `duplicate_rows = 0` para `(anonymous_id, target_type, target_id)`.

## Ejecucion aplicada
Comando ejecutado (sin transaccion):
- `ALTER TABLE public.votes DROP CONSTRAINT unique_vote_per_user_target;`

Post-check de constraints:
- Queda solo:
  - `unique_vote_per_target` -> `UNIQUE (anonymous_id, target_type, target_id)`

## Post-check funcional minimo
Prueba en transaccion con rollback (sin persistir datos):
1. `INSERT` valido de voto (usuario y reporte existentes) -> OK.
2. `INSERT` duplicado mismo `(anonymous_id, target_type, target_id)` -> rechazado.

Resultado:
- `duplicate_rejected = true`
- error esperado: `23505 duplicate key value violates unique constraint "unique_vote_per_target"`

## Verificacion de 500s en rutas relacionadas
- En este entorno no hay stream centralizado de logs de produccion accesible desde CLI.
- Gate tecnico complementario ejecutado en backend local:
  - `tests/security/auth-realtime-error-contract.test.js` PASS
  - `tests/security/realtime-authz.test.js` PASS
  - `tests/security/env-validation.test.js` PASS
  - `tests/security/chat-membership.test.js` PASS
  - `npx tsc --noEmit` PASS

## Plan de cierre posterior
1. Monitorear errores de rutas de votos durante la ventana posterior al cambio.
2. Si no hay regresiones, cerrar Fase B en auditoria como completada.

## Rollback logico
Si hubiera regresion, recrear constraint eliminada:
- `ALTER TABLE public.votes ADD CONSTRAINT unique_vote_per_user_target UNIQUE (anonymous_id, target_type, target_id);`
