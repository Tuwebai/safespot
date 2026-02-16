# Politica de Secretos y Rotacion (Semana 3)

## Objetivo
Reducir riesgo operativo por secretos faltantes, debiles o expuestos y asegurar arranque seguro del backend.

## Secretos criticos (hard-fail)
- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `JWT_SECRET`

## Secretos criticos en produccion (hard-fail adicional)
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (compatibilidad legacy: `VAPID_EMAIL`)

## Regla de arranque
- Si falta un secreto critico, el proceso termina en bootstrap con `process.exit(1)`.
- No se permiten defaults inseguros para `JWT_SECRET` fuera de entorno `test`.

## Frecuencia de rotacion recomendada
- `JWT_SECRET`: cada 90 dias o inmediato ante incidente.
- `DATABASE_URL` / credenciales DB: cada 90 dias o ante exposicion.
- `SUPABASE_*`: cada 90 dias o ante exposicion.
- `VAPID_*`: cada 180 dias o ante sospecha de abuso.

## Guardrails
- No versionar secretos en git.
- No loguear valores de secretos.
- No compartir secretos en tickets, capturas o chat.
- Definir owner tecnico por cada secreto.

## Procedimiento minimo de rotacion
1. Generar nuevo secreto en gestor seguro (vault/KMS/secret manager del proveedor).
2. Aplicar en entorno no productivo y validar salud + auth + push.
3. Desplegar en produccion en ventana controlada.
4. Verificar indicadores:
- login exitoso
- 401/403 esperados
- latencia auth/realtime normal
- push operativo
5. Revocar secreto anterior y cerrar incidente/cambio con evidencia.

