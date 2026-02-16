# Observabilidad Minima - 4 Queries Guardadas (Logs)

## Objetivo
Reemplazar dashboard externo por consultas guardadas de logs para operar Semana 3 con trazabilidad.

## Requisitos
- Logs estructurados activos en backend.
- Correlacion por `requestId`.
- Sin PII en payload.

## Query 1 - 401/403 realtime (ultimos 10 min)
Filtro:
- `message = "METRIC_REALTIME_AUTHZ_DENIED"`

Campos a observar:
- `statusCode`
- `reason`
- `endpoint`
- `requestId`

Uso:
- Detectar picos de denegaciones y separar `AUTH_REQUIRED` vs `FORBIDDEN_STREAM`/`NOT_ROOM_MEMBER`.

## Query 2 - Latencia catchup p95
Filtro:
- `message = "METRIC_REALTIME_CATCHUP"`

Campos a observar:
- `durationMs`
- `eventCount`
- `requestId`

Uso:
- Calcular p95 manualmente por ventana y detectar degradacion.

## Query 3 - Fallos de ACK (delivered/read)
Filtro:
- `message = "METRIC_CHAT_ACK_FAILURE"`

Campos a observar:
- `flow`
- `reason`
- `statusCode`
- `requestId`

Uso:
- Detectar desincronizacion de ticks y errores de reconciliacion.

## Query 4 - 5xx de auth
Filtro:
- `message = "METRIC_AUTH_5XX"`

Campos a observar:
- `endpoint`
- `code`
- `requestId`

Uso:
- Alertar fallo de login/bootstrap y activar rollback rapido.

## Umbrales operativos sugeridos
- Realtime 401/403: > 40 eventos / 5 min por 10 min.
- Catchup p95: > 1000 ms por 10 min.
- ACK failures: > 5 / 5 min por 10 min.
- Auth 5xx: > 0 por 5 min.

## Evidencia minima por incidente
- Captura o export de la query usada.
- `requestId` de muestra.
- Timestamp inicio/mitigacion/cierre.

