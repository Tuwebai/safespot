# Politica de Secretos y Rotacion (Semana 3)

## Objetivo
Reducir riesgo operativo por secretos faltantes, debiles o expuestos y asegurar arranque seguro del backend.

## Estado operativo
- Alcance activo: `api + worker`.
- Modo: hard-fail para secretos criticos.
- Evidencia requerida: ticket de cambio + timestamp de rotacion + validacion post-rotacion.
- Registro obligatorio: `docs/observability/secrets-rotation-evidence-log.md`.

## Gobierno (RACI minimo)
| Rol | Responsabilidad |
|---|---|
| Owner tecnico backend | Ejecutar rotacion y validar impacto funcional |
| On-call | Aprobar ventana y supervisar mitigacion/rollback |
| Security owner | Autorizar cierre y registrar evidencia de cumplimiento |

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

## Cadencia operativa obligatoria
- Control mensual (sin rotacion): verificar expiracion/edad de secretos y estado de env validation.
- Simulacro trimestral: fire-drill de rotacion con rollback controlado en entorno no productivo.
- Rotacion inmediata: ante cualquier evidencia de exposicion o incidente de seguridad.

## Ventana y precondiciones
Antes de rotar:
1. Confirmar ventana de bajo trafico y on-call asignado.
2. Verificar estado base:
   - auth 5xx en 0 (ultimos 15 min)
   - catchup p95 bajo umbral
   - sin incidentes SEV1 abiertos
3. Confirmar plan de rollback (version previa de env disponible).

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

## Gate de cierre (GO/NO-GO)
- GO:
  - smoke post-rotacion en verde,
  - `requestId` de verificaciones registrado,
  - sin 5xx auth/realtime anomalo durante 15 minutos.
- NO-GO:
  - cualquier fallo de auth bootstrap,
  - `ENV_VALIDATION_FAILED` en boot,
  - degradacion sostenida en metricas criticas.

## Rollback operativo (obligatorio)
Si falla validacion post-rotacion:
1. Restaurar secreto previo en entorno.
2. Reiniciar proceso afectado.
3. Ejecutar smoke rapido de auth/realtime.
4. Declarar estado `ROLLBACK_DONE` con evidencia.

## Evidencia minima de cumplimiento
- ID de cambio/ticket.
- Secreto rotado (nombre, no valor).
- Timestamp inicio/fin.
- Resultado de smoke post-rotacion.
- Decision final: `GO` o `ROLLBACK`.
- Link a entrada en `secrets-rotation-evidence-log.md`.
