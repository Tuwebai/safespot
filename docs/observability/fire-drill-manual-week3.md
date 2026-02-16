# Fire-Drill Manual - Semana 3 (Sin Grafana)

## Objetivo
Validar deteccion y respuesta operativa usando solo logs + 4 queries guardadas.

## Alcance
- Realtime (401/403)
- Catchup latency
- ACK failures
- Auth 5xx

## Preparacion
1. Definir ventana de prueba (staging recomendado).
2. Confirmar acceso a logs backend.
3. Confirmar queries guardadas:
- `docs/observability/log-queries-week3.md`
4. Asignar roles:
- conductor del drill
- operador de mitigacion
- observador/auditor de evidencia

## Escenarios de simulacion

### Escenario A - Pico 401/403 realtime
Accion:
- Forzar token invalido en cliente de prueba o stream cruzado.

Evidencia esperada:
- Logs `METRIC_REALTIME_AUTHZ_DENIED` con `statusCode` y `reason`.

### Escenario B - Catchup lento
Accion:
- Introducir carga o delay controlado en staging.

Evidencia esperada:
- `METRIC_REALTIME_CATCHUP.durationMs` por encima de umbral.

### Escenario C - ACK failures
Accion:
- Disparar ACK con mensaje inexistente/no accesible en staging.

Evidencia esperada:
- `METRIC_CHAT_ACK_FAILURE` con `flow` y `reason`.

### Escenario D - Auth 5xx
Accion:
- Simular fallo controlado en dependencia de auth en staging.

Evidencia esperada:
- `METRIC_AUTH_5XX` con `requestId`.

## Checklist de ejecucion
- [ ] Se ejecutaron 4 escenarios.
- [ ] Cada escenario dejo evidencia en logs.
- [ ] Se registro MTTA y MTTR por escenario.
- [ ] Se documento accion correctiva.
- [ ] Se registro decision final (`GO`/`NO_GO`) por escenario.

## Criterio de aprobacion
- Respuesta inicial <= 15 min en todos los escenarios.
- Trazabilidad completa por `requestId`.
- Mitigacion reproducible documentada.
- Cierre con owner + fecha para cada mejora detectada.

## Plantilla de evidencia
- Escenario:
- Inicio:
- Deteccion:
- Mitigacion:
- Cierre:
- `requestId` muestra:
- Hallazgo:
- Accion permanente:
- Owner:
- Fecha compromiso:
- Decision (`GO`/`NO_GO`):
